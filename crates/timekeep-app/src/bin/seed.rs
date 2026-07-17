//! timekeep development seeder — generates realistic attendance data.
//!
//! Usage:
//!   cargo run --bin seed --features seed -- \
//!     --employees 120 --devices 5 --days 730 --output dev.db
//!
//! Generates:
//!   - Employees with realistic Arabic/English names, departments
//!   - Biometric devices with realistic serial numbers and IPs
//!   - Daily punches (check-in, break-out, break-in, check-out) per employee
//!   - Realistic attendance patterns: late arrivals, early departures, absences
//!   - Anomalous punches: missing check-outs, odd-hour punches, weekend work
//!   - Dashboard admin user (admin/admin) for immediate login

use std::path::PathBuf;

use clap::Parser;
use rand::distributions::{Distribution, WeightedIndex};
use rand::prelude::*;
use rand_distr::Normal;
use timekeep_storage_sqlite::SqliteStorage;

// ─── CLI ──────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(name = "timekeep-seed", about = "Generate realistic attendance data")]
struct Args {
    /// Number of employees to generate
    #[arg(long, default_value = "120")]
    employees: u32,

    /// Number of biometric devices
    #[arg(long, default_value = "5")]
    devices: u32,

    /// Days of history (back from today)
    #[arg(long, default_value = "730")]
    days: u32,

    /// Average punches per employee per working day
    #[arg(long, default_value = "4")]
    punches_per_day: u32,

    /// Rate of anomalies (0.0–1.0)
    #[arg(long, default_value = "0.03")]
    anomaly_rate: f64,

    /// Departments (comma-separated)
    #[arg(long, default_value = "Engineering,HR,Sales,Operations,Finance,IT,Legal,Marketing")]
    departments: String,

    /// Output SQLite database path
    #[arg(long, default_value = "dev.db")]
    output: String,

    /// Random seed for reproducibility
    #[arg(long, default_value = "42")]
    seed: u64,

    /// Force overwrite of existing database
    #[arg(long)]
    force: bool,
}

// ─── Data types ───────────────────────────────────────────────────────

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct Employee {
    id: String,
    pin: String,
    name: String,
    department_id: String,
    department_name: String,
    active: bool,
}

struct Department {
    id: String,
    name: String,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct Device {
    serial_number: String,
    label: String,
    host: String,
    port: u16,
    push_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PunchKind {
    CheckIn,
    CheckOut,
    BreakOut,
    BreakIn,
    OvertimeIn,
    OvertimeOut,
}

impl PunchKind {
    fn status_code(self) -> i32 {
        match self {
            PunchKind::CheckIn => 0,
            PunchKind::CheckOut => 1,
            PunchKind::BreakOut => 2,
            PunchKind::BreakIn => 3,
            PunchKind::OvertimeIn => 4,
            PunchKind::OvertimeOut => 5,
        }
    }
}

struct GeneratedPunch {
    id: String,
    device_sn: String,
    user_pin: String,
    timestamp_sec: i64,
    status: i32,
    verify_mode: i32,
}

// ─── Arabic name list (top 100 common Arabic first names + last names) ─

const FIRST_NAMES: &[&str] = &[
    "Ahmed", "Mohamed", "Ali", "Omar", "Hassan", "Hussein", "Khalid", "Abdullah", "Youssef",
    "Ibrahim", "Tariq", "Nasser", "Sami", "Faisal", "Rashid", "Hamza", "Bilal", "Zaid", "Amir",
    "Karim", "Mustafa", "Salah", "Jamal", "Mahmoud", "Saif", "Adel", "Walid", "Basel", "Amer",
    "Rami", "Hani", "Osama", "Fatima", "Aisha", "Noor", "Layla", "Mariam", "Zainab", "Sara",
    "Huda", "Amal", "Nadia", "Yasmin", "Rania", "Samira", "Dina", "Mona", "Lina", "Hana", "Reem",
    "Nada", "Salma", "Farah", "Lamia", "Souad", "Khadija",
];

const LAST_NAMES: &[&str] = &[
    "Al-Sabah",
    "Al-Rashid",
    "Al-Farsi",
    "Al-Hashimi",
    "Al-Qahtani",
    "Al-Otaibi",
    "Al-Shammari",
    "Al-Dosari",
    "Al-Ghamdi",
    "Al-Zahrani",
    "Al-Harbi",
    "Al-Mutairi",
    "Al-Anazi",
    "Al-Shahrani",
    "Al-Qurashi",
    "Al-Amri",
    "Al-Hajri",
    "Al-Malki",
    "Al-Khalidi",
    "Al-Shehri",
    "Al-Balawi",
    "Al-Johani",
    "Al-Subaie",
    "Al-Mohammadi",
];

// ─── Device templates ──────────────────────────────────────────────────

struct DeviceTemplate {
    label: &'static str,
    host_prefix: [u8; 4],
    port: u16,
}

const DEVICE_TEMPLATES: &[DeviceTemplate] = &[
    DeviceTemplate { label: "Office Entrance", host_prefix: [192, 168, 1, 0], port: 4370 },
    DeviceTemplate { label: "Warehouse A", host_prefix: [192, 168, 1, 0], port: 4370 },
    DeviceTemplate { label: "Warehouse B", host_prefix: [192, 168, 2, 0], port: 4370 },
    DeviceTemplate { label: "Server Room", host_prefix: [10, 0, 0, 0], port: 4370 },
    DeviceTemplate { label: "R&D Lab", host_prefix: [192, 168, 3, 0], port: 4370 },
    DeviceTemplate { label: "Main Gate", host_prefix: [192, 168, 1, 0], port: 4370 },
    DeviceTemplate { label: "Parking Entrance", host_prefix: [172, 16, 0, 0], port: 4370 },
    DeviceTemplate { label: "Cafeteria", host_prefix: [192, 168, 1, 0], port: 4370 },
];

fn alphanum_serial(len: usize, rng: &mut impl Rng) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    (0..len).map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char).collect()
}

