use async_trait::async_trait;

use crate::Error;
use crate::model::DeviceConfig;

/// Provides device configurations at runtime.
///
/// Implementations decide where configs come from:
/// - TOML/YAML file on disk
/// - Environment variables
/// - Database (admin UI provisions devices → stored in DB → read here)
/// - Remote config service
#[async_trait]
pub trait ConfigProvider: Send + Sync {
    /// Get all configured devices.
    async fn get_devices(&self) -> Result<Vec<DeviceConfig>, Error>;

    /// Get a single device by serial number.
    async fn get_device(&self, serial_number: &str) -> Result<Option<DeviceConfig>, Error>;

    /// Add or update a device configuration.
    async fn upsert_device(&self, config: DeviceConfig) -> Result<(), Error>;

    /// Remove a device configuration.
    async fn remove_device(&self, serial_number: &str) -> Result<(), Error>;
}
