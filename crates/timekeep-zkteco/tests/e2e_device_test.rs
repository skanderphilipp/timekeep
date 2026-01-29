//! End-to-end integration tests against real ZKTeco scanners.
//!
//! ## Prerequisites
//!
//! These tests require a real ZKTeco Biopro SA40 device on the network.
//! Run from the office LAN (NAS or workstation):
//!
//! ```bash
//! # Test discovery and provider routing
//! cargo test -p timekeep-zkteco --test e2e_device_test -- --ignored --nocapture
//!
//! # Run a specific test
//! cargo test -p timekeep-zkteco --test e2e_device_test discover -- --ignored --nocapture
//! ```
//!
//! ## Test Devices
//!
//! | Scanner | LAN IP | Serial | Comm Key | Port | Status |
//! |---------|--------|--------|----------|------|--------|
//! | OFFICE | 192.168.100.83 | (unknown) | 0 | 4370 |  Active |
//! | STAFF | 192.168.100.89 | (unknown) | (unknown) | 4370 |  Port closed |
//! | Unmanaged | 192.168.100.74 | (unknown) | (unknown) | 4370 |  Comm key unknown |
//!
//! All tests are **read-only** — no data is written or cleared on the device.

use std::sync::Arc;

use timekeep_core::{
    DeviceProvider, EventBus, ProviderRegistry,
    model::{DeviceProbe, DeviceStatus, DeviceVendor},
};
use timekeep_zkteco::ZkTecoProvider;

// ─── Device constants ────────────────────────────────────────────────

/// OFFICE scanner — the primary test device.
const OFFICE_HOST: &str = "192.168.100.83";
const OFFICE_PORT: u16 = 4370;
const OFFICE_COMM_KEY: u32 = 0;
const OFFICE_SERIAL: &str = "CQZ7232960836";
const OFFICE_MAC: &str = "00:17:61:10:41:52";

/// Fallback: public IP (only works if DMZ is active — likely removed per recommendations).
const _OFFICE_PUBLIC_IP: &str = "88.201.39.242";

// ─── Provider Registry Tests ─────────────────────────────────────────

/// Test that the ZkTecoProvider is correctly registered and returns expected metadata.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_provider_metadata() {
    let provider = ZkTecoProvider::new();

    assert_eq!(provider.vendor_key(), "zkteco");
    assert_eq!(provider.display_name(), "ZKTeco");
    assert_eq!(provider.default_port(), 4370);
    assert!(provider.supports_adms());
    assert!(provider.supports_sdk());

    let caps = provider.capabilities();
    assert!(caps.attendance_read);
    assert!(caps.user_read);
    assert!(caps.fingerprint_enroll);
    assert!(caps.real_time_events);
    println!("✅ Provider metadata verified");
}

/// Test probe_all() against the OFFICE scanner — auto-detection works.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_probe_office_scanner() {
    let mut registry = ProviderRegistry::new();
    registry.register(Arc::new(ZkTecoProvider::new()));

    let probe = registry.probe_all(OFFICE_HOST, OFFICE_PORT).await.expect("probe should succeed");

    assert_eq!(probe.vendor, "zkteco", "vendor should be detected as zkteco");
    assert_eq!(probe.serial_number, OFFICE_SERIAL, "serial should match known device");
    assert_eq!(probe.mac_address, OFFICE_MAC, "MAC should match known device");
    assert!(!probe.model.is_empty(), "model should be populated");
    assert!(!probe.firmware_version.is_empty(), "firmware should be populated");
    assert!(probe.user_count > 0, "device should have enrolled users");
    assert!(probe.record_count > 0, "device should have attendance records");

    println!("✅ OFFICE scanner probed successfully:");
    println!("   model:    {}", probe.model);
    println!("   firmware: {}", probe.firmware_version);
    println!("   platform: {}", probe.platform);
    println!("   MAC:      {}", probe.mac_address);
    println!("   users:    {}", probe.user_count);
    println!("   records:  {}", probe.record_count);
}

/// Test provider creates a working BiometricDevice.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_create_and_connect_device() {
    let provider = ZkTecoProvider::new();
    let event_bus = EventBus::new(8);

    let config = timekeep_core::DeviceConfig {
        label: "OFFICE Scanner".into(),
        serial_number: OFFICE_SERIAL.into(),
        host: OFFICE_HOST.into(),
        port: OFFICE_PORT,
        comm_key: OFFICE_COMM_KEY,
        timezone: Some("Asia/Riyadh".into()),
        push_enabled: false, // Don't start ADMS server (port conflict in test)
        vendor: "zkteco".into(),
        location: Some("HQ Floor 1".into()),
        poll_interval_secs: None,
    };

    let mut device = provider.create_device(config, event_bus).await.expect("create device");
    device.connect().await.expect("connect to device");
    assert!(device.is_connected());
    println!("✅ Device connected via provider");

    device.disconnect().await.expect("disconnect");
    assert!(!device.is_connected());
    println!("✅ Device disconnected cleanly");
}