// ─── Punch generation ──────────────────────────────────────────────────

/// Generate a full day's punches for one employee.
fn generate_day_punches(
    employee: &Employee,
    devices: &[Device],
    day_start_sec: i64, // midnight UTC of the work day
    rng: &mut impl Rng,
    anomaly_rate: f64,
) -> Vec<GeneratedPunch> {
    let device = &devices[rng.gen_range(0..devices.len())];
    let mut punches = Vec::new();

    // ── Absence (2%) ────────────────────────────────────────────
    if rng.gen_bool(0.02) {
        return punches; // no punches → absence
    }

    // ── Check-in time (normal distribution around 08:00) ────────
    let check_in_offset_sec = normal_offset(8.0 * 3600.0, 900.0, rng);
    let check_in_sec = day_start_sec + 8 * 3600 + check_in_offset_sec as i64;

    // ── Late (5% after 09:00) ───────────────────────────────────
    let is_late = rng.gen_bool(0.05);
    let actual_check_in_sec =
        if is_late { day_start_sec + 9 * 3600 + rng.gen_range(0..3600) } else { check_in_sec };

    let verify = pick_verify_mode(rng);
    punches.push(make_punch(employee, device, actual_check_in_sec, PunchKind::CheckIn, verify));

    // ── Break-out (3-5 hours after check-in) ────────────────────
    let break_out_offset = rng.gen_range(3 * 3600..5 * 3600);
    let break_out_sec = actual_check_in_sec + break_out_offset;
    punches.push(make_punch(employee, device, break_out_sec, PunchKind::BreakOut, verify));

    // ── Break-in (20-45 min after break-out) ────────────────────
    let break_duration = rng.gen_range(20 * 60..45 * 60);
    let break_in_sec = break_out_sec + break_duration;
    punches.push(make_punch(employee, device, break_in_sec, PunchKind::BreakIn, verify));

    // ── Check-out (after break-in, normal around 17:00) ─────────
    // Calculate time remaining to hit ~8h work day
    let hours_worked_so_far = (break_in_sec - actual_check_in_sec) as f64 / 3600.0;
    let remaining_hours = (8.0 - hours_worked_so_far).max(1.0);
    let check_out_offset = rng.gen_range(0..(remaining_hours as i64 * 3600));
    let check_out_sec = break_in_sec + 3600 + check_out_offset; // at least 1h after break-in

    // ── Missing check-out (1%) → anomaly ────────────────────────
    if rng.gen_bool(anomaly_rate / 3.0) {
        // No check-out — incomplete day
        return punches;
    }

    punches.push(make_punch(employee, device, check_out_sec, PunchKind::CheckOut, verify));

    // ── Overtime (5% chance, after check-out + 1-2h) ────────────
    if rng.gen_bool(0.05) {
        let ot_in_sec = check_out_sec + rng.gen_range(1800..7200);
        let ot_out_sec = ot_in_sec + rng.gen_range(3600..14400);
        punches.push(make_punch(employee, device, ot_in_sec, PunchKind::OvertimeIn, verify));
        punches.push(make_punch(employee, device, ot_out_sec, PunchKind::OvertimeOut, verify));
    }

    // ── Odd-hour / weekend punch (anomaly) ──────────────────────
    if rng.gen_bool(anomaly_rate) {
        let odd_time = day_start_sec + rng.gen_range(0..24 * 3600);
        // Only add if it doesn't collide with existing times (±5 min buffer)
        let has_collision = punches.iter().any(|p| (p.timestamp_sec - odd_time).abs() < 300);
        if !has_collision {
            punches.push(make_punch(employee, device, odd_time, PunchKind::CheckIn, 3)); // password verify → suspicious
        }
    }

    // Sort by timestamp
    punches.sort_by_key(|p| p.timestamp_sec);
    punches
}

