//! # timekeep-zkteco
//!
//! ZKTeco device provider for timekeep.
//!
//! Implements two access methods for ZKTeco biometric devices:
//!
//! ## ADMS Push (HTTP receiver)
//!
//! The scanner is configured with an ADMS URL pointing to this server.
//! It periodically POSTs attendance data via HTTP. This is the
//! preferred mode — real-time, no polling overhead.
//!
//! ```text
//! Scanner → POST /iclock/cdata?SN=XXX&table=ATTLOG → ADMS Server
//! ```
//!
//! ## SDK Pull (TCP binary protocol on port 4370)
//!
//! The server connects TO the scanner and pulls data via ZKTeco's
//! proprietary binary protocol. Used for initial data migration,
//! periodic catch-up to fill ADMS gaps, and scanners that don't
//! support ADMS push.
//!
//! ```text
//! Server → TCP :4370 → Scanner → binary response → Server
//! ```
//!
//! ## Push + Pull Coexistence
//!
//! Both modes run simultaneously for maximum data completeness:
//! - **ADMS push**: Real-time, best-effort. Scanner pushes every ~3 seconds.
//!   If network drops, some punches may be missed.
//! - **SDK poll**: Background task pulls all attendance records periodically
//!   (every 60 seconds by default). Dedup pipeline filters already-stored punches.
//!
//! The deduplication ID (SHA-256 of device_sn|user_pin|timestamp|status) ensures
//! that the same punch arriving via both ADMS and SDK is stored only once.

pub mod adms;
pub mod protocol;
pub mod sdk;
pub mod simulator;

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use sdk::connection::{FingerprintTemplate, NetworkParams};
use sdk::event::RealTimeEvent;
use timekeep_circuit::CircuitBreaker;
use timekeep_core::{
    Error,
    events::{DomainEvent, EventBus},
    model::{AttendancePunch, Device, DeviceConfig, User},
    traits::biometric_device::BiometricDevice,
};
/// Parse a timezone config string into a UTC offset in seconds.
///
/// Accepts:
/// - IANA timezone names (e.g., "Asia/Riyadh")
/// - Numeric hour offsets (e.g., "3", "+3", "-5")
/// - Empty or unrecognized strings default to 0 (UTC)
fn parse_timezone_config(tz: &Option<String>) -> i32 {
    let tz_str = match tz {
        Some(s) if !s.is_empty() => s.as_str(),
        _ => return 0,
    };

    // Try IANA timezone first
    if let Ok(tz_ref) = jiff::tz::TimeZone::get(tz_str) {
        let now = jiff::Timestamp::now();
        let offset = tz_ref.to_offset(now);
        return offset.seconds();
    }

    // Fallback: parse as numeric hours offset
    tz_str.trim().parse::<i32>().map(|h| h * 3600).unwrap_or(0)
}

/// A ZKTeco device managed by timekeep.
///
/// Can operate in ADMS push mode, SDK pull mode, or **both simultaneously**
/// for maximum data completeness.
///
/// ADMS push is handled by the **shared** [`AdmsServer`](adms::AdmsServer)
/// started in `main.rs`. Each device registers its per-device state
/// (`DeviceAdmsState`) so the shared server can route by serial number.
pub struct ZkTecoDevice {
    config: DeviceConfig,
    event_bus: EventBus,
    /// Per-device ADMS state registered with the shared ADMS server.
    /// Contains command queue and device status.
    adms_state: Option<adms::DeviceAdmsState>,
    /// SDK TCP connection for pull operations
    sdk_connection: Option<sdk::connection::ZkConnection>,
    /// Whether the device is connected (at least one mode active)
    connected: bool,
    /// Handle for the background SDK poller (if running)
    poller_handle: Option<tokio::task::JoinHandle<()>>,
    /// Shutdown signal for the poller
    poller_shutdown: Option<tokio::sync::watch::Sender<bool>>,
    /// Circuit breaker for SDK poller: prevents TCP connect retry storms
    /// when the device is unreachable. Trips after 5 consecutive failures,
    /// probes every 60 seconds.
    circuit: Arc<CircuitBreaker>,
}

