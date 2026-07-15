#![allow(dead_code)]
//! Integration tests using the ZKTeco device simulator.
//!
//! These tests exercise the full `ZkConnection` TCP stack against a
//! simulated device — no physical hardware required.
//!
//! Run with:
//! ```bash
//! cargo test -p timekeep-zkteco --test simulator_test -- --nocapture
//! ```

mod simulator;

use simulator::ZkSimServer;
use timekeep_zkteco::sdk::connection::ZkConnection;

// ── Connection & authentication ───────────────────────────────────────

/// Verify that `ZkConnection::connect()` successfully completes the
/// CONNECT → AUTH → OPTIONS_WRQ handshake against a simulator.
#[tokio::test]
async fn connect_and_handshake() {
    // Simulator that accepts any handshake and echoes ACK_OK for everything
    let sim = ZkSimServer::with_handshake(|_cmd, _data, session, reply| {
        vec![simulator::ack(session, reply, &[])]
    })
    .await;

    let (host, port) = sim.host_port();
    let _conn = ZkConnection::connect(&host, port, 12345 /* any comm key */)
        .await
        .expect("connect should succeed against simulator");

    sim.shutdown().await;
}

// ── Device info ───────────────────────────────────────────────────────

/// Verify that `get_device_info()` reads firmware version, serial,
/// platform, and MAC from the simulator.
#[tokio::test]
async fn get_device_info() {
    let sim = ZkSimServer::with_handshake(|cmd, data, session, reply| match cmd {
        1100 /* GET_VERSION */ => {
            vec![simulator::ack(session, reply, b"Ver 6.60 Aug 22 2023\x00")]
        },
        11 /* OPTIONS_RRQ */ => {
            let param = String::from_utf8_lossy(data)
                .trim_end_matches('\x00')
                .to_string();
            let val = match param.as_str() {
                "~SerialNumber" => "SIM-DEVICE-001",
                "~DeviceName" => "Simulated Biopro SA40",
                "~Platform" => "ZLM60_TFT_LONGNAME",
                "MAC" => "00:11:22:33:44:55",
                _ => "",
            };
            vec![simulator::ack(session, reply, format!("{param}={val}").as_bytes())]
        },
        _ => vec![simulator::ack(session, reply, &[])],
    })
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let info = conn.get_device_info().await.expect("get_device_info");

    assert_eq!(info.serial_number, "SIM-DEVICE-001");
    assert_eq!(info.model, "Simulated Biopro SA40");
    assert_eq!(info.platform, "ZLM60_TFT_LONGNAME");
    assert_eq!(info.mac_address, "00:11:22:33:44:55");
    assert_eq!(info.firmware_version, "Ver 6.60 Aug 22 2023");

    sim.shutdown().await;
}

// ── Capacity / sizes ──────────────────────────────────────────────────

#[tokio::test]
async fn read_sizes() {
    let sim = ZkSimServer::with_handshake(|cmd, _data, session, reply| match cmd {
        50 /* GET_FREE_SIZES */ => {
            vec![simulator::ack(session, reply, &simulator::sizes_blob(42, 9999, 84))]
        },
        _ => vec![simulator::ack(session, reply, &[])],
    })
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");

    assert_eq!(sizes.user_count, 42);
    assert_eq!(sizes.record_count, 9999);
    assert_eq!(sizes.fp_count, 84);
    assert_eq!(sizes.user_capacity, 1042); // 42 + 1000
    assert_eq!(sizes.record_capacity, 59999); // 9999 + 50000
    assert_eq!(sizes.fp_capacity, 3084); // 84 + 3000
    assert_eq!(sizes.face_count, 84);
    assert_eq!(sizes.face_capacity, 1084); // 84 + 1000

    sim.shutdown().await;
}

// ── Device time ───────────────────────────────────────────────────────

#[tokio::test]
async fn get_device_time() {
    let sim = ZkSimServer::with_handshake(|cmd, _data, session, reply| match cmd {
        201 /* GET_TIME */ => {
             // Return time in ZKTeco packed format (not Unix epoch)
             let zk_time = timekeep_zkteco::protocol::encoding::encode_zk_time(
                 jiff::Timestamp::now(),
             ).unwrap();
             vec![simulator::ack(session, reply, &zk_time.to_le_bytes())]
        },
        _ => vec![simulator::ack(session, reply, &[])],
    })
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let device_time = conn.get_time().await.expect("get_time");

    // Device time should be within 5 seconds of now
    let diff = (jiff::Timestamp::now().as_second() - device_time.as_second()).abs();
    assert!(diff < 5, "device time within 5s of now (diff: {diff}s)");

    sim.shutdown().await;
}

