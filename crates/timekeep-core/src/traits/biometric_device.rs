use async_trait::async_trait;

use crate::Error;
use crate::model::{AttendancePunch, Device, DeviceConfig, User};

/// The core abstraction for any biometric attendance device.
///
/// Providers (ZKTeco, Suprema, Anviz, etc.) implement this trait.
/// The engine calls these methods without knowing which vendor is on
/// the other end of the wire.
#[async_trait]
pub trait BiometricDevice: Send + Sync {
    /// Connect to the physical device and authenticate.
    async fn connect(&mut self) -> Result<(), Error>;

    /// Disconnect and clean up resources.
    async fn disconnect(&mut self) -> Result<(), Error>;

    /// Get device information (model, firmware, serial, capacity).
    async fn get_device_info(&self) -> Result<Device, Error>;

    /// Get the current time on the device.
    async fn get_device_time(&self) -> Result<jiff::Timestamp, Error>;

    /// Pull all users registered on the device.
    async fn get_users(&self) -> Result<Vec<User>, Error>;

    /// Create or update a user on the device.
    ///
    /// If the user already exists (matched by internal serial number),
    /// their record is overwritten. Otherwise a new user is created.
    async fn set_user(&mut self, user: &User) -> Result<(), Error>;

    /// Delete a user from the device by their internal serial number.
    ///
    /// The `user_sn` is the device-assigned internal identifier,
    /// available from `User::internal_sn` returned by `get_users()`.
    async fn delete_user(&mut self, user_sn: u16) -> Result<(), Error>;

    /// Pull attendance records since the given timestamp.
    /// If `since` is None, pull all records.
    async fn get_attendance(
        &self,
        since: Option<jiff::Timestamp>,
    ) -> Result<Vec<AttendancePunch>, Error>;

    /// Clear attendance records that have been successfully ingested.
    /// Safety: only call after confirming the records are stored.
    async fn clear_attendance(&mut self) -> Result<u32, Error>;

    /// Enable the device (allow new punches).
    async fn enable(&mut self) -> Result<(), Error>;

    /// Disable the device (block new punches during sync).
    async fn disable(&mut self) -> Result<(), Error>;

    /// Set the device clock (synchronize).
    async fn set_time(&mut self, time: jiff::Timestamp) -> Result<(), Error>;

    /// Restart the device.
    async fn restart(&mut self) -> Result<(), Error>;

    /// Get the device configuration reference.
    fn config(&self) -> &DeviceConfig;

    /// Whether this device is currently connected.
    fn is_connected(&self) -> bool;
}
