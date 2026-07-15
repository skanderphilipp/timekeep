//! Shared test utilities for the timekeep workspace.
//!
//! This module is only compiled when the `test-utils` feature is enabled,
//! keeping production builds lean. It provides:
//!
//! - [`PunchRow`] and [`TimestampRow`] — shared SQL row types for storage impls
//! - [`make_test_punch`] — canonical test punch factory
//! - [`NoopStorage`] — base implementation of `Storage` with no-op defaults
//!
//! ## Usage
//!
//! ```toml
//! [dev-dependencies]
//! timekeep-core = { workspace = true, features = ["test-utils"] }
//! ```

use crate::model::{AttendancePunch, Device, DeviceConfig};
use crate::traits::Storage;
use crate::{Error, PunchFilter, PunchStatus, VerifyMode};
use async_trait::async_trait;

// ─── Shared SQL row types ───────────────────────────────────────────

/// Row type for `attendance_punches` table.
///
/// Used by both `timekeep-storage-sqlite` and `timekeep-storage-postgres`
/// to deserialize query results. Previously duplicated in each crate.
#[derive(Debug, sqlx::FromRow)]
pub struct PunchRow {
    pub id: String,
    pub device_sn: String,
    pub user_pin: String,
    pub timestamp: String,
    pub status: i32,
    pub verify_mode: Option<i32>,
    pub work_code: Option<String>,
    pub raw_data: Option<String>,
}

impl PunchRow {
    /// Convert a database row into a domain `AttendancePunch`.
    ///
    /// Timestamps are stored as Unix epoch seconds (string in SQLite, BIGINT in Postgres).
    /// The `raw_data` field may contain the original wire-format punch for audit.
    pub fn into_punch(self) -> Result<AttendancePunch, Error> {
        let secs: i64 = self.timestamp.parse().map_err(|e| {
            Error::storage(format!("invalid punch timestamp '{}': {e}", self.timestamp))
        })?;

        let ts = jiff::Timestamp::from_second(secs)
            .map_err(|e| Error::storage(format!("out-of-range punch timestamp {secs}: {e}")))?;

        let status = PunchStatus::try_from(self.status).unwrap_or(PunchStatus::CheckIn);
        let verify = self.verify_mode.map(VerifyMode::from).unwrap_or(VerifyMode::Fingerprint);

        let mut punch = AttendancePunch {
            id: self.id.clone(),
            device_sn: self.device_sn,
            user_pin: self.user_pin,
            timestamp: ts,
            status,
            verify_mode: verify,
            work_code: self.work_code,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: self.raw_data,
        };
        punch.id = self.id;
        Ok(punch)
    }
}

/// Row type for single-column timestamp queries.
#[derive(Debug, sqlx::FromRow)]
pub struct TimestampRow {
    pub timestamp: String,
}

// ─── Canonical test punch factory ───────────────────────────────────

/// Create a valid `AttendancePunch` with a deterministic deduplication ID.
///
/// This is the canonical factory used across all test modules.
/// Previously duplicated in 8 files with 6 different signatures.
pub fn make_test_punch(
    pin: &str,
    device_sn: &str,
    timestamp_sec: i64,
    status: PunchStatus,
) -> AttendancePunch {
    let ts = jiff::Timestamp::from_second(timestamp_sec).expect("valid test timestamp");
    let mut punch = AttendancePunch {
        id: String::new(),
        device_sn: device_sn.to_string(),
        user_pin: pin.to_string(),
        timestamp: ts,
        status,
        verify_mode: VerifyMode::Fingerprint,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        raw_data: None,
    };
    punch.id = punch.generate_deduplication_id();
    punch
}

// ─── NoopStorage base ───────────────────────────────────────────────

/// A no-op `Storage` implementation that returns empty/default for every method.
///
/// Test mocks can embed this and override only the 1-2 methods they need,
/// rather than re-implementing all 9 trait methods. Previously, 5 separate
/// test mock structs each copy-pasted the full trait impl (~200 lines total).
#[derive(Clone)]
pub struct NoopStorage;

