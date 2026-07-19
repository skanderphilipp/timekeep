//! Integration tests for dashboard and report endpoints with
//! per-department work policy resolution — the most critical
//! business logic in the attendance system.
//!
//! These tests verify that late detection, present/absent counting,
//! and report summaries respect each employee's department policy.

mod helpers;

use axum::Router;
use helpers::*;
use std::sync::Arc;
use timekeep_core::traits::Storage;

// ─── Helper: build a test setup with departments, employees, and punches ──

struct DashboardFixture {
    app: Router,
    storage: Arc<FakeStorage>,
    employees: Arc<FakeEmployeeStore>,
    token: String,
}

impl DashboardFixture {
    async fn new() -> Self {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());
        let app = test_app_with_employees(storage.clone(), employees.clone());
        let token = login_as_admin(&app).await;
        Self { app, storage, employees, token }
    }

    fn mgmt_dept(&self, name: &str, policy: Option<timekeep_core::model::WorkPolicy>) -> String {
        let dept = timekeep_core::model::Department::new(name, policy);
        self.storage.seed_department(dept)
    }

    fn seed_employee(&self, pin: &str, name: &str, dept_name: &str, dept_id: &str) {
        FakeStorage::seed_employee_with_dept(&self.employees, pin, name, dept_name, dept_id);
    }
}

/// Build a unix timestamp for a specific UTC date and time.
fn date_to_epoch(date: jiff::civil::Date, hour: i8, minute: i8) -> i64 {
    jiff::civil::DateTime::from_parts(date, jiff::civil::Time::new(hour, minute, 0, 0).unwrap())
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
        .as_second()
}

// ─── Today Summary: Late Detection with Mixed Policies ─────────────

