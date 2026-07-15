//! Persistence for device connection configuration.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Device config is the "how to connect" metadata (host, port, comm key).
//! Device info (model, firmware, capacity) is in [`DeviceInfoStore`](super::device_info_store::DeviceInfoStore).

use async_trait::async_trait;

use crate::Error;
use crate::model::DeviceConfig;
use crate::query::ListResult;
use crate::query::filters::DeviceFilter;

/// Persists and queries device connection configurations.
#[async_trait]
pub trait DeviceConfigStore: Send + Sync {
    /// Store or update device connection configuration.
    /// Called when an admin adds or updates a scanner from the dashboard.
    async fn upsert_device_config(&self, config: &DeviceConfig) -> Result<(), Error>;

    /// List all registered devices with their connection configs.
    ///
    /// Prefer [`list_device_configs_filtered`] for paginated, searchable listing.
    /// This method remains for backward compatibility.
    async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, Error>;

    /// List devices with search, sort, and pagination.
    async fn list_device_configs_filtered(
        &self,
        _filter: &DeviceFilter,
    ) -> Result<ListResult<DeviceConfig>, Error> {
        // Default: fall back to list_device_configs and wrap in ListResult
        let all = self.list_device_configs().await?;
        Ok(ListResult::single_page(all))
    }

    /// Remove a device from the registry (does not delete attendance data).
    async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error>;
}
