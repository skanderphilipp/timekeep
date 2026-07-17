//! Integration tests for department management: CRUD, duplicate
//! rejection, work policy linking, and name uniqueness enforcement.
//!
//! Department endpoints require an employee store, so all tests
//! use `test_app_with_employees`.

mod helpers;

use axum::Router;
use helpers::*;
use std::sync::Arc;

/// Helper to create a test app that includes the employee store.
fn app_with_employees() -> (Router, Arc<FakeStorage>, Arc<FakeEmployeeStore>) {
    let storage = Arc::new(FakeStorage::new());
    let employees = Arc::new(FakeEmployeeStore::new());
    let router = test_app_with_employees(storage.clone(), employees.clone());
    (router, storage, employees)
}

// ─── Department Creation ───────────────────────────────────────────

#[tokio::test]
async fn create_department_succeeds() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (status, body) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Engineering"})),
    )
    .await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["name"], "Engineering");
    assert!(body["data"]["id"].is_string());
}

#[tokio::test]
async fn create_department_rejects_empty_name() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (status, _body) =
        send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "   "})))
            .await;
    assert_eq!(status, 422, "empty/whitespace name should be rejected");
}

#[tokio::test]
async fn create_department_rejects_duplicate_name() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    // First creation
    send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Finance"})))
        .await;

    // Duplicate creation
    let (status, body) =
        send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Finance"})))
            .await;
    assert_eq!(status, 409, "duplicate department name should return 409");
    assert_error(&body, "duplicate");
}

// ─── Department Listing ────────────────────────────────────────────

#[tokio::test]
async fn list_departments_returns_all() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Engineering"})))
        .await;
    send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Marketing"})))
        .await;
    send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Finance"})))
        .await;

    let (status, body) = send(&app, get_authed("/api/departments", &token)).await;
    assert_eq!(status, 200);
    let depts = body["data"].as_array().unwrap();
    assert_eq!(depts.len(), 3);
}

#[tokio::test]
async fn list_departments_empty() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/departments", &token)).await;
    assert_eq!(status, 200);
    assert!(body["data"].as_array().unwrap().is_empty());
}

// ─── Department Detail ─────────────────────────────────────────────

#[tokio::test]
async fn get_department_by_id() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (_, create_body) =
        send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "R&D"})))
            .await;
    let dept_id = create_body["data"]["id"].as_str().unwrap();

    let (status, body) =
        send(&app, get_authed(&format!("/api/departments/{dept_id}"), &token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["name"], "R&D");
}

#[tokio::test]
async fn get_department_not_found() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/departments/nonexistent-id", &token)).await;
    assert_eq!(status, 404);
    assert_error(&body, "not_found");
}

// ─── Department Update ─────────────────────────────────────────────

#[tokio::test]
async fn update_department_name() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (_, created) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Old Name"})),
    )
    .await;
    let dept_id = created["data"]["id"].as_str().unwrap();

    let (status, body) = send(
        &app,
        put_authed(
            &format!("/api/departments/{dept_id}"),
            &token,
            serde_json::json!({"name": "New Name"}),
        ),
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["name"], "New Name");
}

#[tokio::test]
async fn update_department_to_duplicate_name_rejected() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    // Create two departments
    send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Alpha"}))).await;
    let (_, beta) =
        send(&app, post_authed("/api/departments", &token, serde_json::json!({"name": "Beta"})))
            .await;
    let beta_id = beta["data"]["id"].as_str().unwrap();

    // Try to rename Beta → Alpha (duplicate)
    let (status, _body) = send(
        &app,
        put_authed(
            &format!("/api/departments/{beta_id}"),
            &token,
            serde_json::json!({"name": "Alpha"}),
        ),
    )
    .await;
    assert_eq!(status, 409, "renaming to duplicate should return 409");
}

#[tokio::test]
async fn update_department_with_empty_name_rejected() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (_, created) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Engineering"})),
    )
    .await;
    let dept_id = created["data"]["id"].as_str().unwrap();

    let (status, _body) = send(
        &app,
        put_authed(
            &format!("/api/departments/{dept_id}"),
            &token,
            serde_json::json!({"name": "  "}),
        ),
    )
    .await;
    assert_eq!(status, 422, "renaming to empty should return 422");
}

