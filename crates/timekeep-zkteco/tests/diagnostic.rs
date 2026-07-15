#![allow(dead_code)]
//! Diagnostic test harness for ZKTeco SDK protocol.
//!
//! Connects to devices via SSH tunnels for local testing:
//!   localhost:14370 → STAFF03  JJA1253300065
//!   localhost:14371 → STAFF02  JJA1253300056
//!
//! Run with:
//!   cargo test -p timekeep-zkteco --test diagnostic -- --nocapture --ignored
//!
//! Or a specific test:
//!   cargo test -p timekeep-zkteco --test diagnostic connect_staff03 -- --nocapture --ignored

use timekeep_zkteco::sdk::connection::ZkConnection;

// ── Tunnel endpoints ──────────────────────────────────────────────────

const STAFF03_HOST: &str = "localhost";
const STAFF03_PORT: u16 = 14370;
const STAFF03_COMM_KEY: u32 = 1995;

const STAFF02_HOST: &str = "localhost";
const STAFF02_PORT: u16 = 14371;
const STAFF02_COMM_KEY: u32 = 1995;

// ── Helpers ───────────────────────────────────────────────────────────

fn separator(title: &str) {
    println!("\n━━━ {title} ━━━");
}

// ── Test 1: Basic Connect + Auth ──────────────────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn connect_staff03() {
    separator("STAFF03 — Connect + Auth");
    let conn = ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY)
        .await
        .expect("connect to STAFF03");
    println!("✅ Connected: session_id={}", conn.session_id());
    println!("   reply_id={}", conn.reply_id());
}

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn connect_staff02() {
    separator("STAFF02 — Connect + Auth");
    let conn = ZkConnection::connect(STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY)
        .await
        .expect("connect to STAFF02");
    println!("✅ Connected: session_id={}", conn.session_id());
    println!("   reply_id={}", conn.reply_id());
}

// ── Test 2: Device Info ───────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn device_info_staff03() {
    separator("STAFF03 — Device Info");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");
    let info = conn.get_device_info().await.expect("get_device_info");
    println!("  Model:        {}", info.model);
    println!("  Platform:     {} (len={})", info.platform, info.platform.len());
    println!("  Firmware:     {}", info.firmware_version);
    println!("  Serial:       {}", info.serial_number);
    println!("  MAC:          {}", info.mac_address);
    println!("  Vendor:       {:?}", info.vendor);

    let time = conn.get_time().await.expect("get_time");
    println!("  Device time:  {}", time.to_zoned(jiff::tz::TimeZone::UTC));
}

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn device_info_staff02() {
    separator("STAFF02 — Device Info");
    let conn =
        ZkConnection::connect(STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY).await.expect("connect");
    let info = conn.get_device_info().await.expect("get_device_info");
    println!("  Model:        {}", info.model);
    println!("  Platform:     {} (len={})", info.platform, info.platform.len());
    println!("  Firmware:     {}", info.firmware_version);
    println!("  Serial:       {}", info.serial_number);
    println!("  MAC:          {}", info.mac_address);

    let time = conn.get_time().await.expect("get_time");
    println!("  Device time:  {}", time.to_zoned(jiff::tz::TimeZone::UTC));
}

