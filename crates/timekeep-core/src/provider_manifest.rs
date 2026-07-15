//! Compile-time provider manifest for inventory-based registration.
//!
//! Each device adapter crate (e.g., `timekeep-zkteco`) submits one
//! `ProviderManifest` via `inventory::submit!`. At startup, the engine
//! collects all manifests and auto-registers providers — no manual wiring.
//!
//! ## Adding a new vendor
//!
//! 1. Create `timekeep-suprema` crate implementing [`BiometricDevice`](crate::BiometricDevice)
//!    and [`DeviceProvider`](crate::traits::DeviceProvider)
//! 2. Submit a manifest:
//!    ```ignore
//!    inventory::submit! {
//!        timekeep_core::ProviderManifest {
//!            vendor_key: "suprema",
//!            display_name: "Suprema",
//!            capabilities: ProviderCapabilities { ... },
//!            default_port: 4371,
//!            create: |config, bus| Box::new(SupremaDevice::new(config, bus)),
//!        }
//!    }
//!    ```
//! 3. Add `timekeep-suprema` to workspace members and app dependencies
//! 4. Done — engine discovers it at startup automatically

use crate::BiometricDevice;
use crate::events::EventBus;
use crate::model::{DeviceConfig, DeviceProbe, ProviderCapabilities};

/// Compile-time registration point for a device provider.
///
/// Submitted via `inventory::submit!` in each adapter crate.
/// The engine collects all manifests at startup and registers
/// the corresponding providers.
pub struct ProviderManifest {
    /// Vendor key (e.g., "zkteco", "suprema"). Used in `DeviceConfig::vendor`.
    pub vendor_key: &'static str,
    /// Human-readable display name for the dashboard.
    pub display_name: &'static str,
    /// What this provider can do.
    pub capabilities: ProviderCapabilities,
    /// Default TCP port for this vendor's SDK protocol.
    pub default_port: u16,
    /// Factory function — creates a new device instance from config.
    /// Called at startup for each configured device matching this vendor.
    pub create: fn(DeviceConfig, EventBus) -> Box<dyn BiometricDevice>,
    /// Optional custom probe function. If `None`, a simple TCP-connect
    /// check is used as the default probe.
    pub probe: Option<fn(&str, u16) -> Result<DeviceProbe, crate::Error>>,
}

// inventory uses this to collect all submitted manifests at link time.
inventory::collect!(ProviderManifest);
