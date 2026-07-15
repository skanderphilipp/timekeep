#![allow(dead_code)]
//! Operation log comparison test: SDK OpLog vs ADMS OPERLOG
//!
//! Run with:
//!   cargo test -p timekeep-zkteco --test oplog_test -- --ignored --nocapture

use timekeep_zkteco::sdk::connection::ZkConnection;

const STAFF03_HOST: &str = "localhost";
const STAFF03_PORT: u16 = 14370;
const STAFF03_COMM_KEY: u32 = 1995;

/// Test 1: Create a user, then pull OpLog via SDK to see if the device logged it.
#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn sdk_oplog_after_user_operations() {
    println!("━━━ SDK OpLog After User Operations ━━━\n");

    let mut conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    // Step 1: Check initial oplog count
    let sizes_before = conn.read_sizes().await.expect("read_sizes");
    println!("Initial oplog count: {}", sizes_before.oplog_count);

    // Step 2: Perform user operations
    let test_user = timekeep_core::model::User {
        internal_sn: 777,
        pin: "OPLOGTST".to_string(),
        name: "OpLog Test".to_string(),
        privilege: 0,
        card_number: None,
        group: None,
        timezone: None,
        password_raw: None,
        has_password: false,
        fingerprint_count: 0,
        has_face: false,
    };

    println!("Creating user SN=777...");
    conn.set_user(&test_user).await.expect("set_user");
    println!("Deleting user SN=777...");
    conn.delete_user(777).await.expect("delete_user");

    // Step 3: Check oplog count after operations
    let sizes_after = conn.read_sizes().await.expect("read_sizes");
    println!("\nOplog count after operations: {}", sizes_after.oplog_count);
    println!("Oplog delta: {}", sizes_after.oplog_count as i64 - sizes_before.oplog_count as i64);

    // Step 4: Pull oplogs via SDK if any exist
    if sizes_after.oplog_count > 0 {
        match conn.get_operation_logs().await {
            Ok(logs) => {
                println!("\nSDK OpLog records (last 10):");
                let start = if logs.len() > 10 { logs.len() - 10 } else { 0 };
                for log in logs.iter().skip(start) {
                    let t = log.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
                    println!(
                        "  Admin={} Time={} Op={:?} Params={:?}",
                        log.admin_pin, t, log.operation, log.params
                    );
                }
            },
            Err(e) => println!("⚠️  SDK get_operation_logs failed: {e}"),
        }
    } else {
        println!("\n⚠️  Device did not log SDK operations to OpLog.");
        println!("    This means SDK operations are NOT recorded by the device.");
        println!("    The server must maintain its own audit trail for SDK operations.");
    }
}

/// Test 2: Just pull whatever OpLog is on the device (no new operations).
#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn sdk_oplog_readonly() {
    println!("━━━ SDK OpLog Read-Only ━━━\n");

    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");
    println!("Device sizes:");
    println!("  Users:    {} / {}", sizes.user_count, sizes.user_capacity);
    println!("  Records:  {} / {}", sizes.record_count, sizes.record_capacity);
    println!("  OpLogs:   {}", sizes.oplog_count);
    println!("  FP:       {} / {}", sizes.fp_count, sizes.fp_capacity);

    if sizes.oplog_count > 0 {
        match conn.get_operation_logs().await {
            Ok(logs) => {
                println!("\nSDK OpLog records (all {}):", logs.len());
                for log in &logs {
                    let t = log.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
                    println!(
                        "  Admin={} Time={} Op={:?} Params={:?}",
                        log.admin_pin, t, log.operation, log.params
                    );
                }
            },
            Err(e) => println!("⚠️  SDK get_operation_logs failed: {e}"),
        }
    } else {
        println!("\nNo operation logs on device.");
    }
}