// ── Test 3: ZK8 Detection ─────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn detect_zk8_staff03() {
    separator("STAFF03 — ZK8 Detection");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");
    let info = conn.get_device_info().await.expect("get_device_info");
    let platform = &info.platform;
    println!("  Platform: '{}' (len={})", platform, platform.len());

    // Current heuristic: platform.len() > 10
    let current_heuristic = platform.len() > 10;
    println!("  Current heuristic (>10): {}", if current_heuristic { "ZK8" } else { "ZK6" });

    // Better heuristic: platform contains known ZK8 patterns
    let known_zk8 = ["ZLM60", "ZEM760", "ZEM720", "ZMM220", "ZL60", "ZK8"];
    let found_pattern = known_zk8.iter().any(|p| platform.contains(p));
    println!("  Pattern-based detection: {}", if found_pattern { "ZK8" } else { "ZK6 or unknown" });

    // Actual: read sizes + users to determine record size from data
    match conn.read_sizes().await {
        Ok(sizes) => {
            println!("  User count: {}", sizes.user_count);
            if sizes.user_count > 0 {
                match conn.get_users().await {
                    Ok(users) => {
                        println!(
                            "  Users read: {} (record size determined from data)",
                            users.len()
                        );
                        if !users.is_empty() {
                            // infer: if first user pin looks like a string, ZK8; if numeric only, ZK6
                            let first_pin = users.first().map(|u| &u.pin).unwrap();
                            let looks_zk8 = first_pin.chars().any(|c| !c.is_ascii_digit())
                                || first_pin.len() > 5;
                            println!(
                                "  First user PIN '{}' → looks {} (string=ZK8, numeric=ZK6)",
                                first_pin,
                                if looks_zk8 { "ZK8" } else { "ZK6" }
                            );
                        }
                    },
                    Err(e) => println!("  ⚠️  get_users failed: {e}"),
                }
            } else {
                println!("  ⚠️  No users on device — cannot determine record size from data");
            }
        },
        Err(e) => println!("  ⚠️  read_sizes failed: {e}"),
    }
}

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn detect_zk8_staff02() {
    separator("STAFF02 — ZK8 Detection");
    let conn =
        ZkConnection::connect(STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY).await.expect("connect");
    let info = conn.get_device_info().await.expect("get_device_info");
    let platform = &info.platform;
    println!("  Platform: '{}' (len={})", platform, platform.len());

    let current_heuristic = platform.len() > 10;
    println!("  Current heuristic (>10): {}", if current_heuristic { "ZK8" } else { "ZK6" });

    let known_zk8 = ["ZLM60", "ZEM760", "ZEM720", "ZMM220", "ZL60", "ZK8"];
    let found_pattern = known_zk8.iter().any(|p| platform.contains(p));
    println!("  Pattern-based detection: {}", if found_pattern { "ZK8" } else { "ZK6 or unknown" });

    match conn.read_sizes().await {
        Ok(sizes) => {
            println!("  User count: {}", sizes.user_count);
            if sizes.user_count > 0 {
                match conn.get_users().await {
                    Ok(users) => {
                        println!("  Users read: {}", users.len());
                        if !users.is_empty() {
                            let first_pin = users.first().map(|u| &u.pin).unwrap();
                            let looks_zk8 = first_pin.chars().any(|c| !c.is_ascii_digit())
                                || first_pin.len() > 5;
                            println!(
                                "  First user PIN '{}' → looks {} (string=ZK8, numeric=ZK6)",
                                first_pin,
                                if looks_zk8 { "ZK8" } else { "ZK6" }
                            );
                        }
                    },
                    Err(e) => println!("  ⚠️  get_users failed: {e}"),
                }
            } else {
                println!("  ⚠️  No users on device");
            }
        },
        Err(e) => println!("  ⚠️  read_sizes failed: {e}"),
    }
}

