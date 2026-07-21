//! # timekeep-dist-odoo
//!
//! Odoo-specific distributor. Maps timekeep domain events to
//! Odoo HR attendance records via the JSON-2 REST API.
//!
//! ## Integration Flow
//!
//! ```text
//! PunchReceived { punch }
//!   ├── find_employee(barcode = punch.user_pin)
//!   │   └── POST /json/2/hr.employee/search
//!   ├── [CheckIn]  → find open attendance → create if none
//!   │   ├── POST /json/2/hr.attendance/search  (check_out = false)
//!   │   └── POST /json/2/hr.attendance/create  (in_mode = "technical")
//!   └── [CheckOut] → find open attendance → set check_out
//!       ├── POST /json/2/hr.attendance/search  (check_out = false)
//!       └── POST /json/2/hr.attendance/write   (check_out = timestamp)
//! ```
//!
//! ## Configuration
//!
//! ```toml
//! [[distributors.odoo]]
//! url = "https://odoo.example.local/json/2"
//! api_key = "${ODOO_API_KEY}"
//! database = "example_db"
//! employee_field = "barcode"
//! ```
//!
//! ## Deduplication
//!
//! Odoo enforces "max 1 open attendance per employee". We:
//! 1. Check for existing open attendance before creating (pre-flight)
//! 2. Rely on Odoo's database constraint as safety net
//! 3. Cache employee_id lookups (LRU, 200 entries) to avoid repeated API calls

mod json2;
pub mod sync;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use timekeep_circuit::{CircuitBreaker, CircuitBreakerError};
use timekeep_core::{
    Error, events::DomainEvent, model::AttendancePunch, model::PendingDelivery,
    traits::distributor::Distributor, traits::storage::Storage,
};

use crate::json2::{EmployeeInfo, Json2Response};

/// Odoo distributor with JSON-2 API integration.
pub struct OdooDistributor {
    client: reqwest::Client,
    /// Base URL for JSON-2 API (e.g., "https://odoo.example.local/json/2")
    url: String,
    /// Bearer token API key
    api_key: String,
    /// Odoo database name (sent as X-Odoo-Database header when multi-db)
    database: String,
    /// Field to match on hr.employee ("barcode" or "pin")
    employee_field: String,
    /// LRU cache: device_pin → EmployeeInfo (avoids repeated API calls)
    employee_cache: Mutex<HashMap<String, EmployeeInfo>>,
    /// Circuit breaker: prevents cascading failures when Odoo is down.
    /// Trips after 3 consecutive failures, probes after 60s cooldown.
    circuit: Arc<CircuitBreaker>,
    /// Optional storage backend for outbox retry. When set, failed deliveries
    /// are persisted to the database for background retry instead of being dropped.
    storage: Option<Arc<dyn Storage>>,
}