impl ZkTecoDevice {
    /// Create a new ZKTeco device instance.
    ///
    /// The device will run:
    /// - SDK poller as background catch-up (if SDK port is reachable)
    /// - ADMS push is handled by the shared server; this device registers
    ///   its state via [`take_adms_state`](ZkTecoDevice::take_adms_state).
    pub fn new(config: DeviceConfig, event_bus: EventBus) -> Self {
        Self {
            config,
            event_bus,
            adms_state: None,
            sdk_connection: None,
            connected: false,
            poller_handle: None,
            poller_shutdown: None,
            circuit: Arc::new(
                CircuitBreaker::builder()
                    .failure_threshold(5)
                    .recovery_timeout(Duration::from_secs(60))
                    .half_open_max_success(1)
                    .build(),
            ),
        }
    }

    /// Get the device serial number.
    pub fn serial_number(&self) -> &str {
        &self.config.serial_number
    }

    /// Take ownership of the ADMS state so the caller can register it
    /// with the shared ADMS server. Returns `None` if already taken.
    pub fn take_adms_state(&mut self) -> Option<adms::DeviceAdmsState> {
        self.adms_state.take()
    }

    /// Get a clone of the ADMS command queue for external use.
    pub fn adms_command_queue(
        &self,
    ) -> Option<std::sync::Arc<std::sync::Mutex<adms::queue::CommandQueue>>> {
        self.adms_state.as_ref().map(|s| s.command_queue.clone())
    }
}

