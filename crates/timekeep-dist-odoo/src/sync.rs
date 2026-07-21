//! Odoo employee sync — pulls employees and departments from Odoo
//! into Timekeep's EmployeeStore and DepartmentStore.
//!
//! This is NOT a distributor. It pulls master data IN rather than
//! pushing events OUT. It reuses the same Odoo JSON-2 API connection
//! (URL, API key, database) as the distributor.
//!
//! ## Sync flow
//!
//! 1. Pull all `hr.department` records from Odoo, upsert into Timekeep.
//! 2. Pull all `hr.employee` records with their PIN, name, department, active status.
//! 3. PINs originate from Odoo's auto-generated `device_id_num`. No fallbacks.
//! 4. Upsert employees by `external_id` (Odoo employee ID), emitting events.
//! 5. Auto-create `DeviceEnrollment` records for matching device groups.
//! 6. Publish `EmployeeSyncRequested` for the push handler to deliver to devices.
//!
//! ## Webhook integration
//!
//! The primary sync mechanism is the Odoo webhook, which triggers immediate
//! sync on employee create/update/archive. This polling loop is a **safety net**
//! that catches missed events and handles the initial bulk import.
//!
//! ## Sync-Now Trigger
//!
//! Call `trigger_sync_now()` to wake the polling loop immediately. Used by
//! the "Sync Now" button in the dashboard and the integration API.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use serde_json::json;
use tokio::sync::Mutex;

use timekeep_circuit::{CircuitBreaker, CircuitBreakerError};
use timekeep_core::{
    Error,
    events::{DomainEvent, EventBus},
    model::department::Department,
    model::employee::Employee,
    model::enrollment::{BiometricType, DeviceEnrollment},
    traits::employee_store::EmployeeStore,
    traits::storage::Storage,
    traits::{ProviderSyncStats, SyncProvider, SyncProviderStatus},
};

use crate::json2::Json2Response;

// ─── Sync State ──────────────────────────────────────────────────────

/// Cached sync status for API consumption.
#[derive(Debug, Clone, Default)]
pub struct SyncStatus {
    pub last_sync_at: Option<i64>,
    pub last_error: Option<String>,
    pub last_stats: Option<SyncStats>,
    /// Whether a sync is currently in progress.
    pub running: bool,
}

/// Internal sync state with last-error tracking.
struct SyncState {
    last_sync_at: Option<i64>,
    last_error: Option<String>,
    last_stats: Option<SyncStats>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self { last_sync_at: None, last_error: None, last_stats: None }
    }
}

// ─── Public Types ────────────────────────────────────────────────────

/// Synchronises employees and departments from Odoo into Timekeep.
pub struct OdooEmployeeSync {
    client: reqwest::Client,
    url: String,
    api_key: String,
    database: String,
    employee_field: String,
    employees: Arc<dyn EmployeeStore>,
    storage: Option<Arc<dyn Storage>>,
    event_bus: EventBus,
    circuit: Arc<CircuitBreaker>,
    /// Set to true by `trigger_sync_now()`. The periodic loop checks this flag
    /// and runs a sync immediately instead of waiting for the interval.
    sync_now: AtomicBool,
    /// Cached sync status for API consumption.
    state: Mutex<SyncState>,
}

