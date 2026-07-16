//! Persistence for device-synced users (PIN, name, privilege from scanners).
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Device users are raw records synced from biometric scanners. They are distinct
//! from [`EmployeeStore`](super::employee_store::EmployeeStore) which manages
//! HR-canonical employee records with identity lifecycle.

use async_trait::async_trait;

use crate::Error;

/// Persists and queries device-synced user records.
#[async_trait]
#[allow(clippy::too_many_arguments)]
pub trait DeviceUserStore: Send + Sync {
    /// Sync a user from the device into the local user table.
    /// PIN is the device's user ID, name is the display name on the device.
    /// privilege is optional (0=normal user, 14=admin, etc.)
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

    /// Look up a user's display name by their device PIN.
    /// Returns None if the user is not in the local table.
    async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let _ = pin;
        Ok(None)
    }

    /// Count how many users are synced from a specific device.
    async fn count_device_users(&self, _device_sn: &str) -> Result<u32, Error> {
        Ok(0)
    }

    /// List all users synced from a specific device.
    /// Returns (pin, name, privilege) tuples sorted by pin.
    async fn list_device_users(
        &self,
        _device_sn: &str,
    ) -> Result<Vec<(String, String, Option<i32>)>, Error> {
        Ok(vec![])
    }
}