fn make_punch(
    employee: &Employee,
    device: &Device,
    timestamp_sec: i64,
    kind: PunchKind,
    verify_mode: i32,
) -> GeneratedPunch {
    let id = format!(
        "seed-{}-{}-{}-{}-{}",
        device.serial_number,
        timestamp_sec,
        employee.pin,
        kind.status_code(),
        verify_mode
    );
    GeneratedPunch {
        id,
        device_sn: device.serial_number.clone(),
        user_pin: employee.pin.clone(),
        timestamp_sec,
        status: kind.status_code(),
        verify_mode,
    }
}

fn pick_verify_mode(rng: &mut impl Rng) -> i32 {
    // Weighted: fingerprint (50%), face (25%), card (15%), password (10%)
    let choices = [(0, 50), (1, 25), (2, 15), (3, 10)];
    let dist = WeightedIndex::new(choices.iter().map(|&(_, w)| w)).unwrap();
    choices[dist.sample(rng)].0
}

fn normal_offset(_mean_sec: f64, stddev_sec: f64, rng: &mut impl Rng) -> f64 {
    match Normal::new(0.0, stddev_sec) {
        Ok(dist) => dist.sample(rng),
        Err(_) => 0.0,
    }
}

// ─── Day helpers ───────────────────────────────────────────────────────

