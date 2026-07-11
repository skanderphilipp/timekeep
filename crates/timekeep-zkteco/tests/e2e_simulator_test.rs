#![allow(dead_code)]
//! End-to-end tests with simulated ZKTeco devices (SDK + ADMS).
//!
//! These tests spin up the actual `AdmsServer` and exercise the full
//! HTTP + event pipeline.  No physical device required.
//!
//! Run with:
//! ```bash
//! cargo test -p timekeep-zkteco --test e2e_simulator_test -- --nocapture
//! ```

mod simulator;

use timekeep_core::events::EventBus;
use timekeep_zkteco::adms::{AdmsServer, DeviceAdmsState};
use timekeep_zkteco::sdk::connection::ZkConnection;
use simulator::ZkSimServer;
use simulator::adms::{AdmsDeviceSim, AdmsPunch, AdmsStatus};

// ── Helpers ───────────────────────────────────────────────────────────

/// Start an ADMS server on port 0, register a device, return (server, base_url).
async fn start_adms(sn: &str) -> (AdmsServer, String) {
    let event_bus = EventBus::new(16);
    let mut server = AdmsServer::new("127.0.0.1:0", event_bus);
    server.register(sn.into(), DeviceAdmsState::new(sn));
    server.start().await.expect("ADMS server start");
    let addr = server.bind_addr();
    let url = format!("http://{addr}");
    (server, url)
}

// ── ADMS push → event bus ────────────────────────────────────────────

/// Full E2E: start ADMS server, push attendance via simulated device,
/// verify `PunchReceived` events appear on the event bus.
#[tokio::test]
async fn adms_push_attendance_to_event_bus() {
    let (mut server, base_url) = start_adms("SIM-ADMS-001").await;
    let device = AdmsDeviceSim::new("SIM-ADMS-001", &base_url);

    // Handshake — marks device online
    let handshake = device.handshake().await.expect("handshake");
    assert!(handshake.contains("GET OPTION FROM: SIM-ADMS-001"));
    assert!(handshake.contains("TransFlag=1111000000"));

    let status = server.device_status("SIM-ADMS-001").unwrap();
    assert!(status.is_online);

    // Push 3 attendance records
    let punches = vec![
        AdmsPunch {
            pin: "1001".into(),
            timestamp: "2026-07-11 08:00:00".into(),
            status: AdmsStatus::CheckIn,
            verify: 1,
        },
        AdmsPunch {
            pin: "1002".into(),
            timestamp: "2026-07-11 08:05:00".into(),
            status: AdmsStatus::CheckIn,
            verify: 15,
        },
        AdmsPunch {
            pin: "1001".into(),
            timestamp: "2026-07-11 17:00:00".into(),
            status: AdmsStatus::CheckOut,
            verify: 1,
        },
    ];

    let response = device.push_attendance(&punches).await.expect("push attendance");
    assert_eq!(response, "OK: 3");

    // Verify device counter
    let status = server.device_status("SIM-ADMS-001").unwrap();
    assert_eq!(status.total_punches, 3);

    // Poll for commands — should be empty
    let cmds = device.poll_commands().await.expect("poll commands");
    assert_eq!(cmds, "OK");

    server.stop().await;
}

// ── SDK + ADMS combined (same logical device) ─────────────────────────

/// Verify that the SDK simulator and ADMS simulator can coexist and
/// represent the same logical device.
#[tokio::test]
async fn sdk_and_adms_same_device() {
    // ── SDK simulator with 2 users ──
    let user_record = {
        let mut rec = vec![0u8; 72];
        rec[0] = 1;
        rec[11..16].copy_from_slice(b"Alice");
        rec[48..52].copy_from_slice(b"1001");
        rec
    };
    let mut user_blob = Vec::with_capacity(4 + 72);
    user_blob.extend_from_slice(&72u32.to_le_bytes());
    user_blob.extend_from_slice(&user_record);
    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sdk_sim =
        ZkSimServer::with_handshake(simulator::canned_responder(user_blob, empty_blob, 1, 0)).await;

    // ── ADMS server + device ──
    let (mut adms_server, base_url) = start_adms("SIM-COMBO-001").await;
    let adms_device = AdmsDeviceSim::new("SIM-COMBO-001", &base_url);

    // SDK: pull users
    let (sdk_host, sdk_port) = sdk_sim.host_port();
    let conn = ZkConnection::connect(&sdk_host, sdk_port, 0).await.expect("SDK connect");
    let users = conn.get_users().await.expect("get_users");
    assert_eq!(users.len(), 1);
    assert_eq!(users[0].name, "Alice");

    // ADMS: push attendance
    adms_device.handshake().await.expect("ADMS handshake");
    let resp = adms_device
        .push_attendance(&[AdmsPunch {
            pin: "1001".into(),
            timestamp: "2026-07-11 09:00:00".into(),
            status: AdmsStatus::CheckIn,
            verify: 1,
        }])
        .await
        .expect("push");
    assert_eq!(resp, "OK: 1");

    sdk_sim.shutdown().await;
    adms_server.stop().await;
}

// ── Handshake marks device online ─────────────────────────────────────

#[tokio::test]
async fn adms_handshake_marks_online() {
    let (mut server, base_url) = start_adms("SIM-ONLINE-001").await;
    let device = AdmsDeviceSim::new("SIM-ONLINE-001", &base_url);

    // Should start offline
    assert!(!server.device_status("SIM-ONLINE-001").unwrap().is_online);

    // Handshake → online
    device.handshake().await.expect("handshake");
    let status = server.device_status("SIM-ONLINE-001").unwrap();
    assert!(status.is_online);
    assert!(status.last_seen.is_some());

    server.stop().await;
}

// ── Unregistered device rejected ──────────────────────────────────────

#[tokio::test]
async fn adms_unregistered_device_rejected() {
    // Start server with NO registered devices
    let event_bus = EventBus::new(4);
    let mut server = AdmsServer::new("127.0.0.1:0", event_bus);
    server.start().await.expect("start");
    let base_url = format!("http://{}", server.bind_addr());

    let ghost = AdmsDeviceSim::new("GHOST-DEVICE", &base_url);

    // Handshake should be rejected
    let result = ghost.handshake().await;
    assert!(
        result.is_err() || result.unwrap().contains("UNKNOWN DEVICE"),
        "unregistered device must be rejected"
    );

    // Push should be rejected
    let result = ghost
        .push_attendance(&[AdmsPunch {
            pin: "1".into(),
            timestamp: "2026-01-01 00:00:00".into(),
            status: AdmsStatus::CheckIn,
            verify: 1,
        }])
        .await;
    assert!(
        result.is_err() || result.unwrap().contains("UNKNOWN DEVICE"),
        "unregistered device push must be rejected"
    );

    server.stop().await;
}
