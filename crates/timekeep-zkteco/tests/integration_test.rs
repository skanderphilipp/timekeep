#![allow(dead_code)]
//! Integration tests against a real ZKTeco Biopro SA40 scanner.
//!
//! Run with:
//!   cargo test -p timekeep-zkteco --test integration_test -- --nocapture --ignored
//!
//! These tests are READ-ONLY (no clear, no set, no delete).

use timekeep_zkteco::sdk::connection::ZkConnection;

const HOST: &str = "88.201.39.242";
const PORT: u16 = 4370;
const COMM_KEY: u32 = 0;

#[tokio::test]
#[ignore = "requires real device on network"]
async fn connect_and_get_device_info() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    println!("CONNECTED: session={}", conn.session_id());

    let info = conn.get_device_info().await.expect("get_device_info");
    println!(
        "DEVICE: model={} serial={} platform={} fw={} mac={}",
        info.model, info.serial_number, info.platform, info.firmware_version, info.mac_address
    );

    let ts = conn.get_time().await.expect("get_time");
    println!("TIME: {}", ts.to_zoned(jiff::tz::TimeZone::UTC));
}

#[tokio::test]
#[ignore = "requires real device on network"]
async fn read_sizes() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    let s = conn.read_sizes().await.expect("read_sizes");

    println!("SIZES:");
    println!("  users:     {} / {}", s.user_count, s.user_capacity);
    println!("  records:   {} / {}", s.record_count, s.record_capacity);
    println!("  fingerprints: {} / {}", s.fp_count, s.fp_capacity);
    println!("  oplogs:    {}", s.oplog_count);
    println!("  admins:    {}", s.admin_count);
    println!(
        "  remaining: user={} rec={} fp={}",
        s.remaining_user, s.remaining_record, s.remaining_fp
    );
}

#[tokio::test]
#[ignore = "requires real device on network"]
async fn get_users_read_only() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    let users = conn.get_users().await.expect("get_users");

    println!("USERS: {} total", users.len());
    for u in users.iter().take(5) {
        println!(
            "  SN={:4} PIN={:10} Name={:24} Priv={}",
            u.internal_sn, u.pin, u.name, u.privilege
        );
    }
    if users.len() > 5 {
        println!("  ... and {} more", users.len() - 5);
    }
    assert!(!users.is_empty(), "device should have users");
}

#[tokio::test]
#[ignore = "requires real device on network"]
async fn get_attendance_read_only() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    let punches = conn.get_attendance(None).await.expect("get_attendance");

    println!("ATTENDANCE: {} records", punches.len());
    for p in punches.iter().take(5) {
        let t = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
        println!("  PIN={:10} Time={} Status={:?}", p.user_pin, t, p.status);
    }
    if punches.len() > 5 {
        println!("  ... and {} more", punches.len() - 5);
    }
    assert!(!punches.is_empty(), "device should have attendance records");
}

#[tokio::test]
#[ignore = "requires real device on network"]
async fn get_operation_logs_read_only() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    match conn.get_operation_logs().await {
        Ok(logs) => {
            println!("OPLOGS: {} entries", logs.len());
            for l in logs.iter().take(5) {
                let t = l.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
                println!(
                    "  Admin={} Time={} Op={:?} Params={:?}",
                    l.admin_pin, t, l.operation, l.params
                );
            }
        },
        Err(e) => {
            // Operation logs may fail on some firmware versions
            println!("OPLOGS: not supported or empty — {e}");
        },
    }
}

#[tokio::test]
#[ignore = "requires real device on network"]
async fn get_network_params() {
    let conn = ZkConnection::connect(HOST, PORT, COMM_KEY).await.expect("connect");
    match conn.get_network_params().await {
        Ok(p) => println!(
            "NETWORK: ip={} mask={} gw={} dns={}",
            p.ip_address, p.netmask, p.gateway, p.dns
        ),
        Err(e) => println!("NETWORK: unavailable — {e}"),
    }
}