// ── User retrieval via buffered-data protocol ─────────────────────────

#[tokio::test]
async fn get_users_buffered() {
    // Build a single 72-byte ZK8 user record
    let user_record = {
        let mut rec = vec![0u8; 72];
        // Bytes 0-1: user serial number (u16 LE)
        rec[0] = 1;
        rec[1] = 0;
        // Bytes 2-3: privilege (0 = normal)
        // Bytes 11-34: name (24 bytes)
        let name = b"Alice";
        rec[11..11 + name.len()].copy_from_slice(name);
        // Bytes 48-71: PIN (24 bytes, null-terminated)
        let pin = b"1001";
        rec[48..48 + pin.len()].copy_from_slice(pin);
        rec
    };

    // Build the blob: [total_size: u32 LE][records...]
    let mut user_blob = Vec::with_capacity(4 + 72);
    user_blob.extend_from_slice(&72u32.to_le_bytes()); // total data size
    user_blob.extend_from_slice(&user_record);

    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sim = ZkSimServer::with_handshake(simulator::canned_responder(
        user_blob,
        empty_blob.clone(),
        1,
        0,
    ))
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let users = conn.get_users().await.expect("get_users");

    assert_eq!(users.len(), 1);
    assert_eq!(users[0].pin, "1001");
    assert_eq!(users[0].name, "Alice");
    assert_eq!(users[0].internal_sn, 1);

    sim.shutdown().await;
}

// ── Attendance retrieval via buffered-data protocol ───────────────────

#[tokio::test]
async fn get_attendance_buffered() {
    // Build a single 40-byte attendance record
    let att_record = {
        let mut rec = vec![0u8; 40];
        // Bytes 0-1: user serial number (u16 LE)
        rec[0] = 0x01;
        rec[1] = 0x00;
        // Bytes 2-10: user_id (9 bytes, null-terminated)
        let pin = b"1001";
        rec[2..2 + pin.len()].copy_from_slice(pin);
        // Byte 26: verify type (1 = fingerprint)
        rec[26] = 1;
        // Bytes 27-30: timestamp (ZK packed format, not Unix epoch)
        let zk_ts: u32 = timekeep_zkteco::protocol::encoding::encode_zk_time(
            jiff::Timestamp::from_second(1752201600).unwrap(),
        )
        .unwrap();
        rec[27..31].copy_from_slice(&zk_ts.to_le_bytes());
        // Byte 31: status (0 = check-in)
        rec[31] = 0;
        rec
    };

    let mut att_blob = Vec::with_capacity(4 + 40);
    att_blob.extend_from_slice(&40u32.to_le_bytes()); // total size
    att_blob.extend_from_slice(&att_record);

    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sim =
        ZkSimServer::with_handshake(simulator::canned_responder(empty_blob, att_blob, 0, 1)).await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let punches = conn.get_attendance(None).await.expect("get_attendance");

    assert_eq!(punches.len(), 1);
    assert_eq!(punches[0].user_pin, "1001");
    assert_eq!(punches[0].timestamp.as_second(), 1752201600);

    sim.shutdown().await;
}

// ── `since` parameter filtering ──────────────────────────────────────

/// Verify that `get_attendance(since)` filters out records whose timestamp
/// is on or before the since cursor.
#[tokio::test]
async fn get_attendance_with_since_filters_old_records() {
    let make_record = |user_pin: &str, ts_secs: i64| -> Vec<u8> {
        let mut rec = vec![0u8; 40];
        rec[0] = 0x01;
        rec[1] = 0x00;
        let pin = user_pin.as_bytes();
        rec[2..2 + pin.len().min(9)].copy_from_slice(pin);
        rec[26] = 1;
        let zk_ts: u32 = timekeep_zkteco::protocol::encoding::encode_zk_time(
            jiff::Timestamp::from_second(ts_secs).unwrap(),
        )
        .unwrap();
        rec[27..31].copy_from_slice(&zk_ts.to_le_bytes());
        rec[31] = 0;
        rec
    };

    let rec_old = make_record("1001", 1_000_000_000);
    let rec_new = make_record("1002", 2_000_000_000);

    let mut att_blob = Vec::with_capacity(4 + 40 + 40);
    att_blob.extend_from_slice(&80u32.to_le_bytes());
    att_blob.extend_from_slice(&rec_old);
    att_blob.extend_from_slice(&rec_new);

    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sim = ZkSimServer::with_handshake(simulator::canned_responder(
        empty_blob.clone(),
        att_blob,
        0,
        2,
    ))
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let since = jiff::Timestamp::from_second(1_500_000_000).expect("valid timestamp");
    let punches = conn.get_attendance(Some(since)).await.expect("get_attendance with since");

    assert_eq!(punches.len(), 1, "only the 2B record should pass the 1.5B cursor");
    assert_eq!(punches[0].user_pin, "1002");
    assert_eq!(punches[0].timestamp.as_second(), 2_000_000_000);

    sim.shutdown().await;
}

