//! Enrichment stage.
//!
//! Enhances raw punches with metadata from the local user table:
//! - Employee display names (synced from device via `get_users()`)
//!
//! Future enhancements:
//! - Late/early detection against shift schedules
//! - Work code resolution
//!
//! Uses the `Storage` trait for user lookups. When no storage is
//! configured or the user is not found, punches pass through unchanged.

use std::sync::Arc;
use timekeep_core::model::AttendancePunch;
use timekeep_core::traits::storage::Storage;

/// Enrich a punch with data from the local user table.
///
/// Resolves the device PIN to a display name using the storage layer.
/// The user table is populated during initial device sync (see
/// `main.rs` → `device.get_users()` → `storage.upsert_user()`).
///
/// When no storage is provided or the user is unknown, the punch
/// passes through unchanged.
pub async fn enrich_punch(punch: &mut AttendancePunch, storage: Option<&Arc<dyn Storage>>) {
    let Some(storage) = storage else {
        return;
    };

    // Resolve PIN → display name from local user table
    match storage.get_user_name(&punch.user_pin).await {
        Ok(Some(name)) => {
            tracing::debug!(
                pin = %punch.user_pin,
                name = %name,
                "enrich: resolved employee name from local user table"
            );
            punch.employee_name = Some(name);
        },
        Ok(None) => {
            tracing::debug!(
                pin = %punch.user_pin,
                "enrich: unknown user (not in local user table)"
            );
        },
        Err(e) => {
            tracing::warn!(
                pin = %punch.user_pin,
                error = %e,
                "enrich: user lookup failed"
            );
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;
    use timekeep_core::Error;

    /// Fake storage with an in-memory user table for testing enrichment.
    struct FakeUserStorage {
        users: Mutex<HashMap<String, String>>,
    }

    impl FakeUserStorage {
        fn new() -> Self {
            Self { users: Mutex::new(HashMap::new()) }
        }

        fn add_user(&self, pin: &str, name: &str) {
            self.users.lock().unwrap().insert(pin.to_string(), name.to_string());
        }
    }

    #[async_trait]
    impl Storage for FakeUserStorage {
        async fn store_punch(&self, _punch: &AttendancePunch) -> Result<(), Error> {
            Ok(())
        }
        async fn query_punches(
            &self,
            _filter: &timekeep_core::PunchFilter,
        ) -> Result<Vec<AttendancePunch>, Error> {
            Ok(vec![])
        }
        async fn upsert_device(&self, _device: &timekeep_core::model::Device) -> Result<(), Error> {
            Ok(())
        }
        async fn upsert_device_config(
            &self,
            _config: &timekeep_core::DeviceConfig,
        ) -> Result<(), Error> {
            Ok(())
        }
        async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
            Ok(vec![])
        }
        async fn delete_device_config(&self, _sn: &str) -> Result<(), Error> {
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
        async fn get_punch(&self, _id: &str) -> Result<Option<AttendancePunch>, Error> {
            Ok(None)
        }
        async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
            Ok(self.users.lock().unwrap().get(pin).cloned())
        }
    }

    fn make_test_punch(pin: &str) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(1752129600).unwrap();
        AttendancePunch {
            id: String::new(),
            device_sn: "TEST".into(),
            user_pin: pin.to_string(),
            timestamp: ts,
            status: timekeep_core::PunchStatus::CheckIn,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        }
    }

    #[tokio::test]
    async fn test_enrich_preserves_punch() {
        let mut punch = make_test_punch("145");
        let pin_before = punch.user_pin.clone();
        let ts_before = punch.timestamp;

        enrich_punch(&mut punch, None).await;

        assert_eq!(punch.user_pin, pin_before);
        assert_eq!(punch.timestamp, ts_before);
    }

    #[tokio::test]
    async fn test_enrich_adds_employee_name() {
        let storage = FakeUserStorage::new();
        storage.add_user("145", "Ahmed Al-Sabah");
        let storage: Arc<dyn Storage> = Arc::new(storage);

        let mut punch = make_test_punch("145");
        enrich_punch(&mut punch, Some(&storage)).await;

        assert_eq!(punch.employee_name.as_deref(), Some("Ahmed Al-Sabah"));
    }

    #[tokio::test]
    async fn test_enrich_unknown_pin_no_name() {
        let storage = FakeUserStorage::new();
        let storage: Arc<dyn Storage> = Arc::new(storage);

        let mut punch = make_test_punch("999");
        enrich_punch(&mut punch, Some(&storage)).await;

        assert_eq!(punch.employee_name, None);
    }

    #[tokio::test]
    async fn test_enrich_no_storage_preserves_none() {
        let mut punch = make_test_punch("145");
        assert_eq!(punch.employee_name, None);

        enrich_punch(&mut punch, None).await;

        assert_eq!(punch.employee_name, None);
    }
}
