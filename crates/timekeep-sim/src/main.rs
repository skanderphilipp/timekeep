//! Standalone ZKTeco device simulator for local development.
//!
//! Usage:
//!   cargo run -p timekeep-sim
//!
//! Configuration via env vars:
//!   SIM_PORT=4370    SIM_USERS=5    SIM_PUNCHES=20

use jiff::Timestamp;
use timekeep_core::model::{AttendancePunch, PunchStatus, User, VerifyMode};
use timekeep_zkteco::simulator::{ZkSimServer, canned_responder};

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("SIM_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(4370);
    let user_count: usize =
        std::env::var("SIM_USERS").ok().and_then(|s| s.parse().ok()).unwrap_or(5);
    let punch_count: usize =
        std::env::var("SIM_PUNCHES").ok().and_then(|s| s.parse().ok()).unwrap_or(20);

    // ── Build users ──
    let users: Vec<User> = (0..user_count)
        .map(|i| User {
            internal_sn: (i + 1) as u16,
            pin: format!("{i:04}"),
            name: format!("Sim User {i:02}"),
            privilege: if i == 0 { 14 } else { 0 },
            card_number: None,
            has_password: i == 0,
            fingerprint_count: 2,
            has_face: false,
        })
        .collect();

    // ── Build punches (spread over last 7 days) ──
    let now = Timestamp::now().as_second();
    let day_secs: i64 = 86400;
    let punches: Vec<AttendancePunch> = (0..punch_count)
        .map(|i| {
            let day_offset = (i % 7) as i64;
            let hour = 7 + (i % 10) as i64;
            let minute = (i * 7 % 60) as i64;
            let ts = now - (6 - day_offset) * day_secs + hour * 3600 + minute * 60;

            let mut punch = AttendancePunch {
                id: String::new(),
                device_sn: "SIM-DEV-001".into(),
                user_pin: format!("{:04}", i % user_count),
                timestamp: Timestamp::from_second(ts).unwrap_or(Timestamp::now()),
                status: if i % 2 == 0 { PunchStatus::CheckIn } else { PunchStatus::CheckOut },
                verify_mode: VerifyMode::Fingerprint,
                work_code: None,
                sub_status: None,
                employee_name: None,
                device_label: None,
                raw_data: None,
            };
            punch.id = punch.generate_deduplication_id();
            punch
        })
        .collect();

    // ── Encode into wire format ──
    let record_size: usize = 72;
    let mut user_blob = Vec::with_capacity(4 + users.len() * record_size);
    user_blob.extend_from_slice(&((users.len() * record_size) as u32).to_le_bytes());
    for user in &users {
        let mut rec = vec![0u8; record_size];
        rec[0..2].copy_from_slice(&user.internal_sn.to_le_bytes());
        rec[2] = user.privilege;
        let name = user.name.as_bytes();
        rec[11..11 + name.len().min(24)].copy_from_slice(name);
        let pin = user.pin.as_bytes();
        rec[48..48 + pin.len().min(24)].copy_from_slice(pin);
        user_blob.extend_from_slice(&rec);
    }

    let att_rec_sz: usize = 40;
    let mut att_blob = Vec::with_capacity(4 + punches.len() * att_rec_sz);
    att_blob.extend_from_slice(&((punches.len() * att_rec_sz) as u32).to_le_bytes());
    for punch in &punches {
        let mut rec = vec![0u8; att_rec_sz];
        let sn: u16 = punch.user_pin.parse().unwrap_or(0);
        rec[0..2].copy_from_slice(&sn.to_le_bytes());
        let pb = punch.user_pin.as_bytes();
        rec[2..2 + pb.len().min(9)].copy_from_slice(pb);
        rec[26] = punch.verify_mode.as_i32() as u8;
        let zk_ts =
            timekeep_zkteco::protocol::encoding::encode_zk_time(punch.timestamp).unwrap_or(0);
        rec[27..31].copy_from_slice(&zk_ts.to_le_bytes());
        rec[31] = punch.status as u8;
        att_blob.extend_from_slice(&rec);
    }

    // ── Start ──
    let addr_str = format!("127.0.0.1:{port}");
    let sim = ZkSimServer::with_handshake_bind(
        &addr_str,
        canned_responder(user_blob, att_blob, users.len() as u32, punches.len() as u32),
    )
    .await;

    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           ZKTeco Device Simulator — Development              ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  Address:  {:<47}║", sim.addr());
    println!("║  Serial:   SIM-DEV-001                                      ║");
    println!(
        "║  Users:    {:<3}  |  Punches:  {:<3}                              ║",
        user_count, punch_count
    );
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  curl -X POST localhost:3000/api/devices/discover \\         ║");
    println!("║    -H 'Content-Type: application/json' \\                   ║");
    println!("║    -H 'Authorization: Bearer $TOKEN' \\                     ║");
    println!("║    -d '{{\"host\":\"127.0.0.1\",\"port\":{port}}}'                ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  Press Ctrl+C to stop                                        ║");
    println!("╚══════════════════════════════════════════════════════════════╝");

    tokio::signal::ctrl_c().await.ok();
    println!("\nShutting down...");
    sim.shutdown().await;
    println!("Done.");
}