#[async_trait]
impl BiometricDevice for ZkTecoDevice {
    /// Connect to the device. Starts SDK pull mode if reachable.
    ///
    /// ADMS push is handled by the **shared** server; this method creates
    /// the per-device ADMS state (command queue + status) and stores it
    /// for later registration via [`take_adms_state`](ZkTecoDevice::take_adms_state).
    async fn connect(&mut self) -> Result<(), Error> {
        let mut modes: Vec<&str> = Vec::new();

        // --- Mode 1: ADMS Push State (registered with shared server) ---
        // We create the per-device state here so the command queue and
        // status are ready when the shared ADMS server receives the
        // first POST from this scanner.
        if self.config.push_enabled {
            self.adms_state = Some(adms::DeviceAdmsState::new(&self.config.serial_number));
            modes.push("ADMS push");
        }

        // --- Mode 2: SDK Connection ---
        // Try to establish an SDK connection for pull operations.
        // The scanner may not have ADMS push configured, or we may need
        // pull for initial data migration and periodic catch-up.
        match sdk::connection::ZkConnection::connect(
            &self.config.host,
            self.config.port,
            self.config.comm_key,
        )
        .await
        {
            Ok(conn) => {
                tracing::info!(
                    host = %self.config.host,
                    port = self.config.port,
                    "SDK connection established"
                );

                // Pull device metadata on connect to enrich dashboard
                match conn.get_device_info().await {
                    Ok(device) => {
                        tracing::info!(
                            host = %self.config.host,
                            platform = %device.platform,
                            fw = %device.firmware_version,
                            "device info pulled on connect"
                        );
                        self.event_bus.publish(DomainEvent::DeviceInfoUpdated { device });
                    },
                    Err(e) => {
                        tracing::warn!(
                            host = %self.config.host,
                            error = %e,
                            "failed to pull device info on connect"
                        );
                    },
                }

                // Pull device-side operation logs on connect to catch up
                // on any events missed while SDK was disconnected.
                // ADMS OPERLOG handles real-time delivery; this is the catch-up path.
                match conn.get_operation_logs().await {
                    Ok(logs) if !logs.is_empty() => {
                        tracing::info!(
                            host = %self.config.host,
                            count = logs.len(),
                            "publishing operation logs from SDK pull on connect"
                        );
                        for log in logs {
                            self.event_bus.publish(DomainEvent::OperationLogReceived { log });
                        }
                    },
                    Ok(_) => {
                        tracing::debug!(host = %self.config.host, "no operation logs to pull");
                    },
                    Err(e) => {
                        tracing::warn!(
                            host = %self.config.host,
                            error = %e,
                            "failed to pull operation logs on connect"
                        );
                    },
                }

                self.sdk_connection = Some(conn);
                modes.push("SDK pull");

                // --- Mode 3: Background SDK Poller ---
                // Periodically pull attendance records to fill any gaps
                // missed by ADMS push (network drops, scanner reboot, etc.)
                let bus = self.event_bus.clone();
                let host = self.config.host.clone();
                let port = self.config.port;
                let comm_key = self.config.comm_key;
                let device_sn = self.config.serial_number.clone();
                let tz_offset_secs = parse_timezone_config(&self.config.timezone);
                let circuit = Arc::clone(&self.circuit);

                let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);
                self.poller_shutdown = Some(shutdown_tx);

                let handle = tokio::spawn(async move {
                    tracing::info!(
                        %host,
                        device = %device_sn,
                        interval_secs = 60,
                        "SDK background poller started"
                    );

                    loop {
                        // Check for shutdown signal
                        if *shutdown_rx.borrow() {
                            tracing::info!(
                                device = %device_sn,
                                "SDK poller received shutdown signal"
                            );
                            break;
                        }

                        // Wait for the poll interval
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_secs(60)) => {}
                            _ = shutdown_rx.changed() => {
                                if *shutdown_rx.borrow() {
                                    break;
                                }
                            }
                        }

                        // Attempt to connect through circuit breaker.
                        // When the device is unreachable, the circuit opens
                        // and subsequent attempts bail immediately instead
                        // of blocking on TCP timeouts.
                        match circuit
                            .call(|| async {
                                sdk::connection::ZkConnection::connect(&host, port, comm_key).await
                            })
                            .await
                        {
                            Ok(conn) => {
                                match conn.get_attendance(None).await {
                                    Ok(punches) => {
                                        if !punches.is_empty() {
                                            tracing::info!(
                                                device = %device_sn,
                                                count = punches.len(),
                                                "SDK poller: pulled attendance records"
                                            );
                                            for mut punch in punches {
                                                // Apply device timezone offset to normalize to UTC
                                                if tz_offset_secs != 0 {
                                                    let adjusted = punch
                                                        .timestamp
                                                        .as_second()
                                                        .wrapping_sub(tz_offset_secs as i64);
                                                    if let Ok(ts) =
                                                        jiff::Timestamp::from_second(adjusted)
                                                    {
                                                        punch.timestamp = ts;
                                                    }
                                                }
                                                bus.publish(DomainEvent::PunchReceived { punch });
                                            }
                                        }
                                    },
                                    Err(e) => {
                                        tracing::warn!(
                                            device = %device_sn,
                                            error = %e,
                                            "SDK poller: failed to get attendance"
                                        );
                                    },
                                }
                                // Connection is dropped here (disconnect on drop)
                                let _ = conn;
                            },
                            Err(timekeep_circuit::CircuitBreakerError::CircuitOpen) => {
                                tracing::debug!(
                                    device = %device_sn,
                                    "SDK poller: circuit open — skipping connect attempt"
                                );
                            },
                            Err(timekeep_circuit::CircuitBreakerError::Inner(e)) => {
                                tracing::warn!(
                                    device = %device_sn,
                                    error = %e,
                                    "SDK poller: failed to connect"
                                );
                            },
                        }
                    }

                    tracing::info!(
                        device = %device_sn,
                        "SDK background poller stopped"
                    );
                });

