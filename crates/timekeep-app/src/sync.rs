//! User sync logic — extracts users from a biometric device and stores them
//! in the local storage backend for enrichment (PIN → employee name resolution).
//!
//! This module was extracted from `main.rs` to:
//! 1. Make the logic testable
//! 2. Eliminate the duplicate device connection bug (two `ZkTecoDevice::new()`
//!    calls per config — one for the registry, one for user sync)

use timekeep_core::traits::Storage;
use timekeep_core::{BiometricDevice, Error};

/// Sync all users from a connected biometric device into the local storage.
///
/// The device MUST already be connected before calling this function.
/// Users are upserted by (pin, device_sn) — existing users are updated.
///
/// # Returns
///
/// The number of users synced, or an error if the device call failed.
///
/// # Errors during individual user upserts
///
/// Individual user upsert failures are logged as warnings but do NOT fail
/// the entire sync — data from other users is preserved.
pub async fn sync_users_to_storage(
    device: &dyn BiometricDevice,
    storage: &dyn Storage,
) -> Result<usize, Error> {
    let device_sn = device.config().serial_number.clone();
    let users = device.get_users().await?;

    let mut synced = 0usize;
    for user in &users {
        match storage
            .upsert_user(&device_sn, &user.pin, &user.name, Some(user.privilege as i32))
            .await
        {
            Ok(()) => synced += 1,
            Err(e) => {
                tracing::warn!(
                    pin = %user.pin,
                    error = %e,
                    "failed to sync user to local table"
                );
            },
        }
    }

    tracing::info!(
        device = %device_sn,
        total = users.len(),
        synced,
        "synced users from device to local table"
    );

    Ok(synced)
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex as StdMutex};
    use timekeep_core::PunchFilter;
    use timekeep_core::model::{Device, DeviceConfig, User};

    // ─── Mock BiometricDevice ──────────────────────────────────────────

    /// A fake biometric device that returns predefined users without any
    /// network I/O. Used to test the user sync function in isolation.
    struct MockDevice {
        config: DeviceConfig,
        users: Vec<User>,
    }

    impl MockDevice {
        fn new(serial: &str, users: Vec<User>) -> Self {
            Self {
                config: DeviceConfig {
                    label: format!("Mock {serial}"),
                    serial_number: serial.to_string(),
                    host: "127.0.0.1".into(),
                    port: 4370,
                    comm_key: 0,
                    timezone: None,
                    push_enabled: false,
                    vendor: "zkteco".into(),
                    location: None,
                    poll_interval_secs: None,
                },
                users,
            }
        }
    }

    #[async_trait]
    impl BiometricDevice for MockDevice {
        async fn connect(&mut self) -> Result<(), Error> {
            Ok(())
        }
        async fn disconnect(&mut self) -> Result<(), Error> {
            Ok(())
        }
        async fn get_device_info(&self) -> Result<Device, Error> {
            Ok(Device::new(&self.config.serial_number))
        }
        async fn get_device_time(&self) -> Result<jiff::Timestamp, Error> {
            Ok(jiff::Timestamp::now())
        }
        async fn get_users(&self) -> Result<Vec<User>, Error> {
            Ok(self.users.clone())
        }
        async fn set_user(&mut self, _user: &User) -> Result<(), Error> {
            Ok(())
        }
        async fn delete_user(&mut self, _user_sn: u16) -> Result<(), Error> {
            Ok(())
        }
        async fn get_attendance(
            &self,
            _since: Option<jiff::Timestamp>,
        ) -> Result<Vec<timekeep_core::model::AttendancePunch>, Error> {
            Ok(vec![])
        }
        async fn clear_attendance(&mut self) -> Result<u32, Error> {
            Ok(0)
        }
        async fn enable(&mut self) -> Result<(), Error> {
            Ok(())
        }
        async fn disable(&mut self) -> Result<(), Error> {
            Ok(())
        }
        async fn set_time(&mut self, _time: jiff::Timestamp) -> Result<(), Error> {
            Ok(())
        }
        async fn restart(&mut self) -> Result<(), Error> {
            Ok(())
        }
        fn config(&self) -> &DeviceConfig {
            &self.config
        }
        fn is_connected(&self) -> bool {
            true
        }
    }

    // ─── Fake Storage (in-memory) ─────────────────────────────────────

    /// A minimal in-memory storage that records upserted users for assertions.
    struct FakeUserStorage {
        users: StdMutex<HashMap<String, String>>, // key: "pin:device_sn" → name
    }

    impl FakeUserStorage {
        fn new() -> Self {
            Self { users: StdMutex::new(HashMap::new()) }
        }

        fn user_count(&self) -> usize {
            self.users.lock().unwrap().len()
        }

        fn get_name(&self, pin: &str, device_sn: &str) -> Option<String> {
            let key = format!("{pin}:{device_sn}");
            self.users.lock().unwrap().get(&key).cloned()
        }
    }

    #[async_trait]
    impl Storage for FakeUserStorage {
        async fn store_punch(
            &self,
            _punch: &timekeep_core::model::AttendancePunch,
        ) -> Result<(), Error> {
            Ok(())
        }
        async fn query_punches(
            &self,
            _filter: &PunchFilter,
        ) -> Result<Vec<timekeep_core::model::AttendancePunch>, Error> {
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
        async fn upsert_user(
            &self,
            device_sn: &str,
            pin: &str,
            name: &str,
            _privilege: Option<i32>,
        ) -> Result<(), Error> {
            let key = format!("{pin}:{device_sn}");
            self.users.lock().unwrap().insert(key, name.to_string());
            Ok(())
        }
        async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
            let users = self.users.lock().unwrap();
            Ok(users
                .iter()
                .find(|(k, _)| k.starts_with(&format!("{pin}:")))
                .map(|(_, v)| v.clone()))
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    fn make_user(internal_sn: u16, pin: &str, name: &str) -> User {
        User {
            internal_sn,
            pin: pin.to_string(),
            name: name.to_string(),
            privilege: 0,
            card_number: None,
            has_password: false,
            fingerprint_count: 1,
            has_face: false,
        }
    }

    // ─── Tests ────────────────────────────────────────────────────────

    /// The core TDD test that proves the bug:
    ///
    /// **Bug:** `main.rs` creates a SECOND `ZkTecoDevice` for user sync,
    /// connecting to ADMS (which fails on port conflict) and SDK (wasteful).
    ///
    /// **Fix:** Use the already-connected device. This test verifies that
    /// `sync_users_to_storage()` works with a single device reference —
    /// no second connection needed.
    #[tokio::test]
    async fn test_sync_users_stores_all_users() {
        let device = MockDevice::new(
            "CQZ7232960836",
            vec![
                make_user(1, "145", "Ahmed Al-Sabah"),
                make_user(2, "146", "Fatima Hassan"),
                make_user(3, "147", "Omar Khalid"),
            ],
        );
        let storage = Arc::new(FakeUserStorage::new());

        let count = sync_users_to_storage(&device, storage.as_ref()).await.unwrap();

        assert_eq!(count, 3, "all 3 users should be synced");
        assert_eq!(storage.user_count(), 3);
        assert_eq!(storage.get_name("145", "CQZ7232960836").as_deref(), Some("Ahmed Al-Sabah"));
        assert_eq!(storage.get_name("146", "CQZ7232960836").as_deref(), Some("Fatima Hassan"));
        assert_eq!(storage.get_name("147", "CQZ7232960836").as_deref(), Some("Omar Khalid"));
    }

    /// Verify that syncing the same users twice is idempotent.
    #[tokio::test]
    async fn test_sync_users_idempotent() {
        let device = MockDevice::new("DEV001", vec![make_user(1, "145", "Ahmed Al-Sabah")]);
        let storage = Arc::new(FakeUserStorage::new());

        // First sync
        let count1 = sync_users_to_storage(&device, storage.as_ref()).await.unwrap();
        assert_eq!(count1, 1);
        assert_eq!(storage.user_count(), 1);

        // Second sync — same data, should succeed (upsert is idempotent)
        let count2 = sync_users_to_storage(&device, storage.as_ref()).await.unwrap();
        assert_eq!(count2, 1);
        assert_eq!(storage.user_count(), 1, "no duplicate users");
    }

    /// Verify that an empty device returns 0 without error.
    #[tokio::test]
    async fn test_sync_users_empty_device() {
        let device = MockDevice::new("DEV001", vec![]);
        let storage = Arc::new(FakeUserStorage::new());

        let count = sync_users_to_storage(&device, storage.as_ref()).await.unwrap();
        assert_eq!(count, 0);
        assert_eq!(storage.user_count(), 0);
    }

    /// Verify that users from different devices are stored under
    /// their respective device serial numbers (no cross-device collision).
    #[tokio::test]
    async fn test_sync_users_multiple_devices() {
        let device_a = MockDevice::new("DEV-A", vec![make_user(1, "145", "Ahmed Al-Sabah")]);
        let device_b = MockDevice::new("DEV-B", vec![make_user(1, "145", "Ahmed (Office 2)")]);
        let storage = Arc::new(FakeUserStorage::new());

        sync_users_to_storage(&device_a, storage.as_ref()).await.unwrap();
        sync_users_to_storage(&device_b, storage.as_ref()).await.unwrap();

        assert_eq!(storage.user_count(), 2);
        assert_eq!(storage.get_name("145", "DEV-A").as_deref(), Some("Ahmed Al-Sabah"));
        assert_eq!(storage.get_name("145", "DEV-B").as_deref(), Some("Ahmed (Office 2)"));
    }
}
