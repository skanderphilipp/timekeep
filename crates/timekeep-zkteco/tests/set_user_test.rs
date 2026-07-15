#![allow(dead_code)]
//! Set user round-trip diagnostic test.
//!
//! Run with:
//!   cargo test -p timekeep-zkteco --test set_user_test -- --ignored --nocapture

use timekeep_zkteco::sdk::connection::ZkConnection;

const STAFF03_HOST: &str = "localhost";
const STAFF03_PORT: u16 = 14370;
const STAFF03_COMM_KEY: u32 = 1995;

/// Creates a test user on the device, reads it back, and deletes it.
/// This is the critical round-trip test for the encoder.
#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn set_user_roundtrip_staff03() {
    println!("━━━ STAFF03 — Set User Round-Trip ━━━");

    let mut conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    let info = conn.get_device_info().await.expect("get_device_info");
    println!("  Platform: '{}' (firmware: {})", info.platform, info.firmware_version);

    // Check current user count
    let sizes_before = conn.read_sizes().await.expect("read_sizes before");
    println!("  Users before: {}", sizes_before.user_count);

    // Create a test user
    let test_sn: u16 = 999;
    let test_user = timekeep_core::model::User {
        internal_sn: test_sn,
        pin: "TEST999".to_string(),
        name: "Diag Test".to_string(),
        privilege: 0, // common user
        card_number: None,
        group: None,
        timezone: None,
        password_raw: None,
        has_password: false,
        fingerprint_count: 0,
        has_face: false,
    };

    println!("  Creating user: SN={} PIN=TEST999 Name='Diag Test'", test_sn);
    match conn.set_user(&test_user).await {
        Ok(()) => println!("  ✅ set_user succeeded"),
        Err(e) => {
            println!("  ❌ set_user failed: {e}");
            return;
        },
    }

    // Read back
    let sizes_after = conn.read_sizes().await.expect("read_sizes after");
    println!("  Users after: {}", sizes_after.user_count);
    assert!(
        sizes_after.user_count > sizes_before.user_count,
        "User count should increase after set_user"
    );

    match conn.get_users().await {
        Ok(users) => {
            println!("  Users read: {}", users.len());
            if let Some(found) = users.iter().find(|u| u.pin == "TEST999") {
                println!("  ✅ Found test user:");
                println!("    internal_sn:  {}", found.internal_sn);
                println!("    pin:         '{}'", found.pin);
                println!("    name:        '{}'", found.name);
                println!("    privilege:   {}", found.privilege);
            } else {
                println!("  ❌ Test user not found in user list!");
            }
        },
        Err(e) => println!("  ❌ get_users failed: {e}"),
    }

    // Cleanup: delete the test user
    println!("  Cleaning up: deleting user SN={}", test_sn);
    match conn.delete_user(test_sn).await {
        Ok(()) => println!("  ✅ delete_user succeeded"),
        Err(e) => println!("  ⚠️  delete_user failed: {e}"),
    }

    let sizes_final = conn.read_sizes().await.unwrap_or_default();
    println!("  Users final: {}", sizes_final.user_count);
    assert!(
        sizes_final.user_count < sizes_after.user_count,
        "User count should decrease after delete_user"
    );
}