                self.poller_handle = Some(handle);
            },
            Err(e) => {
                tracing::warn!(
                    host = %self.config.host,
                    error = %e,
                    "SDK connection failed — pull mode unavailable"
                );
            },
        }

        if modes.is_empty() {
            return Err(Error::device(format!(
                "failed to establish any connection mode for device {}",
                self.config.serial_number
            )));
        }

        self.connected = true;
        tracing::info!(
            device = %self.config.serial_number,
            modes = ?modes,
            "device connected"
        );
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), Error> {
        // Shut down the background poller
        if let Some(tx) = self.poller_shutdown.take() {
            let _ = tx.send(true);
        }
        if let Some(handle) = self.poller_handle.take() {
            handle.abort();
        }

        // ADMS state is dropped — shared server handles unregistration
        self.adms_state = None;

        // Disconnect SDK
        if let Some(mut conn) = self.sdk_connection.take() {
            conn.disconnect().await?;
        }

        self.connected = false;
        tracing::info!(device = %self.config.serial_number, "device disconnected");
        Ok(())
    }

    async fn get_device_info(&self) -> Result<Device, Error> {
        if let Some(conn) = &self.sdk_connection {
            conn.get_device_info().await
        } else {
            // In ADMS-only mode, return what we know from config
            Ok(Device {
                serial_number: self.config.serial_number.clone(),
                model: String::new(),
                firmware_version: String::new(),
                platform: String::new(),
                vendor: timekeep_core::DeviceVendor::ZkTeco,
                mac_address: String::new(),
                ip_address: self.config.host.clone(),
                status: timekeep_core::DeviceStatus::Online,
                last_seen: Some(jiff::Timestamp::now()),
                first_seen: None,
                uptime_seconds: None,
                user_capacity: 0,
                record_capacity: 0,
                fingerprint_capacity: 0,
                face_capacity: 0,
                palm_capacity: 0,
                user_count: 0,
                record_count: 0,
                fingerprint_count: 0,
                face_count: 0,
                palm_count: 0,
                last_sync_at: None,
                last_sync_cursor: None,
                label: None,
                location: None,
                branch: None,
                installed_at: None,
                notes: None,
            })
        }
    }

    async fn get_device_time(&self) -> Result<jiff::Timestamp, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_time().await,
            None => Err(Error::device("device time available only in SDK mode")),
        }
    }

    async fn get_users(&self) -> Result<Vec<User>, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_users().await,
            None => Err(Error::device("user retrieval available only in SDK mode")),
        }
    }

    async fn set_user(&mut self, user: &User) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.set_user(user).await,
            None => Err(Error::device("user management available only in SDK mode")),
        }
    }

    async fn delete_user(&mut self, user_sn: u16) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.delete_user(user_sn).await,
            None => Err(Error::device("user management available only in SDK mode")),
        }
    }

    async fn get_attendance(
        &self,
        since: Option<jiff::Timestamp>,
    ) -> Result<Vec<AttendancePunch>, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_attendance(since).await,
            None => Err(Error::device("attendance pull available only in SDK mode")),
        }
    }

    async fn clear_attendance(&mut self) -> Result<u32, Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.clear_attendance().await,
            None => Err(Error::device("clear attendance available only in SDK mode")),
        }
    }

    async fn enable(&mut self) -> Result<(), Error> {
        if let Some(conn) = &mut self.sdk_connection {
            conn.enable_device().await
        } else {
            Ok(()) // ADMS mode: device is always enabled
        }
    }

    async fn disable(&mut self) -> Result<(), Error> {
        if let Some(conn) = &mut self.sdk_connection {
            conn.disable_device().await
        } else {
            Ok(()) // ADMS mode: no need to disable during push
        }
    }

    async fn set_time(&mut self, time: jiff::Timestamp) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.set_time(time).await,
            None => Err(Error::device("time sync available only in SDK mode")),
        }
    }

    async fn restart(&mut self) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.restart().await,
            None => Err(Error::device("restart available only in SDK mode")),
        }
    }

    fn config(&self) -> &DeviceConfig {
        &self.config
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}

// ─── Vendor-specific methods (not in BiometricDevice trait) ────

