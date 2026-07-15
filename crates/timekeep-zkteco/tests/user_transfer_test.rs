#![allow(dead_code)]
//! User sync / transfer test between two devices.
//!
//! Creates test users on STAFF03, transfers them to STAFF02,
//! and verifies they appear on both devices.
//!
//! Run with:
//!   cargo test -p timekeep-zkteco --test user_transfer_test -- --ignored --nocapture

use timekeep_zkteco::sdk::connection::ZkConnection;

const STAFF03_HOST: &str = "localhost";
const STAFF03_PORT: u16 = 14370;
const STAFF03_COMM_KEY: u32 = 1995;

const STAFF02_HOST: &str = "localhost";
const STAFF02_PORT: u16 = 14371;
const STAFF02_COMM_KEY: u32 = 1995;

fn make_test_user(sn: u16, pin: &str, name: &str, privilege: u8) -> timekeep_core::model::User {
    timekeep_core::model::User {
        internal_sn: sn,
        pin: pin.to_string(),
        name: name.to_string(),
        privilege,
        card_number: None,
        group: None,
        timezone: None,
        password_raw: None,
        has_password: false,
        fingerprint_count: 0,
        has_face: false,
    }
}

/// Full transfer test: STAFF03 → STAFF02.
///
/// 1. Creates 3 test users on STAFF03
/// 2. Reads them from STAFF03
/// 3. Transfers each to STAFF02 (using the same SN since STAFF02 is empty)
/// 4. Reads users from STAFF02 to verify
/// 5. Cleans up both devices
#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn transfer_users_staff03_to_staff02() {
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║     User Transfer: STAFF03 → STAFF02                    ║");
    println!("╚══════════════════════════════════════════════════════════╝\n");

    // ── Connect to both devices ──

    println!("── Connecting ──");
    let mut conn03 = ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY)
        .await
        .expect("connect STAFF03");
    let mut conn02 = ZkConnection::connect(STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY)
        .await
        .expect("connect STAFF02");
    println!("  STAFF03 ✅  STAFF02 ✅\n");

    // ── Verify both are empty ──

    let s03_before = conn03.read_sizes().await.expect("read_sizes STAFF03");
    let s02_before = conn02.read_sizes().await.expect("read_sizes STAFF02");
    println!("── Before ──");
    println!("  STAFF03: {} users", s03_before.user_count);
    println!("  STAFF02: {} users", s02_before.user_count);

    // ── Step 1: Create test users on STAFF03 ──

    println!("\n── Step 1: Create test users on STAFF03 ──");
    let test_users = vec![
        make_test_user(101, "EMP001", "Alice Smith", 0),
        make_test_user(102, "EMP002", "Bob Jones", 0),
        make_test_user(103, "EMP003", "Carol White", 14), // admin
    ];

    for u in &test_users {
        print!("  Creating SN={} PIN={}... ", u.internal_sn, u.pin);
        conn03.set_user(u).await.expect("set_user on STAFF03");
        println!("✅");
    }

    let s03_after_create = conn03.read_sizes().await.expect("read_sizes");
    println!("  STAFF03 now has {} users", s03_after_create.user_count);
    assert_eq!(s03_after_create.user_count, 3, "STAFF03 should have 3 users");

    // ── Step 2: Read users from STAFF03 (simulating "source device") ──

    println!("\n── Step 2: Read users from STAFF03 ──");
    let source_users = conn03.get_users().await.expect("get_users from STAFF03");
    println!("  Read {} users:", source_users.len());
    for u in &source_users {
        println!(
            "    SN={:3} PIN='{}' Name='{}' Priv={}",
            u.internal_sn, u.pin, u.name, u.privilege
        );
    }
    assert_eq!(source_users.len(), 3, "should have 3 users");

    // ── Step 3: Transfer each user to STAFF02 ──

    println!("\n── Step 3: Transfer to STAFF02 ──");
    for u in &source_users {
        print!("  Transferring SN={} PIN={}... ", u.internal_sn, u.pin);
        // Re-create the user struct with the same data
        let transfer_user = timekeep_core::model::User {
            internal_sn: u.internal_sn, // Keep same SN (STAFF02 is empty)
            pin: u.pin.clone(),
            name: u.name.clone(),
            privilege: u.privilege,
            card_number: u.card_number.clone(),
            group: u.group,
            timezone: u.timezone,
            password_raw: u.password_raw.clone(),
            has_password: u.has_password,
            fingerprint_count: u.fingerprint_count,
            has_face: u.has_face,
        };
        conn02.set_user(&transfer_user).await.expect("set_user on STAFF02");
        println!("✅");
    }

    // ── Step 4: Verify on STAFF02 ──

    println!("\n── Step 4: Verify on STAFF02 ──");
    let target_users = conn02.get_users().await.expect("get_users from STAFF02");
    println!("  STAFF02 has {} users:", target_users.len());
    for u in &target_users {
        println!(
            "    SN={:3} PIN='{}' Name='{}' Priv={}",
            u.internal_sn, u.pin, u.name, u.privilege
        );
    }
    assert_eq!(target_users.len(), 3, "STAFF02 should have 3 users");

    // Verify each user matches
    for expected in &source_users {
        let found = target_users.iter().find(|u| u.pin == expected.pin);
        assert!(found.is_some(), "user PIN={} should exist on STAFF02", expected.pin);
        let found = found.unwrap();
        assert_eq!(found.name, expected.name, "name should match for PIN={}", expected.pin);
        assert_eq!(
            found.privilege, expected.privilege,
            "privilege should match for PIN={}",
            expected.pin
        );
        println!(
            "  ✅ PIN={} verified: name='{}' privilege={}",
            found.pin, found.name, found.privilege
        );
    }

    // ── Step 5: Clean up both devices ──

    println!("\n── Cleanup ──");
    for sn in [101u16, 102, 103] {
        print!("  Deleting SN={} from STAFF03... ", sn);
        conn03.delete_user(sn).await.expect("delete from STAFF03");
        println!("✅");
        print!("  Deleting SN={} from STAFF02... ", sn);
        conn02.delete_user(sn).await.expect("delete from STAFF02");
        println!("✅");
    }

    let s03_after = conn03.read_sizes().await.expect("read_sizes");
    let s02_after = conn02.read_sizes().await.expect("read_sizes");
    println!("\n── After Cleanup ──");
    println!("  STAFF03: {} users (was {})", s03_after.user_count, s03_before.user_count);
    println!("  STAFF02: {} users (was {})", s02_before.user_count, s02_before.user_count);
    assert_eq!(s03_after.user_count, 0, "STAFF03 should be empty");
    assert_eq!(s02_after.user_count, 0, "STAFF02 should be empty");

    println!("\n✅ FULL TRANSFER TEST PASSED");
}
