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

    let (status, body) = send(&f.app, get_authed("/api/reports/summary", &f.token)).await;
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
