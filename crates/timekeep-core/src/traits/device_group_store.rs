//! Persistence for device groups.
//!
//! Device groups organize biometric scanners for department-scoped
//! sync operations. Each group can contain multiple devices and
//! be targeted for batch sync with optional department filtering.

use async_trait::async_trait;

use crate::Error;
use crate::model::DeviceConfig;
use crate::model::device_group::DeviceGroup;

/// Persists and queries device group records.
#[async_trait]
pub trait DeviceGroupStore: Send + Sync {
    /// List all device groups.
    async fn list_groups(&self) -> Result<Vec<DeviceGroup>, Error>;

    /// Get a single group by ID.
    async fn get_group(&self, id: &str) -> Result<Option<DeviceGroup>, Error>;

    /// Get a group by name.
    async fn get_group_by_name(&self, name: &str) -> Result<Option<DeviceGroup>, Error>;

    /// Create a new device group.
    async fn create_group(&self, group: &DeviceGroup) -> Result<(), Error>;

    /// Update an existing device group.
    async fn update_group(&self, group: &DeviceGroup) -> Result<(), Error>;

    /// Delete a device group by ID.
    /// Devices in the group will have their group_id set to NULL.
    async fn delete_group(&self, id: &str) -> Result<(), Error>;

    // ── Device membership ──────────────────────────────────────────

    /// List all devices that belong to a group.
    async fn list_devices_in_group(&self, group_id: &str) -> Result<Vec<DeviceConfig>, Error>;

    /// Set a device's group membership.
    /// Pass `None` to remove the device from its current group.
    async fn set_device_group(&self, device_sn: &str, group_id: Option<&str>) -> Result<(), Error>;

    /// Get the group a device belongs to, if any.
    async fn get_device_group(&self, device_sn: &str) -> Result<Option<DeviceGroup>, Error>;
}