/// Verify that `get_attendance(None)` returns all records (no filtering).
#[tokio::test]
async fn get_attendance_without_since_returns_all() {
    let make_record = |user_pin: &str, ts_secs: i64| -> Vec<u8> {
        let mut rec = vec![0u8; 40];
        rec[0] = 0x01;
        rec[1] = 0x00;
        let pin = user_pin.as_bytes();
        rec[2..2 + pin.len().min(9)].copy_from_slice(pin);
        rec[26] = 1;
        let zk_ts: u32 = timekeep_zkteco::protocol::encoding::encode_zk_time(
            jiff::Timestamp::from_second(ts_secs).unwrap(),
        )
        .unwrap();
        rec[27..31].copy_from_slice(&zk_ts.to_le_bytes());
        rec[31] = 0;
        rec
    };

    let rec1 = make_record("1001", 1_000_000_000);
    let rec2 = make_record("1002", 2_000_000_000);

    let mut att_blob = Vec::with_capacity(4 + 40 + 40);
    att_blob.extend_from_slice(&80u32.to_le_bytes());
    att_blob.extend_from_slice(&rec1);
    att_blob.extend_from_slice(&rec2);

    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sim = ZkSimServer::with_handshake(simulator::canned_responder(
        empty_blob.clone(),
        att_blob,
        0,
        2,
    ))
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let punches = conn.get_attendance(None).await.expect("get_attendance");

    assert_eq!(punches.len(), 2, "without since, all records should be returned");

    sim.shutdown().await;
}

// ── Error handling ──

/// Verify that connecting to a non-existent port fails.
#[tokio::test]
async fn connect_to_nonexistent_fails() {
    // Use a port that nothing listens on (likely, anyway)
    let result = ZkConnection::connect("127.0.0.1", 19999, 0).await;
    assert!(result.is_err(), "connect to closed port must fail");
}

/// Verify that a closed simulator rejects new connections.
#[tokio::test]
async fn connect_to_shutdown_simulator_fails() {
    let sim = ZkSimServer::with_handshake(|_cmd, _data, session, reply| {
        vec![simulator::ack(session, reply, &[])]
    })
    .await;

    let addr = sim.addr();
    sim.shutdown().await;

    // Give the OS a moment to release the port
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    let result = ZkConnection::connect(&addr.ip().to_string(), addr.port(), 0).await;
    assert!(result.is_err(), "connect to shutdown simulator must fail");
}

// ── Bench: many users ─────────────────────────────────────────────────

/// Verify the simulator handles a realistic user count (116).
#[tokio::test]
async fn many_users() {
    let count: usize = 116;

    // Build 116 72-byte user records (total_size header only, no record_count)
    let mut user_blob = Vec::with_capacity(4 + count * 72);
    user_blob.extend_from_slice(&((count * 72) as u32).to_le_bytes());

    for i in 0..count {
        let mut rec = vec![0u8; 72];
        let sn = (i + 1) as u16;
        rec[0..2].copy_from_slice(&sn.to_le_bytes());
        let name = format!("User{i:03}");
        let name_bytes = name.as_bytes();
        rec[11..11 + name_bytes.len().min(24)].copy_from_slice(name_bytes);
        let pin = format!("{i:04}");
        let pin_bytes = pin.as_bytes();
        rec[48..48 + pin_bytes.len().min(24)].copy_from_slice(pin_bytes);
        user_blob.extend_from_slice(&rec);
    }

    let empty_blob = 0u32.to_le_bytes().to_vec();

    let sim = ZkSimServer::with_handshake(simulator::canned_responder(
        user_blob,
        empty_blob,
        count as u32,
        0,
    ))
    .await;

    let (host, port) = sim.host_port();
    let conn = ZkConnection::connect(&host, port, 0).await.expect("connect");

    let users = conn.get_users().await.expect("get_users");
    assert_eq!(users.len(), count, "should return all {count} users");

    // Spot-check a few
    assert_eq!(users[0].pin, "0000");
    assert_eq!(users[0].name, "User000");
    assert_eq!(users[115].pin, "0115");
    assert_eq!(users[115].name, "User115");

    sim.shutdown().await;
}