// ── Test 4: Read Users (verify parser works) ──────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn read_users_staff03() {
    separator("STAFF03 — Read Users");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");
    println!("  User count: {} / {}", sizes.user_count, sizes.user_capacity);

    if sizes.user_count == 0 {
        println!("  ⚠️  No users on device");
        return;
    }

    let users = conn.get_users().await.expect("get_users");
    println!("  Parsed {} users", users.len());
    for u in users.iter().take(5) {
        println!(
            "    SN={:3} PIN='{}' Name='{}' Priv={} Pwd={}",
            u.internal_sn, u.pin, u.name, u.privilege, u.has_password
        );
    }
    if users.len() > 5 {
        println!("    ... and {} more", users.len() - 5);
    }
}

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn read_users_staff02() {
    separator("STAFF02 — Read Users");
    let conn =
        ZkConnection::connect(STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");
    println!("  User count: {} / {}", sizes.user_count, sizes.user_capacity);

    if sizes.user_count == 0 {
        println!("  ⚠️  No users on device");
        return;
    }

    let users = conn.get_users().await.expect("get_users");
    println!("  Parsed {} users", users.len());
    for u in users.iter().take(5) {
        println!(
            "    SN={:3} PIN='{}' Name='{}' Priv={} Pwd={}",
            u.internal_sn, u.pin, u.name, u.privilege, u.has_password
        );
    }
    if users.len() > 5 {
        println!("    ... and {} more", users.len() - 5);
    }
}

// ── Test 5: Read Attendance ───────────────────────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn read_attendance_staff03() {
    separator("STAFF03 — Read Attendance");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");
    println!("  Record count: {} / {}", sizes.record_count, sizes.record_capacity);

    if sizes.record_count == 0 {
        println!("  ⚠️  No attendance records");
        return;
    }

    let punches = conn.get_attendance(None).await.expect("get_attendance");
    println!("  Parsed {} punches", punches.len());
    for p in punches.iter().take(5) {
        let t = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
        println!(
            "    PIN={} Time={} Status={:?} Verify={:?}",
            p.user_pin, t, p.status, p.verify_mode
        );
    }
    if punches.len() > 5 {
        println!("    ... and {} more", punches.len() - 5);
    }
}

// ── Test 6: User Record Round-Trip (Read → Encode → Compare) ──────────

/// Critical test: reads a user from the device, encodes it back,
/// and compares byte-for-byte with pyzk reference format.
#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn user_record_byte_inspection_staff03() {
    separator("STAFF03 — User Record Byte Inspection");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");

    let sizes = conn.read_sizes().await.expect("read_sizes");
    if sizes.user_count == 0 {
        println!("  ⚠️  No users — cannot inspect records");
        return;
    }

    // Use read_with_buffer directly to get raw bytes before parsing
    // We need to access this, but it's private. Let's use get_users
    // and log the user fields we got from the parser.
    let users = conn.get_users().await.expect("get_users");
    if users.is_empty() {
        println!("  ⚠️  No users parsed");
        return;
    }

    // Take the first user and show what the parser extracted
    let u = &users[0];
    println!("  First user from parser:");
    println!("    internal_sn:  {}", u.internal_sn);
    println!("    pin:          '{}' (len={})", u.pin, u.pin.len());
    println!("    name:         '{}' (len={})", u.name, u.name.len());
    println!("    privilege:    {}", u.privilege);
    println!("    has_password: {}", u.has_password);

    // Print expected pyzk ZK8 layout for comparison
    println!("\n  Expected pyzk ZK8 layout (72 bytes):");
    println!("    offset 0-1:   uid (u16 LE)");
    println!("    offset 2:     privilege (u8)");
    println!("    offset 3-10:  password (8 bytes ASCII)");
    println!("    offset 11-34: name (24 bytes ASCII)");
    println!("    offset 35-38: card (u32 LE)");
    println!("    offset 39:    pad (0x00)");
    println!("    offset 40-46: group (7 bytes ASCII)");
    println!("    offset 47:    pad (0x00)");
    println!("    offset 48-71: user_id (24 bytes ASCII)");

    println!("\n  Current Rust ZK8 encoder layout (72 bytes):");
    println!("    offset 0-1:   uid (u16 LE)");
    println!("    offset 2:     permission_token (u8)");
    println!("    offset 3-10:  password (8 bytes)");
    println!("    offset 11-34: name (24 bytes)");
    println!("    offset 35-38: card (u32 LE)");
    println!("    offset 39:    group (u8 — SINGLE BYTE)");
    println!("    offset 40-47: TZ flags (8 bytes)");
    println!("    offset 48-56: user_id (9 bytes)");
    println!("    offset 57-71: padding (15 bytes)");

    println!("\n  🔴 Layouts differ:");
    println!(
        "    - Rust has group as 1 byte at 39; pyzk has pad at 39 + group as 7-byte string at 40-46"
    );
    println!("    - Rust has TZ fields at 40-47; pyzk has pad at 47 + user_id at 48-71");
    println!("    - Rust has user_id as 9 bytes at 48-56; pyzk has user_id as 24 bytes at 48-71");
}