#[async_trait]
impl Storage for NoopStorage {
    async fn store_punch(&self, _punch: &AttendancePunch) -> Result<(), Error> {
        Ok(())
    }
    async fn store_punches(&self, _punches: &[AttendancePunch]) -> Result<u64, Error> {
        Ok(0)
    }
    async fn query_punches(&self, _filter: &PunchFilter) -> Result<Vec<AttendancePunch>, Error> {
        Ok(vec![])
    }
    async fn upsert_device(&self, _device: &Device) -> Result<(), Error> {
        Ok(())
    }
    async fn upsert_device_config(&self, _config: &DeviceConfig) -> Result<(), Error> {
        Ok(())
    }
    async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, Error> {
        Ok(vec![])
    }
    async fn delete_device_config(&self, _serial_number: &str) -> Result<(), Error> {
        Ok(())
    }
    async fn latest_punch_for_device(
        &self,
        _device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        Ok(None)
    }
    async fn punch_exists(&self, _dedup_id: &str) -> Result<bool, Error> {
        Ok(false)
    }
    async fn upsert_user(
        &self,
        device_sn: &str,
        pin: &str,
        name: &str,
        privilege: Option<i32>,
        card_number: Option<&str>,
        group_num: Option<i32>,
        timezone: Option<i32>,
        password_hash: Option<&str>,
    ) -> Result<(), Error> {
        let _ = (device_sn, pin, name, privilege, card_number, group_num, timezone, password_hash);
        Ok(())
    }
    async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let _ = pin;
        Ok(None)
    }
}

// ─── NoopEmployeeStore ──────────────────────────────────────────

/// A no-op `EmployeeStore` that returns empty/default for every method.
#[derive(Clone)]
pub struct NoopEmployeeRepo;

#[async_trait]
impl crate::traits::employee_store::EmployeeStore for NoopEmployeeRepo {
    async fn create_employee(&self, _: &crate::Employee) -> Result<(), Error> {
        Ok(())
    }
    async fn find_employee(&self, _: &crate::EmployeeId) -> Result<Option<crate::Employee>, Error> {
        Ok(None)
    }
    async fn find_employee_by_pin(&self, _: &str) -> Result<Option<crate::Employee>, Error> {
        Ok(None)
    }
    async fn find_employee_by_external_id(
        &self,
        _: &str,
    ) -> Result<Option<crate::Employee>, Error> {
        Ok(None)
    }
    async fn list_employees(
        &self,
        _: &crate::query::ListParams,
    ) -> Result<crate::query::ListResult<crate::Employee>, Error> {
        Ok(crate::query::ListResult::single_page(vec![]))
    }
    async fn update_employee(&self, _: &crate::Employee) -> Result<(), Error> {
        Ok(())
    }
    async fn deactivate_employee(&self, _: &crate::EmployeeId) -> Result<(), Error> {
        Ok(())
    }
    async fn create_enrollment(&self, _: &crate::DeviceEnrollment) -> Result<(), Error> {
        Ok(())
    }
    async fn find_enrollment(
        &self,
        _: &crate::EmployeeId,
        _: &str,
    ) -> Result<Option<crate::DeviceEnrollment>, Error> {
        Ok(None)
    }
    async fn list_enrollments_for_employee(
        &self,
        _: &crate::EmployeeId,
    ) -> Result<Vec<crate::DeviceEnrollment>, Error> {
        Ok(vec![])
    }
    async fn list_enrollments_for_device(
        &self,
        _: &str,
    ) -> Result<Vec<crate::DeviceEnrollment>, Error> {
        Ok(vec![])
    }
    async fn delete_enrollment(&self, _: &crate::EmployeeId, _: &str) -> Result<(), Error> {
        Ok(())
    }
}