/// Test full device info extraction via the provider.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_device_info_rich() {
    let provider = ZkTecoProvider::new();
    let event_bus = EventBus::new(8);

    let config = timekeep_core::DeviceConfig {
        label: "OFFICE Scanner".into(),
        serial_number: OFFICE_SERIAL.into(),
        host: OFFICE_HOST.into(),
        port: OFFICE_PORT,
        comm_key: OFFICE_COMM_KEY,
        timezone: Some("Asia/Riyadh".into()),
        push_enabled: false,
        vendor: "zkteco".into(),
        location: None,
        poll_interval_secs: None,
    };

    let mut device = provider.create_device(config, event_bus).await.expect("create");
    device.connect().await.expect("connect");

    let info = device.get_device_info().await.expect("get_device_info");

    // Identity — must match known values from field data
    assert_eq!(info.serial_number, OFFICE_SERIAL);
    assert_eq!(info.mac_address, OFFICE_MAC);
    assert_eq!(info.vendor, DeviceVendor::ZkTeco);
    assert!(!info.model.is_empty(), "model must be populated");
    assert!(!info.firmware_version.is_empty(), "firmware must be populated");
    assert!(!info.platform.is_empty(), "platform must be populated");

    // Status — should be online since we're connected
    assert!(matches!(info.status, DeviceStatus::Online));

    // Capacity — should have non-zero capacities for a real device
    assert!(info.user_capacity > 0, "user capacity should be > 0");
    assert!(info.record_capacity > 0, "record capacity should be > 0");
    assert!(info.fingerprint_capacity > 0, "fingerprint capacity should be > 0");

    // Counts — should match known field data (~116 users, ~11,489 records)
    assert!(info.user_count > 0, "should have enrolled users");
    assert!(info.record_count > 0, "should have attendance records");

    // Derived metrics
    let usage = info.record_usage_pct();
    assert!(usage >= 0.0 && usage <= 100.0, "record usage should be 0-100%");
    assert!(info.is_operational());

    // Device time — should be close to now (within 5 minutes)
    let device_time = device.get_device_time().await.expect("get_device_time");
    let now = jiff::Timestamp::now();
    let diff_secs = (now.as_second() - device_time.as_second()).abs();
    assert!(diff_secs < 300, "device clock within 5 minutes of system clock (diff: {diff_secs}s)");

    println!("✅ Rich device info verified:");
    println!("   model:          {}", info.model);
    println!("   firmware:       {}", info.firmware_version);
    println!("   platform:       {}", info.platform);
    println!("   MAC:            {}", info.mac_address);
    println!("   status:         {:?}", info.status);
    println!("   users:          {} / {}", info.user_count, info.user_capacity);
    println!("   records:        {} / {}", info.record_count, info.record_capacity);
    println!("   fingerprints:   {} / {}", info.fingerprint_count, info.fingerprint_capacity);
    println!("   storage:        {:.1}% used", info.record_usage_pct());
    println!("   time diff:      {}s", diff_secs);

    device.disconnect().await.expect("disconnect");
}

/// Test user enumeration via provider-created device.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_users_list() {
    let provider = ZkTecoProvider::new();
    let event_bus = EventBus::new(8);

    let config = timekeep_core::DeviceConfig {
        label: "OFFICE Scanner".into(),
        serial_number: OFFICE_SERIAL.into(),
        host: OFFICE_HOST.into(),
        port: OFFICE_PORT,
        comm_key: OFFICE_COMM_KEY,
        timezone: Some("Asia/Riyadh".into()),
        push_enabled: false,
        vendor: "zkteco".into(),
        location: None,
        poll_interval_secs: None,
    };

    let mut device = provider.create_device(config, event_bus).await.expect("create");
    device.connect().await.expect("connect");

    let users = device.get_users().await.expect("get_users");

    assert!(!users.is_empty(), "should have enrolled users");
    assert_eq!(users.len(), 116, "should have exactly 116 users (known field count)");

    // Verify a few known users exist (from field data)
    let _has_user = |pin: &str| users.iter().any(|u| u.pin == pin);
    // We don't know specific PINs, but we can verify structure
    for user in &users {
        assert!(!user.pin.is_empty(), "every user must have a PIN");
        assert!(!user.name.is_empty(), "every user must have a name");
        assert!(user.internal_sn > 0, "every user must have an internal SN");
    }

    // Print first 5 users for reference
    println!("✅ User list verified: {} users", users.len());
    for user in users.iter().take(5) {
        println!(
            "   PIN={} Name={} SN={} FP={} Face={}",
            user.pin, user.name, user.internal_sn, user.fingerprint_count, user.has_face
        );
    }

    device.disconnect().await.expect("disconnect");
}