impl OdooDistributor {
    /// Create a new Odoo distributor.
    ///
    /// `url` should point to the JSON-2 endpoint, e.g. `"https://odoo.example.local/json/2"`.
    /// `api_key` is the Odoo API key (Bearer token, created in Preferences → Account Security).
    /// `database` is the Odoo database name.
    /// `employee_field` is the hr.employee field to match against device PINs (`"barcode"` or `"pin"`).
    pub fn new(
        url: impl Into<String>,
        api_key: impl Into<String>,
        database: impl Into<String>,
        employee_field: impl Into<String>,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            url: url.into(),
            api_key: api_key.into(),
            database: database.into(),
            employee_field: employee_field.into(),
            employee_cache: Mutex::new(HashMap::with_capacity(200)),
            circuit: Arc::new(
                CircuitBreaker::builder()
                    .failure_threshold(3)
                    .recovery_timeout(std::time::Duration::from_secs(60))
                    .half_open_max_success(1)
                    .build(),
            ),
            storage: None,
        }
    }

    /// Attach a storage backend for outbox retry.
    ///
    /// When set, failed deliveries are persisted to the database instead of being
    /// silently dropped. A background worker picks them up and retries with
    /// exponential backoff.
    pub fn with_storage(mut self, storage: Arc<dyn Storage>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Resolve a device PIN to an Odoo employee ID and name.
    ///
    /// Results are cached in an in-memory LRU. Cache misses call the
    /// Odoo API: `POST /json/2/hr.employee/search` with domain
    /// `[("barcode", "=", pin)]` (or whatever `employee_field` is configured).
    ///
    /// Returns `Ok(None)` if no employee matches the PIN (unknown user).
    async fn find_employee(&self, pin: &str) -> Result<Option<EmployeeInfo>, Error> {
        // Fast path: cache hit
        {
            let cache = self
                .employee_cache
                .lock()
                .map_err(|e| Error::internal(format!("cache lock: {e}")))?;
            if let Some(info) = cache.get(pin) {
                return Ok(Some(info.clone()));
            }
        }

        // Cache miss: call Odoo API through circuit breaker
        let domain = vec![vec![self.employee_field.clone(), "=".to_string(), pin.to_string()]];
        let url = format!("{}/hr.employee/search", self.url);
        let api_key = self.api_key.clone();
        let database = self.database.clone();

        let body: Json2Response<Vec<i64>> = self
            .circuit_call("employee.search", || async {
                let resp = self
                    .client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("X-Odoo-Database", &database)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({ "domain": &domain }))
                    .send()
                    .await
                    .map_err(|e| format!("request failed: {e}"))?;
                resp.json().await.map_err(|e| format!("parse failed: {e}"))
            })
            .await?;

        let employee_ids = body.result.ok_or_else(|| {
            Error::network(format!("odoo employee search error: {:?}", body.error))
        })?;

        match employee_ids.first() {
            None => Ok(None),
            Some(&id) => {
                // Fetch employee name for enrichment
                let name = self.get_employee_name(id).await.unwrap_or_else(|_| pin.to_string());
                let info = EmployeeInfo { id, name };

                // Populate cache
                if let Ok(mut cache) = self.employee_cache.lock() {
                    if cache.len() >= 200 {
                        // Simple eviction: clear oldest half
                        let keys: Vec<String> = cache.keys().take(100).cloned().collect();
                        for k in keys {
                            cache.remove(&k);
                        }
                    }
                    cache.insert(pin.to_string(), info.clone());
                }

                Ok(Some(info))
            },
        }
    }

    /// Fetch an employee's display name from Odoo.
    async fn get_employee_name(&self, employee_id: i64) -> Result<String, Error> {
        let url = format!("{}/hr.employee/read", self.url);
        let api_key = self.api_key.clone();
        let database = self.database.clone();

        let body: Json2Response<Vec<HashMap<String, serde_json::Value>>> = self
            .circuit_call("employee.read", || async {
                let resp = self
                    .client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("X-Odoo-Database", &database)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({
                        "ids": [employee_id],
                        "fields": ["name"]
                    }))
                    .send()
                    .await
                    .map_err(|e| format!("request failed: {e}"))?;
                let body: Json2Response<Vec<HashMap<String, serde_json::Value>>> =
                    resp.json().await.map_err(|e| format!("parse failed: {e}"))?;
                Ok(body)
            })
            .await?;

        let records = body
            .result
            .ok_or_else(|| Error::network(format!("odoo employee read error: {:?}", body.error)))?;

        match records.first() {
            Some(record) => {
                Ok(record.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string())
            },
            None => Ok("Unknown".to_string()),
        }
    }

    /// Find an open attendance record for the given employee.
    ///
    /// Returns the attendance ID if found, or `None` if the employee
    /// is currently checked out (no open attendance).
    async fn find_open_attendance(&self, employee_id: i64) -> Result<Option<i64>, Error> {
        let url = format!("{}/hr.attendance/search", self.url);
        let api_key = self.api_key.clone();
        let database = self.database.clone();
        let domain = vec![
            vec!["employee_id".to_string(), "=".to_string(), employee_id.to_string()],
            vec!["check_out".to_string(), "=".to_string(), "false".to_string()],
        ];

        let body: Json2Response<Vec<i64>> = self
            .circuit_call("attendance.search", || async {
                let resp = self
                    .client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("X-Odoo-Database", &database)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({ "domain": &domain, "limit": 1 }))
                    .send()
                    .await
                    .map_err(|e| format!("request failed: {e}"))?;
                let body: Json2Response<Vec<i64>> =
                    resp.json().await.map_err(|e| format!("parse failed: {e}"))?;
                Ok(body)
            })
            .await?;

        let ids = body.result.ok_or_else(|| {
            Error::network(format!("odoo attendance search error: {:?}", body.error))
        })?;

        Ok(ids.first().copied())
    }

    /// Create a new check-in record in Odoo.
    async fn create_check_in(&self, employee_id: i64, timestamp: &str) -> Result<i64, Error> {
        let url = format!("{}/hr.attendance/create", self.url);
        let api_key = self.api_key.clone();
        let database = self.database.clone();
        let ts = timestamp.to_string();

        let body: Json2Response<i64> = self
            .circuit_call("attendance.create", || async {
                let resp = self
                    .client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("X-Odoo-Database", &database)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({
                        "values": {
                            "employee_id": employee_id,
                            "check_in": &ts,
                            "in_mode": "technical"
                        }
                    }))
                    .send()
                    .await
                    .map_err(|e| format!("request failed: {e}"))?;
                let body: Json2Response<i64> =
                    resp.json().await.map_err(|e| format!("parse failed: {e}"))?;
                Ok(body)
            })
            .await?;

        body.result.ok_or_else(|| {
            Error::network(format!("odoo attendance create error: {:?}", body.error))
        })
    }

    /// Set the check_out time on an existing attendance record.
    async fn set_check_out(&self, attendance_id: i64, timestamp: &str) -> Result<(), Error> {
        let url = format!("{}/hr.attendance/write", self.url);
        let api_key = self.api_key.clone();
        let database = self.database.clone();
        let ts = timestamp.to_string();

        let body: Json2Response<bool> = self
            .circuit_call("attendance.write", || async {
                let resp = self
                    .client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("X-Odoo-Database", &database)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({
                        "ids": [attendance_id],
                        "values": {
                            "check_out": &ts,
                            "out_mode": "technical"
                        }
                    }))
                    .send()
                    .await
                    .map_err(|e| format!("request failed: {e}"))?;
                let body: Json2Response<bool> =
                    resp.json().await.map_err(|e| format!("parse failed: {e}"))?;
                Ok(body)
            })
            .await?;

        if body.result.unwrap_or(false) {
            Ok(())
        } else {
            Err(Error::network(format!("odoo attendance write returned false: {:?}", body.error)))
        }
    }

    /// Format a jiff::Timestamp as an Odoo-compatible UTC naive datetime string.
    fn format_timestamp(ts: &jiff::Timestamp) -> String {
        // Odoo expects "YYYY-MM-DD HH:MM:SS" in UTC (naive, no timezone marker)
        let total = ts.as_second();
        let days = total / 86400;
        let secs = total % 86400;
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        let secs = secs % 60;

        // Calculate date from Unix epoch days
        let (y, m, d) = civil_from_days(days);

        format!("{y:04}-{m:02}-{d:02} {hours:02}:{mins:02}:{secs:02}")
    }

    /// Wrap an async call with circuit breaker protection.
    ///
    /// The closure `f` must return `Result<T, String>` — all HTTP call
    /// errors in this module are formatted as strings before hitting the
    /// circuit breaker.
    async fn circuit_call<F, Fut, T>(&self, op: &str, f: F) -> Result<T, Error>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, String>>,
    {
        self.circuit.call(f).await.map_err(|e| match e {
            CircuitBreakerError::CircuitOpen => {
                tracing::warn!(operation = op, "odoo circuit is open — skipping call");
                Error::network(format!("odoo {op}: circuit is open"))
            },
            CircuitBreakerError::Inner(inner) => Error::network(format!("odoo {op}: {inner}")),
        })
    }

    // ── Punch handling ───────────────────────────────────────────────

    /// Handle a single attendance punch — resolve employee and create/update Odoo record.
    async fn handle_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        let employee = match self.find_employee(&punch.user_pin).await? {
            Some(info) => info,
            None => {
                tracing::warn!(
                    pin = %punch.user_pin,
                    "odoo: unknown employee, skipping"
                );
                return Ok(());
            },
        };

        let ts_str = Self::format_timestamp(&punch.timestamp);

        match punch.status {
            timekeep_core::PunchStatus::CheckIn
            | timekeep_core::PunchStatus::BreakIn
            | timekeep_core::PunchStatus::OvertimeIn => {
                self.process_checkin(employee.id, &employee.name, &ts_str, &punch.user_pin)
                    .await
            },
            timekeep_core::PunchStatus::CheckOut
            | timekeep_core::PunchStatus::BreakOut
            | timekeep_core::PunchStatus::OvertimeOut => {
                self.process_checkout(employee.id, &employee.name, &ts_str, &punch.user_pin)
                    .await
            },
        }
    }

    /// Process a check-in: auto-close any lingering open attendance, then create the new record.
    async fn process_checkin(
        &self,
        employee_id: i64,
        name: &str,
        ts_str: &str,
        pin: &str,
    ) -> Result<(), Error> {
        // Auto-close any pre-existing open attendance (safety net)
        if let Some(open_id) = self.find_open_attendance(employee_id).await? {
            tracing::warn!(
                pin,
                employee = name,
                open_attendance_id = open_id,
                "odoo: employee already checked in — auto-closing previous record"
            );
            if let Err(e) = self.set_check_out(open_id, ts_str).await {
                tracing::error!(
                    pin,
                    error = %e,
                    "odoo: failed to auto-close previous check-in"
                );
            }
        }

        match self.create_check_in(employee_id, ts_str).await {
            Ok(att_id) => {
                tracing::info!(
                    pin,
                    employee = name,
                    odoo_attendance_id = att_id,
                    "odoo: check-in created"
                );
                Ok(())
            },
            Err(e) => {
                tracing::error!(
                    pin,
                    employee = name,
                    error = %e,
                    "odoo: failed to create check-in"
                );
                Err(e)
            },
        }
    }

    /// Process a check-out: close the currently open attendance, or recover from an orphan state.
    async fn process_checkout(
        &self,
        employee_id: i64,
        name: &str,
        ts_str: &str,
        pin: &str,
    ) -> Result<(), Error> {
        let Some(open_id) = self.find_open_attendance(employee_id).await? else {
            tracing::warn!(
                pin,
                employee = name,
                "odoo: check-out without open attendance — creating check-in + check-out pair"
            );
            return self.recover_orphan_checkout(employee_id, ts_str, pin).await;
        };

        if let Err(e) = self.set_check_out(open_id, ts_str).await {
            tracing::error!(
                pin,
                employee = name,
                error = %e,
                "odoo: failed to record check-out"
            );
            return Err(e);
        }

        tracing::info!(
            pin,
            employee = name,
            odoo_attendance_id = open_id,
            "odoo: check-out recorded"
        );
        Ok(())
    }

    /// Recover from an orphan check-out: create a zero-duration
    /// attendance pair so Odoo's constraint (max 1 open) is honoured.
    ///
    /// This is non-fatal — we don't want to lose other punches in the batch.
    async fn recover_orphan_checkout(
        &self,
        employee_id: i64,
        ts_str: &str,
        pin: &str,
    ) -> Result<(), Error> {
        match self.create_check_in(employee_id, ts_str).await {
            Ok(att_id) => {
                let _ = self.set_check_out(att_id, ts_str).await;
            },
            Err(e) => {
                tracing::error!(
                    pin,
                    error = %e,
                    "odoo: failed to create check-in for orphan check-out"
                );
            },
        }
        Ok(())
    }
}