impl ZkTecoDevice {
    /// Get all fingerprint templates from the device.
    pub async fn get_templates(&self) -> Result<Vec<FingerprintTemplate>, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_templates().await,
            None => Err(Error::device("template operations available only in SDK mode")),
        }
    }

    /// Get a single user's fingerprint template.
    pub async fn get_user_template(
        &self,
        user_sn: u16,
        finger_index: u8,
    ) -> Result<Option<FingerprintTemplate>, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_user_template(user_sn, finger_index).await,
            None => Err(Error::device("template operations available only in SDK mode")),
        }
    }

    /// Upload a fingerprint template to the device.
    pub async fn save_user_template(
        &mut self,
        template: &FingerprintTemplate,
    ) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.save_user_template(template).await,
            None => Err(Error::device("template operations available only in SDK mode")),
        }
    }

    /// Get network configuration from the device.
    pub async fn get_network_params(&self) -> Result<NetworkParams, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_network_params().await,
            None => Err(Error::device("network params available only in SDK mode")),
        }
    }

    /// Delete a single fingerprint template from the device.
    pub async fn delete_fingerprint(
        &mut self,
        user_sn: u16,
        finger_index: u8,
    ) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.delete_fingerprint(user_sn, finger_index).await,
            None => Err(Error::device("fingerprint operations available only in SDK mode")),
        }
    }

    /// Read a device configuration option by name.
    ///
    /// Common options: `~SerialNumber`, `~DeviceName`, `SDKBuild`, `Lock`, `TransFlag`.
    pub async fn get_option(&self, param: &str) -> Result<String, Error> {
        match &self.sdk_connection {
            Some(conn) => conn.get_option(param).await,
            None => Err(Error::device("option read available only in SDK mode")),
        }
    }

    /// Set a device configuration option.
    ///
    /// Common uses: `SDKBuild=1`, `TransFlag=...`, `Lock=0`.
    pub async fn set_option(&mut self, param: &str, value: &str) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.set_option(param, value).await,
            None => Err(Error::device("option write available only in SDK mode")),
        }
    }

    /// Enable real-time event reception from the device.
    ///
    /// Returns a channel receiver for consuming live events (punches,
    /// alarms, finger scores, enrollment results). The caller must
    /// continuously poll this receiver to process events.
    pub async fn enable_realtime(
        &mut self,
    ) -> Result<tokio::sync::mpsc::UnboundedReceiver<RealTimeEvent>, Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.enable_realtime().await,
            None => Err(Error::device("real-time events available only in SDK mode")),
        }
    }

    /// Enroll a fingerprint on the device using the 3-sample capture loop.
    ///
    /// Requires real-time events to be enabled first via `enable_realtime()`.
    /// After successful enrollment, use `get_user_template()` to download
    /// the fingerprint template for backup.
    pub async fn enroll_user(
        &mut self,
        user_pin: &str,
        finger_index: u8,
        fp_flag: u8,
        event_tx: &tokio::sync::mpsc::UnboundedSender<RealTimeEvent>,
    ) -> Result<(), Error> {
        match &mut self.sdk_connection {
            Some(conn) => conn.enroll_user(user_pin, finger_index, fp_flag, event_tx).await,
            None => Err(Error::device("enrollment available only in SDK mode")),
        }
    }
}

// ─── Provider (factory for multi-vendor routing) ────────────────────

use timekeep_core::{
    DeviceProvider,
    model::{DeviceProbe, ProviderCapabilities},
};

/// ZKTeco provider implementation for the multi-vendor registry.
///
/// Registered at startup via `ProviderRegistry::register()`. The engine
/// uses this factory to create `ZkTecoDevice` instances without knowing
/// which vendor is on the other end of the wire.
#[derive(Clone)]
pub struct ZkTecoProvider;

impl ZkTecoProvider {
    /// Create a new ZKTeco provider instance.
    pub fn new() -> Self {
        Self
    }
}

impl Default for ZkTecoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DeviceProvider for ZkTecoProvider {
    fn vendor_key(&self) -> &str {
        "zkteco"
    }