impl OdooEmployeeSync {
    pub fn new(
        url: impl Into<String>,
        api_key: impl Into<String>,
        database: impl Into<String>,
        employee_field: impl Into<String>,
        employees: Arc<dyn EmployeeStore>,
        storage: Option<Arc<dyn Storage>>,
        event_bus: EventBus,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            url: url.into(),
            api_key: api_key.into(),
            database: database.into(),
            employee_field: employee_field.into(),
            employees,
            storage,
            event_bus,
            circuit: Arc::new(
                CircuitBreaker::builder()
                    .failure_threshold(3)
                    .recovery_timeout(std::time::Duration::from_secs(60))
                    .half_open_max_success(1)
                    .build(),
            ),
            sync_now: AtomicBool::new(false),
            state: Mutex::new(SyncState::default()),
        }
    }

    // ── Public API ──────────────────────────────────────────────────

    /// Trigger an immediate sync by setting the wake flag.
    ///
    /// The periodic loop checks this flag on each iteration. If set,
    /// it runs a sync immediately regardless of the interval timer.
    pub fn trigger_sync_now(&self) {
        self.sync_now.store(true, Ordering::SeqCst);
        tracing::info!("odoo sync: manual sync triggered");
    }

    /// Return a snapshot of the current sync status.
    pub async fn sync_status(&self) -> SyncStatus {
        let guard = self.state.lock().await;
        let is_now = self.sync_now.load(Ordering::SeqCst);
        SyncStatus {
            last_sync_at: guard.last_sync_at,
            last_error: guard.last_error.clone(),
            last_stats: guard.last_stats.clone(),
            running: is_now,
        }
    }

    /// Run periodic sync, checking for manual triggers.
    pub async fn run_periodic(&self, interval_secs: u64) {
        loop {
            // Check for manual trigger or wait for interval
            if self.sync_now.swap(false, Ordering::SeqCst) {
                tracing::info!("odoo sync: manual trigger — running now");
            } else {
                tracing::info!(interval_secs, "odoo sync: sleeping");
                tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
            }

            tracing::info!("odoo sync: starting pull");
            match self.sync_all().await {
                Ok(stats) => self.update_state_success(stats).await,
                Err(e) => self.update_state_error(e).await,
            }
        }
    }

    // ── Sync Pipeline ───────────────────────────────────────────────

    pub async fn sync_all(&self) -> Result<SyncStats, Error> {
        let mut stats = SyncStats::default();

        if let Some(ref storage) = self.storage {
            match self.pull_departments(storage.as_ref()).await {
                Ok(s) => stats.departments = s,
                Err(e) => {
                    tracing::warn!(error = %e, "odoo sync: department pull failed, continuing")
                },
            }
        }

        stats.employees = self.pull_employees().await.map_err(|e| {
            tracing::error!(error = %e, "odoo sync: employee pull failed");
            e
        })?;

        // Auto-create enrollments for matching device groups, then push to devices
        if let Some(ref storage) = self.storage {
            if let Err(e) = self.auto_assign_to_groups(storage.as_ref()).await {
                tracing::warn!(error = %e, "odoo sync: device group auto-assignment failed");
            }
        }

        tracing::info!(
            depts_created = stats.departments.created,
            depts_updated = stats.departments.updated,
            emps_created = stats.employees.created,
            emps_updated = stats.employees.updated,
            emps_linked = stats.employees.linked,
            emps_skipped = stats.employees.skipped,
            "odoo sync: complete"
        );
        Ok(stats)
    }

    async fn update_state_success(&self, stats: SyncStats) {
        let mut guard = self.state.lock().await;
        guard.last_sync_at = Some(jiff::Timestamp::now().as_millisecond());
        guard.last_error = None;
        guard.last_stats = Some(stats);
    }

    async fn update_state_error(&self, error: Error) {
        let mut guard = self.state.lock().await;
        guard.last_error = Some(error.to_string());
        tracing::error!(error = %error, "odoo sync: failed");
    }

    // ── Department Sync ─────────────────────────────────────────────

    async fn pull_departments(&self, store: &dyn Storage) -> Result<DeptSyncStats, Error> {
        let url = format!("{}/hr.department/search", self.url);
        let search_body: Json2Response<Vec<i64>> = circuit_call(
            &self.circuit,
            &self.client,
            "hr.department.search",
            &url,
            &self.api_key,
            &self.database,
            &json!({ "domain": Vec::<Vec<String>>::new() }),
        )
        .await?;

        let ids = search_body.result.unwrap_or_default();
        if ids.is_empty() {
            return Ok(DeptSyncStats::default());
        }

        let read_url = format!("{}/hr.department/read", self.url);
        let read_body: Json2Response<Vec<HashMap<String, serde_json::Value>>> = circuit_call(
            &self.circuit,
            &self.client,
            "hr.department.read",
            &read_url,
            &self.api_key,
            &self.database,
            &json!({ "ids": &ids, "fields": ["name"] }),
        )
        .await?;

        let records = read_body.result.ok_or_else(|| {
            Error::network(format!("odoo department read error: {:?}", read_body.error))
        })?;

        let mut stats = DeptSyncStats::default();
        for record in &records {
            let name = record.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown");
            match store.get_department_by_name(name).await {
                Ok(Some(_)) => stats.updated += 1,
                _ => {
                    let dept = Department::new(name, None);
                    if let Err(e) = store.create_department(&dept).await {
                        tracing::warn!(name, error = %e, "odoo sync: failed to create department");
                    } else {
                        stats.created += 1;
                    }
                },
            }
        }
        Ok(stats)
    }

    // ── Employee Sync ───────────────────────────────────────────────

    async fn pull_employees(&self) -> Result<EmpSyncStats, Error> {
        let records = self.fetch_employee_records().await?;
        let mut stats = EmpSyncStats::default();

        for record in &records {
            self.upsert_single_employee(record, &mut stats).await;
        }

        Ok(stats)
    }

    async fn fetch_employee_records(
        &self,
    ) -> Result<Vec<HashMap<String, serde_json::Value>>, Error> {
        let fields = vec![
            "name".to_string(),
            self.employee_field.clone(),
            "department_id".to_string(),
            "active".to_string(),
        ];

        let url = format!("{}/hr.employee/search", self.url);
        let search_body: Json2Response<Vec<i64>> = circuit_call(
            &self.circuit,
            &self.client,
            "hr.employee.search",
            &url,
            &self.api_key,
            &self.database,
            &json!({ "domain": Vec::<Vec<String>>::new() }),
        )
        .await?;

        let ids = search_body.result.unwrap_or_default();
        if ids.is_empty() {
            tracing::info!("odoo sync: no employees found");
            return Ok(Vec::new());
        }

        let read_url = format!("{}/hr.employee/read", self.url);
        let read_body: Json2Response<Vec<HashMap<String, serde_json::Value>>> = circuit_call(
            &self.circuit,
            &self.client,
            "hr.employee.read",
            &read_url,
            &self.api_key,
            &self.database,
            &json!({ "ids": &ids, "fields": &fields }),
        )
        .await?;

        let records = read_body.result.ok_or_else(|| {
            Error::network(format!("odoo employee read error: {:?}", read_body.error))
        })?;
        Ok(records)
    }

    async fn upsert_single_employee(
        &self,
        record: &HashMap<String, serde_json::Value>,
        stats: &mut EmpSyncStats,
    ) {
        let odoo_id = record.get("id").and_then(|v| v.as_i64()).map(|id| id.to_string());
        let name = record.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown");
        let pin = resolve_pin_from_record(record, &self.employee_field);

        if pin.is_empty() {
            tracing::debug!(odoo_id = ?odoo_id, name, "odoo sync: no PIN — skipping");
            stats.skipped += 1;
            return;
        }

        let active = record.get("active").and_then(|v| v.as_bool()).unwrap_or(true);
        let department_name = record
            .get("department_id")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.get(1))
            .and_then(|v| v.as_str())
            .map(String::from);

        let odoo_id_str = odoo_id.unwrap_or_default();

        match self.employees.find_employee_by_external_id(&odoo_id_str).await {
            Ok(Some(existing)) => {
                self.update_if_changed(
                    existing,
                    name,
                    &pin,
                    &department_name,
                    active,
                    &odoo_id_str,
                    stats,
                )
                .await;
            },
            Ok(None) => {
                self.link_or_create_employee(
                    &pin,
                    name,
                    &department_name,
                    active,
                    &odoo_id_str,
                    stats,
                )
                .await;
            },
            Err(e) => {
                tracing::warn!(odoo_id = %odoo_id_str, error = %e, "odoo sync: employee lookup failed");
            },
        }
    }

    async fn update_if_changed(
        &self,
        existing: Employee,
        name: &str,
        pin: &str,
        department_name: &Option<String>,
        active: bool,
        odoo_id_str: &str,
        stats: &mut EmpSyncStats,
    ) {
        let name_changed = existing.name != name;
        let dept_changed = existing.department != *department_name;
        let pin_changed = existing.pin != pin;
        let status_changed = existing.active != active;

        if !name_changed && !dept_changed && !pin_changed && !status_changed {
            return;
        }

        let mut updated = existing.clone();
        updated.name = name.to_string();
        updated.pin = pin.to_string();
        updated.department = department_name.clone();
        updated.active = active;
        updated.updated_at = jiff::Timestamp::now();

        if let Err(e) = self.employees.update_employee(&updated).await {
            tracing::warn!(pin = %pin, odoo_id = %odoo_id_str, error = %e, "odoo sync: update failed");
            return;
        }

        stats.updated += 1;
        self.event_bus.publish(DomainEvent::EmployeeUpdated {
            id: existing.id.to_string(),
            pin: pin.to_string(),
            name: name.to_string(),
        });

        if !active {
            self.event_bus
                .publish(DomainEvent::EmployeeRemoveRequested { employee_pin: pin.to_string() });
            tracing::info!(pin = %pin, odoo_id = %odoo_id_str, "odoo sync: deactivated — queued device removal");
        }
    }

    async fn link_or_create_employee(
        &self,
        pin: &str,
        name: &str,
        department_name: &Option<String>,
        active: bool,
        odoo_id_str: &str,
        stats: &mut EmpSyncStats,
    ) {
        let mut emp =
            Employee::new(pin, name, department_name.clone(), Some(odoo_id_str.to_string()));
        if !active {
            emp.deactivate();
        }
        match self.employees.create_employee(&emp).await {
            Ok(()) => {
                stats.created += 1;
                self.event_bus.publish(DomainEvent::EmployeeCreated {
                    pin: pin.to_string(),
                    name: name.to_string(),
                });
            },
            Err(e) => tracing::warn!(pin = %pin, error = %e, "odoo sync: create failed"),
        }
    }

    // ── Device Group Auto-Assignment ────────────────────────────────

    /// Create `DeviceEnrollment` records for employees matching device group scopes,
    /// then publish `EmployeeSyncRequested` for the push handler.
    ///
    /// For each device group:
    /// - Empty `department_ids` → all active employees get enrolled
    /// - Specific `department_ids` → only employees in those departments
    ///
    /// Skips employees that already have an enrollment on the device
    /// (idempotent — safe to call after every sync).
    async fn auto_assign_to_groups(&self, store: &dyn Storage) -> Result<(), Error> {
        let groups = store.list_device_groups().await?;
        if groups.is_empty() {
            return Ok(());
        }

        let all_employees = self
            .employees
            .list_employees(&timekeep_core::query::ListParams {
                limit: 10_000,
                ..Default::default()
            })
            .await
            .map_err(|e| {
                Error::internal(format!("failed to list employees for group sync: {e}"))
            })?;

        for group in &groups {
            let devices = store.list_devices_in_group(&group.id.0).await?;
            if devices.is_empty() {
                continue;
            }

            let matching = filter_employees_by_group(&all_employees.items, group);
            if matching.is_empty() {
                continue;
            }

            tracing::info!(
                group = %group.name,
                employees = matching.len(),
                devices = devices.len(),
                departments = ?group.department_ids,
                "odoo sync: auto-assigning employees to device group"
            );

            for emp in &matching {
                let pin = emp.pin.clone();
                self.enroll_in_group_devices(emp, &devices).await;
                self.event_bus.publish(DomainEvent::EmployeeSyncRequested { employee_pin: pin });
            }
        }

        Ok(())
    }

    /// Create a `DeviceEnrollment` for each device in the group where the employee
    /// isn't already enrolled.
    async fn enroll_in_group_devices(
        &self,
        emp: &Employee,
        devices: &[timekeep_core::model::DeviceConfig],
    ) {
        for device in devices {
            // Guard: skip if already enrolled
            if let Ok(Some(_)) =
                self.employees.find_enrollment(&emp.id, &device.serial_number).await
            {
                continue;
            }

            let enrollment = DeviceEnrollment::new(
                emp.id.clone(),
                &device.serial_number,
                &emp.pin,
                vec![BiometricType::Fingerprint],
            );

            if let Err(e) = self.employees.create_enrollment(&enrollment).await {
                tracing::warn!(
                    pin = %emp.pin,
                    device = %device.serial_number,
                    error = %e,
                    "odoo sync: failed to create enrollment"
                );
            } else {
                tracing::info!(
                    pin = %emp.pin,
                    device = %device.serial_number,
                    "odoo sync: enrollment created"
                );
            }
        }
    }
}

