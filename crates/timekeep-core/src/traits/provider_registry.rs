//! Device provider trait — the factory pattern that enables multi-vendor support.
//!
//! Each vendor (ZKTeco, Suprema, Anviz, etc.) implements `DeviceProvider`.
//! The `ProviderRegistry` (in `crate::provider_registry`) routes device
//! creation and probing to the correct provider by vendor key.

use async_trait::async_trait;

use crate::BiometricDevice;
use crate::Error;
use crate::events::EventBus;
use crate::model::{DeviceConfig, DeviceProbe, ProviderCapabilities};

/// A factory that creates `BiometricDevice` instances for a specific vendor.
///
/// Each vendor provides one `DeviceProvider` implementation that:
/// - Knows how to create device connections for that vendor
/// - Can probe an IP:port to detect the vendor's devices
/// - Declares which capabilities it supports
///
/// This is the central abstraction that prevents vendor lock-in.
#[async_trait]
pub trait DeviceProvider: Send + Sync {
    /// The vendor key this provider handles (e.g. "zkteco", "suprema").
    fn vendor_key(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// The provider's capabilities. The dashboard uses this to
    /// conditionally show/hide UI elements (e.g. don't show
    /// "Enroll Fingerprint" if the provider doesn't support it).
    fn capabilities(&self) -> ProviderCapabilities;

    /// Default port for this vendor's protocol.
    fn default_port(&self) -> u16;

    /// Whether this provider supports ADMS push.
    fn supports_adms(&self) -> bool;

    /// Whether this provider supports SDK pull.
    fn supports_sdk(&self) -> bool;

    /// Create a new device instance from config + event bus.
    ///
    /// The returned device is NOT connected — call `connect()` on it
    /// after creation. This separation lets the engine create devices
    /// for all configs at startup and connect them concurrently.
    async fn create_device(
        &self,
        config: DeviceConfig,
        event_bus: EventBus,
    ) -> Result<Box<dyn BiometricDevice>, Error>;

    /// Probe an IP:port to detect if this vendor's device is at that address.
    ///
    /// Returns `DeviceProbe` on success, or an error if the device at that
    /// address is not from this vendor or is unreachable.
    ///
    /// This is a lightweight "are you there?" check — it should return
    /// quickly (under 5 seconds) and not perform heavy data transfer.
    async fn probe(&self, host: &str, port: u16) -> Result<DeviceProbe, Error>;
}