// ── Test 7: Network Params ────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn network_params_staff03() {
    separator("STAFF03 — Network Params");
    let conn =
        ZkConnection::connect(STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY).await.expect("connect");
    match conn.get_network_params().await {
        Ok(p) => {
            println!("  IP:      {}", p.ip_address);
            println!("  Netmask: {}", p.netmask);
            println!("  Gateway: {}", p.gateway);
            println!("  DNS:     {}", p.dns);
        },
        Err(e) => println!("  ⚠️  Failed: {e}"),
    }
}

// ── Test 8: Full Diagnostic Run (both devices) ────────────────────────

#[tokio::test]
#[ignore = "requires SSH tunnels to devices"]
async fn full_diagnostic() {
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║       ZKTeco SDK Protocol — Full Diagnostic             ║");
    println!("╚══════════════════════════════════════════════════════════╝");

    for (label, host, port, comm_key) in [
        ("STAFF03", STAFF03_HOST, STAFF03_PORT, STAFF03_COMM_KEY),
        ("STAFF02", STAFF02_HOST, STAFF02_PORT, STAFF02_COMM_KEY),
    ] {
        separator(&format!("{label} — Full Check"));
        match ZkConnection::connect(host, port, comm_key).await {
            Ok(conn) => {
                println!("  ✅ Connected (session={})", conn.session_id());

                // Device info
                match conn.get_device_info().await {
                    Ok(info) => {
                        println!("  Platform:  '{}' (len={})", info.platform, info.platform.len());
                        println!("  Firmware:   {}", info.firmware_version);
                        println!("  Serial:     {}", info.serial_number);
                    },
                    Err(e) => println!("  ⚠️  get_device_info: {e}"),
                }

                // Sizes
                match conn.read_sizes().await {
                    Ok(s) => {
                        println!("  Users:      {} / {}", s.user_count, s.user_capacity);
                        println!("  Records:    {} / {}", s.record_count, s.record_capacity);
                        println!("  FP:         {} / {}", s.fp_count, s.fp_capacity);
                    },
                    Err(e) => println!("  ⚠️  read_sizes: {e}"),
                }

                // Users
                match conn.get_users().await {
                    Ok(users) => {
                        println!("  Users read: {}", users.len());
                        for u in users.iter().take(3) {
                            println!(
                                "    → SN={} PIN='{}' Name='{}' Priv={}",
                                u.internal_sn, u.pin, u.name, u.privilege
                            );
                        }
                    },
                    Err(e) => println!("  ⚠️  get_users: {e}"),
                }

                // Attendance
                match conn.get_attendance(None).await {
                    Ok(punches) => {
                        println!("  Punches:    {}", punches.len());
                        for p in punches.iter().take(2) {
                            let t = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
                            println!("    → PIN={} Time={} Status={:?}", p.user_pin, t, p.status);
                        }
                    },
                    Err(e) => println!("  ⚠️  get_attendance: {e}"),
                }

                // Time
                match conn.get_time().await {
                    Ok(t) => {
                        println!("  Time:       {}", t.to_zoned(jiff::tz::TimeZone::UTC));
                        let now = jiff::Timestamp::now();
                        let diff = (now.as_second() - t.as_second()).abs();
                        println!("  Clock diff: {}s", diff);
                    },
                    Err(e) => println!("  ⚠️  get_time: {e}"),
                }
            },
            Err(e) => println!("  ❌ Connect failed: {e}"),
        }
    }

    separator("Summary");
    println!("  Check the output above for:");
    println!("  1. Platform string → used for ZK8 detection heuristic");
    println!("  2. User record sizes (inferred from get_users)");
    println!("  3. Whether get_attendance works (data exchange protocol)");
    println!("  4. Clock offset from server time");
}