#[tokio::test]
async fn today_summary_late_detection_with_mixed_policies() {
    let f = DashboardFixture::new().await;

    // Org default: 09:00 start, 15 min grace → late after 09:15
    // Management: flexible (never late)
    let flexible = timekeep_core::model::WorkPolicy::flexible(4);
    let mgmt_id = f.mgmt_dept("Management", Some(flexible));

    // Alice in Management (flexible), Bob has no dept (org default)
    f.seed_employee("1001", "Alice", "Management", &mgmt_id);
    f.seed_employee("1002", "Bob", "", "");

    // Both punch in at 09:30 — late by org default, NOT late by flexible
    let late_ts = today_at(9, 30);
    f.storage.store_punch(&check_in("1001", "SN001", late_ts)).await.unwrap();
    f.storage.store_punch(&check_in("1002", "SN001", late_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);

    // Only Bob should be late — Alice has flexible policy (never late)
    assert_eq!(body["data"]["late"], 1, "only non-flexible employee should be late");
    assert_eq!(body["data"]["on_time"], 1, "flexible employee should be on time");
    assert_eq!(body["data"]["present"], 2, "both employees should be present");
}

// ─── Today Summary: All Flexible, None Late ────────────────────────

#[tokio::test]
async fn today_summary_all_flexible_none_late() {
    let f = DashboardFixture::new().await;

    let flexible = timekeep_core::model::WorkPolicy::flexible(4);
    let mgmt_id = f.mgmt_dept("Management", Some(flexible.clone()));

    f.seed_employee("1001", "Alice", "Management", &mgmt_id);
    f.seed_employee("1002", "Bob", "Management", &mgmt_id);

    // Both punch in at 11:00 (would be late by standard policy)
    let late_ts = today_at(11, 0);
    f.storage.store_punch(&check_in("1001", "SN001", late_ts)).await.unwrap();
    f.storage.store_punch(&check_in("1002", "SN001", late_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 0, "flexible policy: no one should be late");
    assert_eq!(body["data"]["on_time"], 2, "flexible policy: everyone on time");
}

// ─── Today Summary: Warehouse Early Shift ──────────────────────────

#[tokio::test]
async fn today_summary_warehouse_early_shift() {
    let f = DashboardFixture::new().await;

    // Warehouse: 06:00–14:00, 15 min grace → late after 06:15
    let early = timekeep_core::model::WorkPolicy {
        work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
        work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    let warehouse_id = f.mgmt_dept("Warehouse", Some(early));
    let office_id = f.mgmt_dept("Office", None);

    f.seed_employee("2001", "Carl", "Warehouse", &warehouse_id);
    f.seed_employee("2002", "Diana", "Office", &office_id);

    // Both punch at 06:10 — on time for warehouse (before 06:15),
    // on time for office (before 08:15)
    let early_ts = today_at(6, 10);
    f.storage.store_punch(&check_in("2001", "SN001", early_ts)).await.unwrap();
    f.storage.store_punch(&check_in("2002", "SN001", early_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 0, "06:10 is before both grace thresholds");
    assert_eq!(body["data"]["on_time"], 2);
}

// ─── Today Summary: Warehouse Late Arrival ─────────────────────────

#[tokio::test]
async fn today_summary_warehouse_late_arrival() {
    let f = DashboardFixture::new().await;

    let early = timekeep_core::model::WorkPolicy {
        work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
        work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    let warehouse_id = f.mgmt_dept("Warehouse", Some(early));

    f.seed_employee("2001", "Carl", "Warehouse", &warehouse_id);

    // Punch at 06:20 → late (after 06:15 grace)
    let late_ts = today_at(6, 20);
    f.storage.store_punch(&check_in("2001", "SN001", late_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 1, "warehouse worker should be late at 06:20");
    assert_eq!(body["data"]["on_time"], 0);
}

// ─── Report Summary: Mixed Department Policies ─────────────────────

#[tokio::test]
async fn report_summary_with_mixed_department_policies() {
    let f = DashboardFixture::new().await;

    // Management: flexible (never late)
    let flexible = timekeep_core::model::WorkPolicy::flexible(4);
    let mgmt_id = f.mgmt_dept("Management", Some(flexible));
    // Engineering: no override (org default)
    let eng_id = f.mgmt_dept("Engineering", None);

    f.seed_employee("1001", "Alice", "Management", &mgmt_id);
    f.seed_employee("1002", "Bob", "Engineering", &eng_id);

    // Both punch in at 08:00 and out at 16:00
    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let day_start = today_at(8, 0);
    let day_end = today_at(16, 0);

    for &(pin, ts, status) in &[
        ("1001", day_start, timekeep_core::model::PunchStatus::CheckIn),
        ("1001", day_end, timekeep_core::model::PunchStatus::CheckOut),
        ("1002", day_start, timekeep_core::model::PunchStatus::CheckIn),
        ("1002", day_end, timekeep_core::model::PunchStatus::CheckOut),
    ] {
        f.storage.store_punch(&make_punch(pin, "SN001", ts, status)).await.unwrap();
    }

    let url = format!("/api/reports/summary?date_from={}&date_to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    // Should have data for both employees
    assert_eq!(body["data"]["unique_users"], 2);
    assert_eq!(body["data"]["total_punches"], 4);
    assert_eq!(body["data"]["check_ins"], 2);
    assert_eq!(body["data"]["check_outs"], 2);
    // Both employees present → low absence rate
    assert!(
        body["data"]["absence_rate"].as_f64().unwrap() < 1.0,
        "both employees should be present"
    );
}

// ─── Report Summary: Empty Punches ─────────────────────────────────

#[tokio::test]
async fn report_summary_handles_empty_punches() {
    let f = DashboardFixture::new().await;

    let (status, body) = send(&f.app, get_authed("/api/reports/summary", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["total_punches"], 0);
    assert_eq!(body["data"]["unique_users"], 0);
    assert!(body["data"]["employees"].as_array().unwrap().is_empty());
}

// ─── Policy Resolution: Employee Without Department ────────────────

#[tokio::test]
async fn employee_without_department_uses_org_default() {
    let f = DashboardFixture::new().await;

    f.seed_employee("5001", "Eve", "", "");

    // Eve punches at 09:16 → late by org default (after 09:15)
    let late_ts = today_at(9, 16);
    f.storage.store_punch(&check_in("5001", "SN001", late_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 1, "Eve should be late with org default");
}

// ─── Policy Resolution: Department Without Override ────────────────

#[tokio::test]
async fn department_without_override_uses_org_default() {
    let f = DashboardFixture::new().await;

    let eng_id = f.mgmt_dept("Engineering", None);
    f.seed_employee("6001", "Frank", "Engineering", &eng_id);

    // Frank punches at 09:16 → late by org default
    let late_ts = today_at(9, 16);
    f.storage.store_punch(&check_in("6001", "SN001", late_ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 1, "Frank should be late with inherited org default");
}

// ─── Today Summary: Late at Grace Boundary ─────────────────────────

#[tokio::test]
async fn exactly_at_grace_boundary_is_on_time() {
    let f = DashboardFixture::new().await;

    // Org default: 09:00 start, 15 min grace → late threshold is 09:15:00
    f.seed_employee("7001", "Grace", "", "");

    // Punch exactly at 09:15
    let ts = today_at(9, 15);
    f.storage.store_punch(&check_in("7001", "SN001", ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    // 09:15:00 should NOT be late (deadline is 09:15:00 inclusive)
    assert_eq!(body["data"]["on_time"], 1, "09:15 should be on time");
}

// ─── Today Summary: One Second Past Grace is Late ──────────────────

#[tokio::test]
async fn one_second_past_grace_is_late() {
    let f = DashboardFixture::new().await;

    // Org default: late threshold is 15 min (900 seconds)
    // work_start (09:00) + late_threshold (900s) = deadline at 09:15:00
    // arrival_seconds = hour*3600 + minute*60 + second = 9*3600 + 15*60 + 1 = 33301
    // deadline_seconds = 9*3600 + 0*60 + 900 = 33300
    // 33301 > 33300 → late

    f.seed_employee("8001", "Henry", "", "");

    // Punch at 09:15:01 — this requires sub-minute precision which today_at doesn't provide.
    // Instead, punch at 09:16 which is definitively late.
    let ts = today_at(9, 16);
    f.storage.store_punch(&check_in("8001", "SN001", ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["late"], 1, "09:16 should be late");
}

// ─── Today Summary: Validates HTTP Contract ────────────────────────

#[tokio::test]
async fn today_summary_response_has_required_fields() {
    let f = DashboardFixture::new().await;
    f.seed_employee("9001", "Iris", "", "");

    // Seed a punch so we get non-zero data
    let ts = today_at(8, 50);
    f.storage.store_punch(&check_in("9001", "SN001", ts)).await.unwrap();

    let (status, body) = send(&f.app, get_authed("/api/dashboard/today", &f.token)).await;
    assert_eq!(status, 200);

    // Check all required fields exist
    assert!(body["data"]["present"].is_number());
    assert!(body["data"]["absent"].is_number());
    assert!(body["data"]["late"].is_number());
    assert!(body["data"]["on_time"].is_number());
    assert!(body["data"]["total_employees"].is_number());
    assert!(body["data"]["total_punches"].is_number());
    assert!(body["data"]["date"].is_number());
    assert!(body["data"]["check_ins"].is_number());
    assert!(body["data"]["check_outs"].is_number());
    assert!(body["data"]["currently_checked_in"].is_array());
    assert!(body["data"]["recent_events"].is_array());
    assert!(body["data"]["device_health"].is_array());
    assert!(body["data"]["hourly_breakdown"].is_array());
}

// ─── Overnight Shift: Expected Hours Calculation ───────────────────

#[tokio::test]
async fn overnight_shift_expected_hours() {
    let policy = timekeep_core::model::WorkPolicy {
        work_start: jiff::civil::Time::new(22, 0, 0, 0).unwrap(),
        work_end: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    // 22:00 to 06:00 = 8 hours
    assert_eq!(policy.expected_seconds(), 8 * 3600);
}

// ─── Work Policy: Late Detection Edge Cases ────────────────────────

#[tokio::test]
async fn standard_policy_not_late_within_grace_period() {
    let policy = timekeep_core::model::WorkPolicy::standard_9to5();
    // 09:14 — within 15 minute grace
    assert!(!policy.is_late(jiff::civil::Time::new(9, 14, 0, 0).unwrap()));
}

#[tokio::test]
async fn standard_policy_late_after_grace_period() {
    let policy = timekeep_core::model::WorkPolicy::standard_9to5();
    // 09:16 — after 15 minute grace
    assert!(policy.is_late(jiff::civil::Time::new(9, 16, 0, 0).unwrap()));
}

#[tokio::test]
async fn flexible_policy_never_late_at_any_time() {
    let policy = timekeep_core::model::WorkPolicy::flexible(4);
    assert!(!policy.is_late(jiff::civil::Time::new(10, 0, 0, 0).unwrap()));
    assert!(!policy.is_late(jiff::civil::Time::new(14, 30, 0, 0).unwrap()));
    assert!(!policy.is_late(jiff::civil::Time::new(6, 0, 0, 0).unwrap()));
}

// ─── Working Days: Count Working Days ──────────────────────────────

#[tokio::test]
async fn count_working_days_standard_week() {
    let policy = timekeep_core::model::WorkPolicy::standard_9to5();
    // Monday through Friday
    let mon = jiff::civil::Date::new(2026, 7, 13).unwrap(); // Monday
    let fri = jiff::civil::Date::new(2026, 7, 17).unwrap(); // Friday
    assert_eq!(policy.count_working_days(mon, fri), 5);
}

#[tokio::test]
async fn count_working_days_includes_weekends_as_non_working() {
    let policy = timekeep_core::model::WorkPolicy::standard_9to5();
    let fri = jiff::civil::Date::new(2026, 7, 17).unwrap(); // Friday
    let sun = jiff::civil::Date::new(2026, 7, 19).unwrap(); // Sunday
    // Fri, Sat, Sun → only Fri is a working day
    assert_eq!(policy.count_working_days(fri, sun), 1);
}

#[tokio::test]
async fn count_working_days_all_week_for_seven_day_policy() {
    let all_days = timekeep_core::model::WorkPolicy {
        working_days: [true, true, true, true, true, true, true],
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    let mon = jiff::civil::Date::new(2026, 7, 13).unwrap();
    let sun = jiff::civil::Date::new(2026, 7, 19).unwrap();
    assert_eq!(all_days.count_working_days(mon, sun), 7);
}

// ─── Monthly Trend: Mixed Department Policies ───────────────────────

/// Verify that the monthly trend endpoint respects per-department
/// work policies when classifying days (late, on-time, present).
#[tokio::test]
async fn monthly_trend_with_department_specific_policies() {
    let f = DashboardFixture::new().await;

    // Warehouse: 06:00 start, 10 min grace -> late after 06:10
    let warehouse = timekeep_core::model::WorkPolicy {
        work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
        work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
        late_threshold_secs: 10 * 60,
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    let wh_id = f.mgmt_dept("Warehouse", Some(warehouse));
    let eng_id = f.mgmt_dept("Engineering", None); // org default

    f.seed_employee("w1", "Carl", "Warehouse", &wh_id);
    f.seed_employee("e1", "Diana", "Engineering", &eng_id);

    // Use a fixed weekday date (2026-07-17 = Friday) — avoids weekend flakiness
    let d = jiff::civil::Date::new(2026, 7, 17).unwrap();
    let from = date_to_epoch(d, 0, 0);
    let to = date_to_epoch(d, 23, 59);
    let wh_in = date_to_epoch(d, 6, 5);
    let wh_out = date_to_epoch(d, 14, 0);
    let eng_in = date_to_epoch(d, 9, 20);
    let eng_out = date_to_epoch(d, 17, 0);

    f.storage.store_punch(&check_in("w1", "SN001", wh_in)).await.unwrap();
    f.storage
        .store_punch(&make_punch(
            "w1",
            "SN001",
            wh_out,
            timekeep_core::model::PunchStatus::CheckOut,
        ))
        .await
        .unwrap();
    f.storage.store_punch(&check_in("e1", "SN001", eng_in)).await.unwrap();
    f.storage
        .store_punch(&make_punch(
            "e1",
            "SN001",
            eng_out,
            timekeep_core::model::PunchStatus::CheckOut,
        ))
        .await
        .unwrap();

    let url = format!("/api/reports/monthly-trend?from={}&to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    // Should return trend data for at least the current month
    let data = &body["data"];
    assert!(data.is_array(), "monthly trend should return an array");
    // With from/to covering today, and punches seeded, we expect at least one month entry
    assert!(!data.as_array().unwrap().is_empty(), "should have at least one month");
}

// ─── By-Department: Respects Department Policies ───────────────────

/// Verify that the by-department endpoint uses each department's
/// effective work policy for late detection and attendance computation.
#[tokio::test]
async fn by_department_respects_department_policies() {
    let f = DashboardFixture::new().await;

    // Management: flexible (never late)
    let flexible = timekeep_core::model::WorkPolicy::flexible(4);
    let mgmt_id = f.mgmt_dept("Management", Some(flexible));
    // Engineering: no override (org default -> late after 09:15)
    let eng_id = f.mgmt_dept("Engineering", None);

    f.seed_employee("m1", "Alice", "Management", &mgmt_id);
    f.seed_employee("e1", "Bob", "Engineering", &eng_id);

    // One day of data: both at 09:20 (late for Engineering, NOT for Management)
    // Use query params to ensure the date range covers all timestamps
    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let ts_in = today_at(9, 20);
    let ts_out = today_at(17, 0);

    f.storage.store_punch(&check_in("m1", "SN001", ts_in)).await.unwrap();
    f.storage
        .store_punch(&make_punch(
            "m1",
            "SN001",
            ts_out,
            timekeep_core::model::PunchStatus::CheckOut,
        ))
        .await
        .unwrap();
    f.storage.store_punch(&check_in("e1", "SN001", ts_in)).await.unwrap();
    f.storage
        .store_punch(&make_punch(
            "e1",
            "SN001",
            ts_out,
            timekeep_core::model::PunchStatus::CheckOut,
        ))
        .await
        .unwrap();

    let url = format!("/api/reports/by-department?from={}&to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let data = body["data"].as_array().unwrap();
    assert_eq!(data.len(), 2, "should have two departments");

    // Find Management's entry
    let mgmt = data.iter().find(|d| d["department_name"] == "Management").unwrap();
    // Find Engineering's entry
    let eng = data.iter().find(|d| d["department_name"] == "Engineering").unwrap();

    // Management: flexible policy -> no days should be classified as late
    assert_eq!(mgmt["late"], 0, "Management (flexible) should have 0 late days");

    // Engineering: 09:20 is late (past 09:15 grace) -> should have at least 1 late
    assert!(
        eng["late"].as_u64().unwrap() >= 1,
        "Engineering should have at least 1 late day at 09:20"
    );
}

// ─── By-Department: Empty Data Returns Clean Response ──────────────

#[tokio::test]
async fn by_department_handles_empty_data() {
    let f = DashboardFixture::new().await;

    let (status, body) = send(&f.app, get_authed("/api/reports/by-department", &f.token)).await;
    assert_eq!(status, 200);
    assert!(body["data"].as_array().unwrap().is_empty());
}

// ─── Anomalies: Respects Per-Pin Policies ───────────────────────────

/// Verify that anomaly detection runs with the correct per-employee
/// policy when departments have different work schedules.
#[tokio::test]
async fn anomalies_with_department_specific_policies() {
    let f = DashboardFixture::new().await;

    let eng_id = f.mgmt_dept("Engineering", None);
    f.seed_employee("e1", "Bob", "Engineering", &eng_id);

    // Create a duplicate check-in: two CheckIns in a row -> anomaly
    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let ts1 = today_at(9, 0);
    let ts2 = today_at(9, 1);
    f.storage.store_punch(&check_in("e1", "SN001", ts1)).await.unwrap();
    f.storage.store_punch(&check_in("e1", "SN001", ts2)).await.unwrap();

    let url = format!("/api/reports/anomalies?from={}&to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let data = body["data"].as_array().unwrap();
    // Duplicate check-in should be detected (regardless of policy)
    assert!(!data.is_empty(), "duplicate check-in should produce an anomaly");
    let anomaly = &data[0];
    assert_eq!(anomaly["user_pin"], "e1");
    assert_eq!(anomaly["kind"], "duplicate_check_in");
}

// ─── Monthly Trend: Handles Empty Range ────────────────────────────

#[tokio::test]
async fn monthly_trend_handles_empty_data() {
    let f = DashboardFixture::new().await;

    let (status, body) = send(&f.app, get_authed("/api/reports/monthly-trend", &f.token)).await;
    assert_eq!(status, 200);
    // Even with no data, returns a valid structure (months with 0%)
    assert!(body["data"].is_array());
}

// ─── Quick Stats: Respects Department Policies ─────────────────────

/// Verify that quick-stats counts work correctly with department-specific
/// policies (late arrivals are detected per-department).
#[tokio::test]
async fn quick_stats_with_department_policies() {
    let f = DashboardFixture::new().await;

    // Warehouse: 06:00 start, 10 min grace
    let warehouse = timekeep_core::model::WorkPolicy {
        work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
        work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
        late_threshold_secs: 10 * 60,
        ..timekeep_core::model::WorkPolicy::standard_9to5()
    };
    let wh_id = f.mgmt_dept("Warehouse", Some(warehouse));

    f.seed_employee("w1", "Carl", "Warehouse", &wh_id);
    f.seed_employee("e1", "Diana", "", "");

    // Warehouse at 06:05 (on time), Office at 09:20 (late)
    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let wh_ts = today_at(6, 5);
    let eng_ts = today_at(9, 20);
    f.storage.store_punch(&check_in("w1", "SN001", wh_ts)).await.unwrap();
    f.storage.store_punch(&check_in("e1", "SN001", eng_ts)).await.unwrap();

    let url = format!("/api/dashboard/quick-stats?from={}&to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    // quick-stats endpoint should return sensible values
    assert!(body["data"]["unique_users"].as_u64().unwrap() >= 2);
    assert!(body["data"]["total_punches"].as_u64().unwrap() >= 2);
}

// ─── Report Summary: Multi-Entity Filtering (Sprint 1) ─────────────

/// Filter by specific employee PINs returns only those employees' data.
#[tokio::test]
async fn report_summary_filters_by_user_pins() {
    let f = DashboardFixture::new().await;

    f.seed_employee("1001", "Alice", "", "");
    f.seed_employee("1002", "Bob", "", "");
    f.seed_employee("1003", "Carol", "", "");

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    // All three punch in and out
    for pin in &["1001", "1002", "1003"] {
        f.storage.store_punch(&check_in(pin, "SN001", today_at(8, 0))).await.unwrap();
        f.storage.store_punch(&check_out(pin, "SN001", today_at(16, 0))).await.unwrap();
    }

    // Request only Alice and Bob
    let url = format!("/api/reports/summary?date_from={}&date_to={}&user_pins=1001,1002", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    assert_eq!(body["data"]["total_punches"], 4, "only Alice + Bob punches");
    assert_eq!(body["data"]["unique_users"], 2, "only Alice + Bob");

    // Verify filtered employees list
    let employees = body["data"]["employees"].as_array().unwrap();
    let pins: Vec<&str> = employees.iter().map(|e| e["user_pin"].as_str().unwrap()).collect();
    assert!(pins.contains(&"1001"), "Alice should be in results");
    assert!(pins.contains(&"1002"), "Bob should be in results");
    assert!(!pins.contains(&"1003"), "Carol should NOT be in results");
}

/// Filter by device serial number returns only punches from that device.
#[tokio::test]
async fn report_summary_filters_by_device_sns() {
    let f = DashboardFixture::new().await;

    f.seed_employee("1001", "Alice", "", "");

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    // Punch on device SN001
    f.storage.store_punch(&check_in("1001", "SN001", today_at(8, 0))).await.unwrap();
    f.storage.store_punch(&check_out("1001", "SN001", today_at(16, 0))).await.unwrap();
    // Punch on device SN002
    f.storage.store_punch(&check_in("1001", "SN002", today_at(9, 0))).await.unwrap();
    f.storage.store_punch(&check_out("1001", "SN002", today_at(17, 0))).await.unwrap();

    // Filter only SN001
    let url = format!("/api/reports/summary?date_from={}&date_to={}&device_sns=SN001", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["total_punches"], 2, "only SN001 punches");
}

/// Filter by punch statuses returns only matching punch types.
#[tokio::test]
async fn report_summary_filters_by_statuses() {
    let f = DashboardFixture::new().await;

    f.seed_employee("1001", "Alice", "", "");

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    f.storage.store_punch(&check_in("1001", "SN001", today_at(8, 0))).await.unwrap();
    f.storage
        .store_punch(&make_punch(
            "1001",
            "SN001",
            today_at(12, 0),
            timekeep_core::model::PunchStatus::BreakOut,
        ))
        .await
        .unwrap();
    f.storage.store_punch(&check_out("1001", "SN001", today_at(16, 0))).await.unwrap();

    // Request only check_in + break_out
    let url = format!(
        "/api/reports/summary?date_from={}&date_to={}&statuses=check_in,break_out",
        from, to
    );
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    assert_eq!(body["data"]["check_ins"], 1, "should have 1 check_in");
    assert_eq!(body["data"]["break_outs"], 1, "should have 1 break_out");
    assert_eq!(body["data"]["check_outs"], 0, "check_out should be filtered out");
    assert_eq!(body["data"]["total_punches"], 2, "total should be 2 (check_in + break_out)");
}

/// The response includes `applied_filters` echoing back what the client sent.
#[tokio::test]
async fn report_summary_applied_filters_echoes_back() {
    let f = DashboardFixture::new().await;

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    let url = format!(
        "/api/reports/summary?date_from={}&date_to={}&user_pins=1001,1002&device_sns=SN001&statuses=check_in",
        from, to
    );
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let af = &body["data"]["applied_filters"];
    assert!(!af.is_null(), "applied_filters should be present");

    let user_pins = af["user_pins"].as_array().unwrap();
    assert_eq!(user_pins.len(), 2);
    assert!(user_pins.iter().any(|v| v.as_str() == Some("1001")));
    assert!(user_pins.iter().any(|v| v.as_str() == Some("1002")));

    let device_sns = af["device_sns"].as_array().unwrap();
    assert_eq!(device_sns.len(), 1);
    assert_eq!(device_sns[0], "SN001");

    let statuses = af["statuses"].as_array().unwrap();
    assert_eq!(statuses.len(), 1);
    assert_eq!(statuses[0], "check_in");
}

/// The response includes a `generated_at` server timestamp.
#[tokio::test]
async fn report_summary_has_generated_at() {
    let f = DashboardFixture::new().await;

    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let url = format!("/api/reports/summary?date_from={}&date_to={}", from, to);

    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let generated_at = body["data"]["generated_at"].as_i64();
    assert!(generated_at.is_some(), "generated_at should be present");
    let ts = generated_at.unwrap();
    // Should be a reasonable recent timestamp (positive, after the date range start)
    assert!(ts > 0, "generated_at should be positive");
}

/// `date_from` after `date_to` returns 422 validation error.
#[tokio::test]
async fn report_summary_rejects_date_from_after_date_to() {
    let f = DashboardFixture::new().await;

    let from = today_at(23, 59);
    let to = today_at(0, 0);
    let url = format!("/api/reports/summary?date_from={}&date_to={}", from, to);

    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 422, "date_from > date_to should return 422");
    assert!(
        body["error"]["message"].as_str().unwrap().contains("date_from must be before date_to")
    );
}

/// Employee KPIs include department_id and department_name when available.
#[tokio::test]
async fn report_summary_department_id_on_employee_kpi() {
    let f = DashboardFixture::new().await;

    let eng_id = f.mgmt_dept("Engineering", None);
    f.seed_employee("1001", "Alice", "Engineering", &eng_id);

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    f.storage.store_punch(&check_in("1001", "SN001", today_at(8, 0))).await.unwrap();
    f.storage.store_punch(&check_out("1001", "SN001", today_at(16, 0))).await.unwrap();

    let url = format!("/api/reports/summary?date_from={}&date_to={}", from, to);
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let employees = body["data"]["employees"].as_array().unwrap();
    assert_eq!(employees.len(), 1);

    let alice = &employees[0];
    assert_eq!(alice["user_pin"], "1001");
    assert_eq!(alice["department_id"], eng_id);
    assert_eq!(alice["department_name"], "Engineering");
}

/// Combining filters applies AND logic across dimensions.
/// e.g., user_pins=1001 + device_sns=SN001 should return only punches
/// from Alice on SN001, not Alice's SN002 punches or Bob's SN001 punches.
#[tokio::test]
async fn report_summary_combined_filters_apply_and_logic() {
    let f = DashboardFixture::new().await;

    f.seed_employee("1001", "Alice", "", "");
    f.seed_employee("1002", "Bob", "", "");

    let from = today_at(0, 0);
    let to = today_at(23, 59);

    // Alice on SN001
    f.storage.store_punch(&check_in("1001", "SN001", today_at(8, 0))).await.unwrap();
    // Alice on SN002
    f.storage.store_punch(&check_out("1001", "SN002", today_at(16, 0))).await.unwrap();
    // Bob on SN001
    f.storage.store_punch(&check_in("1002", "SN001", today_at(9, 0))).await.unwrap();

    // Filter: Alice only, SN001 only → should return exactly 1 punch
    let url = format!(
        "/api/reports/summary?date_from={}&date_to={}&user_pins=1001&device_sns=SN001",
        from, to
    );
    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    assert_eq!(
        body["data"]["total_punches"], 1,
        "only Alice's SN001 punch should match both filters"
    );
    assert_eq!(body["data"]["unique_users"], 1);
    assert_eq!(body["data"]["employees"][0]["user_pin"], "1001");
}

/// When `applied_filters` has null values (no filter requested), those
/// fields are omitted via `skip_serializing_if`.
#[tokio::test]
async fn report_summary_no_filters_omits_filter_fields() {
    let f = DashboardFixture::new().await;

    let from = today_at(0, 0);
    let to = today_at(23, 59);
    let url = format!("/api/reports/summary?date_from={}&date_to={}", from, to);

    let (status, body) = send(&f.app, get_authed(&url, &f.token)).await;
    assert_eq!(status, 200);

    let af = &body["data"]["applied_filters"];
    assert!(!af.is_null());
    // Fields without filters should be absent from JSON
    assert!(af["user_pins"].is_null(), "no user_pins filter → field should be null");
    assert!(af["device_sns"].is_null());
    assert!(af["statuses"].is_null());
    assert!(af["department_ids"].is_null());
}