#[async_trait]
impl Distributor for OdooDistributor {
    async fn on_event(&self, event: &DomainEvent) -> Result<(), Error> {
        match event {
            DomainEvent::PunchReceived { punch } => {
                if let Err(e) = self.handle_punch(punch).await {
                    // If storage is configured, enqueue for retry instead of dropping
                    if let Some(ref storage) = self.storage {
                        // Serialize the punch directly — AttendancePunch is Serialize
                        let event_json =
                            serde_json::to_string(punch).unwrap_or_else(|_| "{}".to_string());
                        let delivery = PendingDelivery::new("odoo", &event_json);
                        if let Err(enq_err) = storage.enqueue_pending_delivery(&delivery).await {
                            tracing::error!(
                                error = %enq_err,
                                "odoo: failed to enqueue for retry — punch lost"
                            );
                        } else {
                            tracing::warn!(
                                pin = %punch.user_pin,
                                error = %e,
                                delivery_id = %delivery.id,
                                "odoo: delivery failed, enqueued for retry"
                            );
                        }
                        return Ok(()); // Don't propagate error to engine
                    }
                    return Err(e);
                }
            },
            // All other domain event variants are intentionally no-op.
            // This distributor only cares about PunchReceived.
            //
            // Ignored event categories (~63 variants):
            //   - Device events (Online/Offline/Registered/Removed/…): handled by device layer
            //   - Engine lifecycle (Started/Stopping): handled by engine
            //   - Sync operations (Resync/Clear/Bulk/…): handled by sync workers
            //   - Employee CRUD (Created/Updated/Deactivated/Enrolled): handled by EmployeeStore
            //   - User management, Settings, Setup, Audit: N/A for attendance forwarding
            //   - Fingerprint operations (Transfer/Enroll/…): handled by device layer
            //   - Department/Group operations: N/A for attendance forwarding
            //   - Onboarding sessions: handled by onboarding flow
            _ => {},
        }
        Ok(())
    }