// ─── Free Functions ─────────────────────────────────────────────────

/// Filter employees that match a device group's department scope.
fn filter_employees_by_group<'a>(
    all: &'a [Employee],
    group: &timekeep_core::model::device_group::DeviceGroup,
) -> Vec<&'a Employee> {
    all.iter().filter(|emp| emp.active && employee_matches_group(emp, group)).collect()
}

/// Check whether an employee belongs to a device group's department scope.
fn employee_matches_group(
    emp: &Employee,
    group: &timekeep_core::model::device_group::DeviceGroup,
) -> bool {
    if group.department_ids.is_empty() {
        return true; // Global group — all employees
    }
    emp.department.as_ref().is_some_and(|dept| group.department_ids.iter().any(|d| d == dept))
}

fn resolve_pin_from_record(record: &HashMap<String, serde_json::Value>, field: &str) -> String {
    match record.get(field) {
        Some(v) if v.is_string() => v.as_str().unwrap_or("").to_string(),
        Some(v) if v.is_number() => v.as_i64().map(|n| n.to_string()).unwrap_or_default(),
        _ => String::new(),
    }
}

async fn circuit_call<T: serde::de::DeserializeOwned>(
    circuit: &CircuitBreaker,
    client: &reqwest::Client,
    operation: &str,
    url: &str,
    api_key: &str,
    database: &str,
    body: &serde_json::Value,
) -> Result<T, Error> {
    let op = operation.to_string();
    let u = url.to_string();
    let ak = api_key.to_string();
    let db = database.to_string();
    let b = body.clone();

    circuit
        .call(|| async {
            let resp = client
                .post(&u)
                .header("Authorization", format!("Bearer {}", ak))
                .header("X-Odoo-Database", &db)
                .header("Content-Type", "application/json")
                .json(&b)
                .send()
                .await
                .map_err(|e| format!("request failed: {e}"))?;
            resp.json().await.map_err(|e| format!("parse failed: {e}"))
        })
        .await
        .map_err(|e| match e {
            CircuitBreakerError::CircuitOpen => {
                tracing::warn!(operation = op, "odoo circuit is open — skipping call");
                Error::network(format!("odoo {op}: circuit is open"))
            },
            CircuitBreakerError::Inner(inner) => Error::network(format!("odoo {op}: {inner}")),
        })
}