// ─── Department Delete ─────────────────────────────────────────────

#[tokio::test]
async fn delete_department_succeeds() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (_, created) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "To Delete"})),
    )
    .await;
    let dept_id = created["data"]["id"].as_str().unwrap();

    let (status, _body) =
        send(&app, delete_authed(&format!("/api/departments/{dept_id}"), &token)).await;
    assert_eq!(status, 200);

    // Verify gone
    let (status, _body) =
        send(&app, get_authed(&format!("/api/departments/{dept_id}"), &token)).await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn delete_nonexistent_department_returns_404() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, delete_authed("/api/departments/nonexistent", &token)).await;
    assert_eq!(status, 404);
    assert_error(&body, "not_found");
}

// ─── Department with Work Policy ───────────────────────────────────

#[tokio::test]
async fn create_department_with_custom_work_policy() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let policy = serde_json::json!({
        "work_start": "06:00",
        "work_end": "14:00",
        "late_threshold_minutes": 10,
        "min_hours_for_full_day": 4,
        "daily_overtime_after_hours": 8,
        "working_days": [true, true, true, true, true, false, false]
    });

    let (status, body) = send(
        &app,
        post_authed(
            "/api/departments",
            &token,
            serde_json::json!({"name": "Warehouse", "work_policy": policy}),
        ),
    )
    .await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["name"], "Warehouse");

    // Verify policy is stored (work_policy field in response)
    let wp = &body["data"]["work_policy"];
    assert_eq!(wp["work_start"], "06:00");
    assert_eq!(wp["work_end"], "14:00");
}

#[tokio::test]
async fn create_department_rejects_invalid_work_policy() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    // No working days selected
    let policy = serde_json::json!({
        "work_start": "09:00",
        "work_end": "17:00",
        "working_days": [false, false, false, false, false, false, false]
    });

    let (status, _body) = send(
        &app,
        post_authed(
            "/api/departments",
            &token,
            serde_json::json!({"name": "Invalid Dept", "work_policy": policy}),
        ),
    )
    .await;
    assert_eq!(status, 422, "zero working days should be rejected");
}

#[tokio::test]
async fn create_department_rejects_same_start_and_end() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    let policy = serde_json::json!({
        "work_start": "09:00",
        "work_end": "09:00",
        "working_days": [true, true, true, true, true, false, false]
    });

    let (status, _body) = send(
        &app,
        post_authed(
            "/api/departments",
            &token,
            serde_json::json!({"name": "Bad Dept", "work_policy": policy}),
        ),
    )
    .await;
    assert_eq!(status, 422, "same start and end should be rejected");
}

// ─── Department Schema & Filters ───────────────────────────────────

#[tokio::test]
async fn department_schema_returns_metadata() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;
    let (status, body) = send(&app, get_authed("/api/departments/schema", &token)).await;
    assert_eq!(status, 200);
    assert_success(&body);
}

#[tokio::test]
async fn department_filters_returns_data() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;
    let (status, body) = send(&app, get_authed("/api/departments/filters", &token)).await;
    assert_eq!(status, 200);
    assert_success(&body);
}

// ─── Department work_policy_id FK linking ──────────────────────────

#[tokio::test]
async fn create_department_with_work_policy_template_fk() {
    let (app, _storage, _employees) = app_with_employees();
    let token = login_as_admin(&app).await;

    // Create a work policy template first
    let tpl_body = serde_json::json!({
        "title": "Night Shift",
        "work_start": "22:00",
        "work_end": "06:00",
        "late_threshold_minutes": 30,
        "min_hours_for_full_day": 4,
        "daily_overtime_after_hours": 8,
        "working_days": [true, true, true, true, true, false, false]
    });
    let (_, tpl_resp) = send(&app, post_authed("/api/work-policies", &token, tpl_body)).await;
    let tpl_id = tpl_resp["data"]["id"].as_str().unwrap();

    // Create department referencing the template
    let (status, body) = send(
        &app,
        post_authed(
            "/api/departments",
            &token,
            serde_json::json!({"name": "Night Crew", "work_policy_id": tpl_id}),
        ),
    )
    .await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["name"], "Night Crew");
    // The response should include the template title
    assert_eq!(body["data"]["work_policy_title"].as_str().unwrap(), "Night Shift");
}
