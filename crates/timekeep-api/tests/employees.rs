//! Integration tests for employee listing with filter parameters.

mod helpers;

use helpers::*;
use std::sync::Arc;

/// Build an app with an in-memory employee store, pre-seeded with employees.
async fn seeded_app(
    employees: Vec<timekeep_core::model::Employee>,
) -> (axum::Router, Arc<FakeStorage>) {
    let storage = Arc::new(FakeStorage::new());
    let emp_store = Arc::new(FakeEmployeeStore::new());
    for emp in employees {
        emp_store.seed(emp);
    }
    let router = test_app_with_employees(storage.clone(), emp_store);
    (router, storage)
}

// ─── Department filter (serde + route integration) ───────────────────

#[tokio::test]
async fn filter_employees_by_department_csv() {
    let dept_a = "dept-a-uuid";
    let dept_b = "dept-b-uuid";

    let alice = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-1"),
        pin: "100".into(),
        name: "Alice".into(),
        department: Some("Engineering".into()),
        department_id: Some(dept_a.into()),
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };
    let bob = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-2"),
        pin: "101".into(),
        name: "Bob".into(),
        department: Some("Engineering".into()),
        department_id: Some(dept_a.into()),
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };
    let carl = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-3"),
        pin: "102".into(),
        name: "Carl".into(),
        department: None,
        department_id: None,
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };

    let (app, _storage) = seeded_app(vec![alice, bob, carl]).await;
    let token = login_as_admin(&app).await;

    // Filter by single department via CSV field
    let (status, body) =
        send(&app, get_authed(&format!("/api/employees?department_ids={dept_a}"), &token)).await;
    assert_eq!(status, 200, "expected 200, got body: {body}");

    // The response may be { data: [...] } or [...]
    let employees = body["data"].as_array().or_else(|| body.as_array());
    assert!(employees.is_some(), "response should contain employee list");
    let employees = employees.unwrap();
    assert_eq!(employees.len(), 2, "should return only Engineering employees");
}

#[tokio::test]
async fn filter_employees_by_multiple_departments_csv() {
    let dept_a = "dept-a-uuid";
    let dept_b = "dept-b-uuid";

    let alice = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-1"),
        pin: "100".into(),
        name: "Alice".into(),
        department: Some("Engineering".into()),
        department_id: Some(dept_a.into()),
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };
    let bob = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-2"),
        pin: "101".into(),
        name: "Bob".into(),
        department: Some("HR".into()),
        department_id: Some(dept_b.into()),
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };
    let carl = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-3"),
        pin: "102".into(),
        name: "Carl".into(),
        department: None,
        department_id: None,
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };

    let (app, _storage) = seeded_app(vec![alice, bob, carl]).await;
    let token = login_as_admin(&app).await;

    let (status, body) =
        send(&app, get_authed(&format!("/api/employees?department_ids={dept_a},{dept_b}"), &token))
            .await;
    assert_eq!(status, 200);
    let employees = body["data"].as_array().or_else(|| body.as_array()).unwrap();
    assert_eq!(employees.len(), 2, "should return Engineering + HR employees");
}

#[tokio::test]
async fn filter_employees_department_no_matches() {
    let alice = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-1"),
        pin: "100".into(),
        name: "Alice".into(),
        department: None,
        department_id: None,
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };

    let (app, _storage) = seeded_app(vec![alice]).await;
    let token = login_as_admin(&app).await;

    let (status, body) =
        send(&app, get_authed("/api/employees?department_ids=nonexistent", &token)).await;
    assert_eq!(status, 200);
    let employees = body["data"].as_array().or_else(|| body.as_array()).unwrap();
    assert!(employees.is_empty(), "no employees should match nonexistent department");
}

#[tokio::test]
async fn filter_employees_no_department_returns_all() {
    let alice = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-1"),
        pin: "100".into(),
        name: "Alice".into(),
        department: None,
        department_id: None,
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };
    let bob = timekeep_core::model::Employee {
        id: timekeep_core::EmployeeId::from("emp-2"),
        pin: "101".into(),
        name: "Bob".into(),
        department: None,
        department_id: None,
        external_id: None,
        joined_at: None,
        active: true,
        created_at: jiff::Timestamp::now(),
        updated_at: jiff::Timestamp::now(),
    };

    let (app, _storage) = seeded_app(vec![alice, bob]).await;
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/employees", &token)).await;
    assert_eq!(status, 200);
    let employees = body["data"].as_array().or_else(|| body.as_array()).unwrap();
    assert_eq!(employees.len(), 2, "no filter should return all employees");
}