    fn display_name(&self) -> &str {
        "ZKTeco"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            attendance_read: true,
            attendance_clear: true,
            user_read: true,
            user_write: true,
            user_delete: true,
            device_config_read: true,
            device_config_write: true,
            real_time_events: true,
            fingerprint_enroll: true,
            face_enroll: false,
            palm_enroll: false,
            time_sync: true,
            restart: true,
        }
    }

    fn default_port(&self) -> u16 {
        4370
    }

    fn supports_adms(&self) -> bool {
        true
    }

    fn supports_sdk(&self) -> bool {
        true
    }

    async fn create_device(
        &self,
        config: timekeep_core::DeviceConfig,
        event_bus: timekeep_core::EventBus,
    ) -> Result<Box<dyn BiometricDevice>, timekeep_core::Error> {
        let device = ZkTecoDevice::new(config, event_bus);
        Ok(Box::new(device))
    }

    async fn probe(&self, host: &str, _port: u16) -> Result<DeviceProbe, timekeep_core::Error> {
        // Connect briefly via SDK to extract device identity
        let mut device = ZkTecoDevice::new(
            timekeep_core::DeviceConfig::minimal("probe", host),
            timekeep_core::EventBus::new(8),
        );
        device.connect().await?;

        let info = device.get_device_info().await?;

        let probe = DeviceProbe {
            vendor: "zkteco".into(),
            serial_number: info.serial_number.clone(),
            model: info.model.clone(),
            firmware_version: info.firmware_version.clone(),
            platform: info.platform.clone(),
            mac_address: info.mac_address.clone(),
            host: host.to_string(),
            user_count: info.user_count,
            record_count: info.record_count,
        };

        let _ = device.disconnect().await;
        Ok(probe)
    }
}

// ── Compile-time provider registration ──────────────────────────────
//
// This manifest is collected by inventory at link time.
// The engine auto-discovers all providers without manual wiring.
// Adding a new vendor = create crate + submit manifest.

inventory::submit! {
    timekeep_core::ProviderManifest {
        vendor_key: "zkteco",
        display_name: "ZKTeco",
        capabilities: timekeep_core::ProviderCapabilities {
            attendance_read: true,
            attendance_clear: true,
            user_read: true,
            user_write: true,
            user_delete: true,
            device_config_read: true,
            device_config_write: true,
            real_time_events: true,
            fingerprint_enroll: true,
            face_enroll: false,
            palm_enroll: false,
            time_sync: true,
            restart: true,
        },
        default_port: 4370,
        create: |config, bus| {
            Box::new(ZkTecoDevice::new(config, bus))
        },
        probe: None,
    }
}

#[cfg(test)]
mod provider_tests {
    use super::*;

    #[test]
    fn test_provider_capabilities() {
        let provider = ZkTecoProvider::new();
        assert_eq!(provider.vendor_key(), "zkteco");
        assert_eq!(provider.display_name(), "ZKTeco");
        assert_eq!(provider.default_port(), 4370);
        assert!(provider.supports_adms());
        assert!(provider.supports_sdk());

        let caps = provider.capabilities();
        assert!(caps.attendance_read);
        assert!(caps.attendance_clear);
        assert!(caps.user_read);
        assert!(caps.user_write);
        assert!(caps.user_delete);
        assert!(caps.real_time_events);
        assert!(caps.fingerprint_enroll);
        assert!(!caps.face_enroll);
        assert!(!caps.palm_enroll);
        assert!(caps.time_sync);
        assert!(caps.restart);
    }

    #[test]
    fn test_provider_clone() {
        let p1 = ZkTecoProvider::new();
        let p2 = p1.clone();
        assert_eq!(p1.vendor_key(), p2.vendor_key());
    }

    #[test]
    fn test_default_impl() {
        let provider = ZkTecoProvider;
        assert_eq!(provider.vendor_key(), "zkteco");
    }
}