// ─── Stats DTOs ─────────────────────────────────────────────────────

#[derive(Debug, Default, Clone)]
pub struct SyncStats {
    pub departments: DeptSyncStats,
    pub employees: EmpSyncStats,
}

#[derive(Debug, Default, Clone)]
pub struct DeptSyncStats {
    pub created: u32,
    pub updated: u32,
}

#[derive(Debug, Default, Clone)]
pub struct EmpSyncStats {
    pub created: u32,
    pub updated: u32,
    pub linked: u32,
    /// Employees without a device_id_num in Odoo.
    pub skipped: u32,
}

// ─── SyncProvider impl ────────────────────────────────────────────────

#[async_trait::async_trait]
impl SyncProvider for OdooEmployeeSync {
    fn provider_key(&self) -> &str {
        "odoo"
    }

    fn provider_name(&self) -> &str {
        "Odoo"
    }

    async fn status(&self) -> SyncProviderStatus {
        let inner = self.sync_status().await;
        let stats = ProviderSyncStats {
            last_sync_at: inner.last_sync_at,
            last_error: inner.last_error,
            employees_synced: inner
                .last_stats
                .as_ref()
                .map(|s| {
                    s.employees.created
                        + s.employees.updated
                        + s.employees.linked
                        + s.employees.skipped
                })
                .unwrap_or(0),
            created: inner.last_stats.as_ref().map(|s| s.employees.created).unwrap_or(0),
            updated: inner.last_stats.as_ref().map(|s| s.employees.updated).unwrap_or(0),
            skipped: inner.last_stats.as_ref().map(|s| s.employees.skipped).unwrap_or(0),
            departments_created: inner
                .last_stats
                .as_ref()
                .map(|s| s.departments.created)
                .unwrap_or(0),
            departments_updated: inner
                .last_stats
                .as_ref()
                .map(|s| s.departments.updated)
                .unwrap_or(0),
        };
        SyncProviderStatus::new(self.provider_key(), self.provider_name(), stats)
    }

    fn trigger_sync(&self) {
        OdooEmployeeSync::trigger_sync_now(self);
    }
}
