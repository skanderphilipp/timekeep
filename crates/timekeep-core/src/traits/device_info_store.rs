//! Persistence for enriched device metadata (model, firmware, capacity).
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Device info is the "what is this device" metadata — separate from
//! [`DeviceConfigStore`](super::device_config_store::DeviceConfigStore)
//! which handles "how to connect" configuration.

use async_trait::async_trait;

use crate::Error;
use crate::model::Device;

/// Persists and queries enriched device metadata.
#[async_trait]
pub trait DeviceInfoStore: Send + Sync {
    /// Store or update basic device information (from `BiometricDevice::get_device_info()`).
    async fn upsert_device(&self, device: &Device) -> Result<(), Error>;

    /// Upsert the full device info (from `get_device_info()`).
    /// This stores the richer Device model fields separate from DeviceConfig.
    async fn upsert_device_info(&self, _device: &Device) -> Result<(), Error> {
        Ok(()) // default: silently accept
    }

    /// Get full device info by serial number.
    async fn get_device_info(&self, _serial_number: &str) -> Result<Option<Device>, Error> {
        Ok(None)
    }
}