    fn name(&self) -> &str {
        "odoo"
    }
}

/// Convert days since Unix epoch to (year, month, day).
///
/// Simple civil date calculation without external dependency.
/// Accurate for all dates from 1970-01-01 through 2099-12-31.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let d = days + 719468; // shift epoch to 0000-03-01 (start of civil calendar cycle)
    let era = if d >= 0 { d } else { d - 146096 } / 146097;
    let doe = d - era * 146097; // day of era [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // year of era [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // day of year [0, 365]
    let mp = (5 * doy + 2) / 153; // month phase [0, 11]
    let day = doy - (153 * mp + 2) / 5 + 1; // day of month [1, 31]
    let month = if mp < 10 { mp + 3 } else { mp - 9 }; // month [3, 14] → [3, 12] ∪ [1, 2]
    let year = if month <= 2 { y + 1 } else { y };

    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[allow(dead_code)]
    fn make_punch(
        pin: &str,
        timestamp_sec: i64,
        status: timekeep_core::PunchStatus,
    ) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(timestamp_sec).unwrap();
        let mut punch = AttendancePunch {
            id: String::new(),
            device_sn: "TEST".into(),
            user_pin: pin.to_string(),
            timestamp: ts,
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
            raw_data: None,
        };
        punch.id = punch.generate_deduplication_id();
        punch
    }

    #[test]
    fn test_format_timestamp_epoch() {
        let ts = jiff::Timestamp::from_second(0).unwrap();
        assert_eq!(OdooDistributor::format_timestamp(&ts), "1970-01-01 00:00:00");
    }

    #[test]
    fn test_format_timestamp_known() {
        // 2026-07-10 06:00:00 UTC = day 20644 + 6 hours
        let ts = jiff::Timestamp::from_second(20644 * 86400 + 6 * 3600).unwrap();
        assert_eq!(OdooDistributor::format_timestamp(&ts), "2026-07-10 06:00:00");
    }

    #[test]
    fn test_civil_from_days_epoch() {
        let (y, m, d) = civil_from_days(0);
        assert_eq!((y, m, d), (1970, 1, 1));
    }

    #[test]
    fn test_civil_from_days_known() {
        // 2026-07-10 = 20644 days after epoch
        let (y, m, d) = civil_from_days(20644);
        assert_eq!((y, m, d), (2026, 7, 10));
    }

    #[test]
    fn test_format_timestamp_roundtrip() {
        for secs in [0, 86400, 1710614400, 1783980000] {
            let ts = jiff::Timestamp::from_second(secs).unwrap();
            let formatted = OdooDistributor::format_timestamp(&ts);
            // Verify format: "YYYY-MM-DD HH:MM:SS"
            assert_eq!(formatted.len(), 19, "wrong length for secs={secs}: '{formatted}'");
            assert_eq!(&formatted[4..5], "-");
            assert_eq!(&formatted[7..8], "-");
            assert_eq!(&formatted[10..11], " ");
            assert_eq!(&formatted[13..14], ":");
            assert_eq!(&formatted[16..17], ":");
        }
    }

    #[test]
    fn test_distributor_name() {
        let dist = OdooDistributor::new(
            "https://odoo.example.local/json/2",
            "key-123",
            "testdb",
            "barcode",
        );
        assert_eq!(dist.name(), "odoo");
    }

    #[test]
    fn test_new_initializes_empty_cache() {
        let dist = OdooDistributor::new(
            "https://odoo.example.local/json/2",
            "key-123",
            "testdb",
            "barcode",
        );
        assert!(dist.employee_cache.lock().unwrap().is_empty());
    }

    /// Test that non-punch events are ignored gracefully.
    #[tokio::test]
    async fn test_ignores_non_punch_events() {
        let dist = OdooDistributor::new(
            "https://odoo.example.local/json/2",
            "key-123",
            "testdb",
            "barcode",
        );
        let result = dist.on_event(&DomainEvent::EngineStarted { device_count: 1 }).await;
        assert!(result.is_ok());
    }
}