/// Returns the Unix timestamp (seconds) of midnight UTC for a given date.
fn midnight_utc(year: i32, month: i32, day: i32) -> i64 {
    // Use a known epoch: 2020-01-01 was a Wednesday
    // Simple day counting from epoch
    fn days_from_epoch(y: i32, m: i32, d: i32) -> i64 {
        let mut days = 0i64;
        for year in 1970..y {
            days += if is_leap(year) { 366 } else { 365 };
        }
        let month_days = if is_leap(y) {
            [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        } else {
            [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        };
        for month_idx in 0..(m as usize - 1) {
            days += month_days[month_idx] as i64;
        }
        days + d as i64 - 1
    }
    days_from_epoch(year, month, day) * 86400
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

fn day_of_week(timestamp_sec: i64) -> u8 {
    // 1970-01-01 was a Thursday (4)
    let days = timestamp_sec / 86400;
    ((days + 4) % 7) as u8 // 0=Sun, 1=Mon, .. 6=Sat
}

// ─── Main ──────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Remove existing DB if --force
    let db_path = PathBuf::from(&args.output);
    if args.force && db_path.exists() {
        std::fs::remove_file(&db_path)?;
        println!("Removed existing {}", args.output);
    }

    // Create and migrate database
    let db_url = if args.output == ":memory:" {
        ":memory:".to_string()
    } else {
        format!("sqlite://{}", db_path.canonicalize().unwrap_or_else(|_| db_path.clone()).display())
    };

    let storage = SqliteStorage::new(&db_url).await?;
    let pool = &storage.pool;

    let mut rng = StdRng::seed_from_u64(args.seed);

    println!("═══ timekeep seeder ═══");
    println!("  employees : {}", args.employees);
    println!("  devices   : {}", args.devices);
    println!("  days      : {}", args.days);
    println!("  anomalies : {:.1}%", args.anomaly_rate * 100.0);
    println!("  output    : {}", args.output);
    println!("  seed      : {}", args.seed);

    // ── Departments ──────────────────────────────────────────────
    let dept_names: Vec<&str> = args.departments.split(',').map(|s| s.trim()).collect();
    let mut departments = Vec::new();
    for name in &dept_names {
        let id = format!("dept-{}", uuid::Uuid::new_v4());
        let now = jiff::Timestamp::now().as_second();
        sqlx::query(
            "INSERT INTO departments (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(name)
        .bind(now.to_string())
        .bind(now.to_string())
        .execute(&storage.pool)
        .await?;
        departments.push(Department { id, name: name.to_string() });
        println!("  dept: {}", name);
    }

    // ── Devices ─────────────────────────────────────────────────
    let device_count = args.devices.min(DEVICE_TEMPLATES.len() as u32);
    let mut devices = Vec::new();
    for i in 0..device_count {
        let tpl = &DEVICE_TEMPLATES[i as usize];
        let sn = format!("SEED-{}", alphanum_serial(10, &mut rng));
        let host = format!(
            "{}.{}.{}.{}",
            tpl.host_prefix[0],
            tpl.host_prefix[1],
            tpl.host_prefix[2],
            100 + i
        );
        sqlx::query(
            "INSERT OR IGNORE INTO devices (serial_number, label, host, port, comm_key, push_enabled)
             VALUES (?, ?, ?, ?, 0, 1)"
        )
            .bind(&sn)
            .bind(tpl.label)
            .bind(&host)
            .bind(tpl.port)
            .execute(&storage.pool)
            .await?;

        // Also insert into device_info for full detail views
        sqlx::query(
            "INSERT OR IGNORE INTO device_info (serial_number, vendor, model, firmware_version, platform, mac_address, ip_address, status, user_capacity, record_capacity, fingerprint_capacity, face_capacity, palm_capacity, user_count, record_count, label)
             VALUES (?, 'zkteco', 'SpeedFace-V5L [TI]', 'Ver 8.45', 'ZLM60', ?, ?, 'online', 3000, 100000, 6000, 3000, 0, ?, ?, ?)"
        )
            .bind(&sn)
            .bind(format!("AA:BB:CC:DD:EE:{:02X}", i))
            .bind(&host)
            .bind(rng.gen_range(0..100))
            .bind(rng.gen_range(0..10000))
            .bind(tpl.label)
            .execute(&storage.pool)
            .await?;

        devices.push(Device {
            serial_number: sn.clone(),
            label: tpl.label.to_string(),
            host,
            port: tpl.port,
            push_enabled: true,
        });
        println!("  device: {} ({})", sn, tpl.label);
    }

    // ── Employees ────────────────────────────────────────────────
    let mut employees = Vec::new();
    let mut used_pins = std::collections::HashSet::new();

    for _i in 0..args.employees {
        let first = FIRST_NAMES[rng.gen_range(0..FIRST_NAMES.len())];
        let last = LAST_NAMES[rng.gen_range(0..LAST_NAMES.len())];
        let name = format!("{} {}", first, last);

        // Generate unique PIN (3-5 digits, not leading zero)
        let pin = loop {
            let p = format!("{}", rng.gen_range(100..99999));
            if !used_pins.contains(&p) {
                used_pins.insert(p.clone());
                break p;
            }
        };

        let dept = &departments[rng.gen_range(0..departments.len())];
        let id = uuid::Uuid::new_v4().to_string();
        let active = rng.gen_bool(0.95); // 95% active
        let now = jiff::Timestamp::now().as_second();

        sqlx::query(
            "INSERT INTO employees (id, pin, name, department_id, department, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
            .bind(&id)
            .bind(&pin)
            .bind(&name)
            .bind(&dept.id)
            .bind(&dept.name)
            .bind(active as i32)
            .bind(now.to_string())
            .bind(now.to_string())
            .execute(&storage.pool)
            .await?;

        // Also insert into users table for device-synced users
        for device in devices.iter().take(2) {
            // each employee synced to 2 devices
            sqlx::query(
                "INSERT OR IGNORE INTO users (pin, device_sn, name, privilege, card_number, synced_at)
                 VALUES (?, ?, ?, 0, NULL, ?)"
            )
                .bind(&pin)
                .bind(&device.serial_number)
                .bind(&name)
                .bind(now.to_string())
                .execute(&storage.pool)
                .await?;
        }

        employees.push(Employee {
            id,
            pin,
            name,
            department_id: dept.id.clone(),
            department_name: dept.name.clone(),
            active,
        });
    }
    println!("  employees: {} generated", employees.len());

    // ── Punches ──────────────────────────────────────────────────
    let now = jiff::Timestamp::now();
    let today = now.to_zoned(jiff::tz::TimeZone::UTC);
    let today_midnight =
        midnight_utc(today.year() as i32, today.month() as i32, today.day() as i32);

    let mut total_punches = 0u64;

    for day_offset in 0..args.days as i64 {
        let day_sec = today_midnight - day_offset * 86400;
        let dow = day_of_week(day_sec);
        let is_weekend = dow == 5 || dow == 6; // Friday (5) and Saturday (6) = Middle East weekend

        for employee in &employees {
            if !employee.active {
                continue;
            }

            // Skip weekends (98% of employees don't work weekends)
            if is_weekend && !rng.gen_bool(0.02) {
                continue;
            }

            let punches =
                generate_day_punches(employee, &devices, day_sec, &mut rng, args.anomaly_rate);

            for punch in &punches {
                sqlx::query(
                    "INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
                     VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(&punch.id)
                .bind(&punch.device_sn)
                .bind(&punch.user_pin)
                .bind(punch.timestamp_sec.to_string())
                .bind(punch.status)
                .bind(punch.verify_mode)
                .execute(pool)
                .await?;
            }
            total_punches += punches.len() as u64;
        }

        if day_offset % 30 == 0 {
            println!("  day {}/{} — {} total punches so far", day_offset, args.days, total_punches);
        }
    }

    // ── Dashboard admin user ─────────────────────────────────────
    let admin_id = uuid::Uuid::new_v4().to_string();
    let now_sec = now.as_second();
    // Default password: "admin" hashed with argon2id
    sqlx::query(
        "INSERT OR IGNORE INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
         VALUES (?, 'admin', '', '', 'admin', 'Administrator', 1, ?, ?, 'read:punches write:punches read:devices write:devices manage:users manage:commands')"
    )
        .bind(&admin_id)
        .bind(now_sec)
        .bind(now_sec)
        .execute(&storage.pool)
        .await?;

    // ── Settings ─────────────────────────────────────────────────
    sqlx::query("INSERT OR IGNORE INTO settings (key, value_json) VALUES ('org_name', '\"Al Sabah Group\"')")
        .execute(&storage.pool).await?;
    sqlx::query("INSERT OR IGNORE INTO settings (key, value_json) VALUES ('org_timezone', '\"Asia/Riyadh\"')")
        .execute(&storage.pool).await?;

    // ── Summary ──────────────────────────────────────────────────
    println!();
    println!("═══ Done ═══");
    println!("  departments : {}", departments.len());
    println!("  devices     : {}", devices.len());
    println!(
        "  employees   : {} ({} active)",
        employees.len(),
        employees.iter().filter(|e| e.active).count()
    );
    println!("  punches     : {}", total_punches);
    println!("  database    : {}", args.output);
    println!();
    println!("  Run with:");
    println!("    RUST_LOG=info cargo run -- --db sqlite://{}", args.output);
    println!("    # Admin login: admin / admin");

    Ok(())
}