/// Test attendance record retrieval.
#[tokio::test]
#[ignore = "requires real device on network"]
async fn test_attendance_records() {
    let provider = ZkTecoProvider::new();
    let event_bus = EventBus::new(8);

    let config = timekeep_core::DeviceConfig {
        label: "OFFICE Scanner".into(),
        serial_number: OFFICE_SERIAL.into(),
        host: OFFICE_HOST.into(),
        port: OFFICE_PORT,
        comm_key: OFFICE_COMM_KEY,
        timezone: Some("Asia/Riyadh".into()),
        push_enabled: false,
        vendor: "zkteco".into(),
        location: None,
        poll_interval_secs: None,
    };

    let mut device = provider.create_device(config, event_bus).await.expect("create");
    device.connect().await.expect("connect");

    // Get only recent records (last 7 days) to keep the test fast
    let week_ago = jiff::Timestamp::now()
        .saturating_sub(jiff::Span::new().try_days(7).unwrap())
        .unwrap_or(jiff::Timestamp::UNIX_EPOCH);

    let punches = device.get_attendance(Some(week_ago)).await.expect("get_attendance");

    println!("✅ Attendance records retrieved: {} punches in last 7 days", punches.len());

    if !punches.is_empty() {
        // Verify structure
        for punch in &punches {
            assert!(!punch.user_pin.is_empty());
            assert_eq!(punch.device_sn, OFFICE_SERIAL);
            assert!(punch.timestamp.as_second() > 0);
        }

        // Print first 5 for reference
        for punch in punches.iter().take(5) {
            println!(
                "   PIN={} time={} status={:?} verify={:?}",
                punch.user_pin,
                punch.timestamp.as_second(),
                punch.status,
                punch.verify_mode
            );
        }
    }

    device.disconnect().await.expect("disconnect");
}

/// Verify DeviceProbe structure is correct even without a real connection.
#[test]
fn test_probe_structure() {
    let probe = DeviceProbe::minimal("TEST001");
    assert_eq!(probe.serial_number, "TEST001");
    assert_eq!(probe.vendor, "unknown");
    assert!(probe.model.is_empty());

    // Mutate and verify
    let mut probe = DeviceProbe {
        vendor: "zkteco".into(),
        serial_number: "CQZ7232960836".into(),
        model: "Biopro SA40[ID]".into(),
        firmware_version: "Ver 6.60".into(),
        platform: "ZLM60_TFT".into(),
        mac_address: "00:17:61:10:41:52".into(),
        user_count: 116,
        record_count: 11489,
    };

    assert_eq!(probe.serial_number, OFFICE_SERIAL);
    assert_eq!(probe.mac_address, OFFICE_MAC);
    assert!(probe.user_count > 0);

    // Verify the DeviceProbe can be serialized/deserialized (for API)
    let json = serde_json::to_string(&probe).unwrap();
    let back: DeviceProbe = serde_json::from_str(&json).unwrap();
    assert_eq!(back.serial_number, OFFICE_SERIAL);

    // Set record_count for assertion
    probe.record_count = 0;
    assert_eq!(probe.record_count, 0);
}

/// Verify that the provider registry gracefully handles unreachable devices.
#[tokio::test]
async fn test_probe_unreachable_device() {
    let mut registry = ProviderRegistry::new();
    registry.register(Arc::new(ZkTecoProvider::new()));

    // Attempt to probe a non-existent device with a 10-second timeout.
    // The probe should either return an error or time out — both are valid
    // for an unreachable device.
    let result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        registry.probe_all("192.168.255.255", 4370).await
    })
    .await;

    match result {
        Ok(Ok(_)) => panic!("probe should not succeed against unreachable device"),
        Ok(Err(_)) => println!("✅ Probe correctly returned error"),
        Err(_) => println!("✅ Probe correctly timed out"),
    }
}

/// Verify the provider registry works with an empty registry.
#[tokio::test]
async fn test_probe_empty_registry() {
    let registry = ProviderRegistry::new();
    let result = registry.probe_all(OFFICE_HOST, OFFICE_PORT).await;
    assert!(result.is_err(), "empty registry should return error");
    println!("✅ Empty registry handling verified");
}
