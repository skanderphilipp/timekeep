//! Integration tests for role-based access control: verifying that
//! Viewer, Operator, and Admin roles have the correct endpoint access.
//!
//! ## Covered scenarios
//! - Viewer cannot POST/DELETE devices (should get 403)
//! - Operator cannot create API keys (should get 403)
//! - Admin can do everything

mod helpers;

use helpers::*;
use timekeep_core::model::DashboardUser;
use timekeep_core::model::iam::{PermissionSet, Role};

/// Create a dashboard user with the given role and password, seed it into
/// FakeStorage's dashboard_users, and return the JWT token.
async fn login_as_user(
    app: &axum::Router,
    storage: &std::sync::Arc<FakeStorage>,
    username: &str,
    password: &str,
    role: Role,
    permissions: PermissionSet,
) -> String {
    let hash = DashboardUser::hash_password(password, "ignored");
    let user = DashboardUser {
        id: format!("id-{username}"),
        username: username.to_string(),
        password_hash: hash,
        salt: String::new(), // argon2id embeds salt in PHC string
        role,
        permissions,
        display_name: username.to_string(),
        active: true,
        created_at: 0,
        updated_at: 0,
    };
    storage.dashboard_users.lock().unwrap().push(user);

    let body = serde_json::json!({"username": username, "password": password});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let (status, body) = send(app, req).await;
    assert_eq!(status, 200, "login should succeed for {username}: {body:?}");
    body["data"]["token"].as_str().unwrap().to_string()
}

// ─── Viewer role ─────────────────────────────────────────────────────

#[tokio::test]
async fn viewer_cannot_post_device() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "viewer1",
        "viewerpass",
        Role::Viewer,
        PermissionSet::empty(),
    )
    .await;

    let body = serde_json::json!({
        "serial_number": "TEST001",
        "label": "Test Device",
        "host": "192.168.1.100",
        "port": 4370,
        "comm_key": 0,
    });
    let (status, res_body) = send(&app, post_authed("/api/devices", &token, body)).await;
    assert_eq!(status, 403, "viewer should not be allowed to POST devices: {res_body:?}");
}

#[tokio::test]
async fn viewer_cannot_delete_device() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "viewer2",
        "viewerpass",
        Role::Viewer,
        PermissionSet::empty(),
    )
    .await;

    let (status, res_body) = send(&app, delete_authed("/api/devices/TEST001", &token)).await;
    assert_eq!(status, 403, "viewer should not be allowed to DELETE devices: {res_body:?}");
}

#[tokio::test]
async fn viewer_cannot_create_api_key() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "viewer3",
        "viewerpass",
        Role::Viewer,
        PermissionSet::empty(),
    )
    .await;

    let body = serde_json::json!({
        "name": "test-key",
        "permissions": "read:punches",
    });
    let (status, res_body) = send(&app, post_authed("/api/api-keys", &token, body)).await;
    assert_eq!(status, 403, "viewer should not be allowed to create API keys: {res_body:?}");
}

#[tokio::test]
async fn viewer_can_get_devices() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "viewer4",
        "viewerpass",
        Role::Viewer,
        PermissionSet::empty(),
    )
    .await;

    let (status, body) = send(&app, get_authed("/api/devices", &token)).await;
    assert_eq!(status, 200, "viewer should be able to GET devices");
    assert_success(&body);
}

// ─── Operator role ───────────────────────────────────────────────────

#[tokio::test]
async fn operator_cannot_create_api_key() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "operator1",
        "operatorpass",
        Role::Operator,
        PermissionSet::empty(),
    )
    .await;

    let body = serde_json::json!({
        "name": "test-key",
        "permissions": "read:punches",
    });
    let (status, res_body) = send(&app, post_authed("/api/api-keys", &token, body)).await;
    assert_eq!(status, 403, "operator should not be allowed to create API keys: {res_body:?}");
}

#[tokio::test]
async fn operator_cannot_delete_api_key() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "operator2",
        "operatorpass",
        Role::Operator,
        PermissionSet::empty(),
    )
    .await;

    let (status, res_body) = send(&app, delete_authed("/api/api-keys/some-id", &token)).await;
    assert_eq!(status, 403, "operator should not be allowed to delete API keys: {res_body:?}");
}

#[tokio::test]
async fn operator_can_correct_punch() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "operator3",
        "operatorpass",
        Role::Operator,
        PermissionSet::empty(),
    )
    .await;

    let body = serde_json::json!({
        "user_pin": "145",
        "device_sn": "DEV001",
        "status": "check_in",
    });
    let (status, body) = send(&app, post_authed("/api/punches/correct", &token, body)).await;
    // 201 = created successfully, 422 = validation error (missing timestamp, etc.)
    // Either is fine — what matters is it's NOT 403
    assert_ne!(status, 403, "operator should be allowed to correct punches");
}

#[tokio::test]
async fn operator_cannot_post_device() {
    let (app, storage) = test_app();
    let token = login_as_user(
        &app,
        &storage,
        "operator4",
        "operatorpass",
        Role::Operator,
        PermissionSet::empty(),
    )
    .await;

    let body = serde_json::json!({
        "serial_number": "TEST002",
        "label": "Test Device",
        "host": "192.168.1.101",
        "port": 4370,
        "comm_key": 0,
    });
    let (status, res_body) = send(&app, post_authed("/api/devices", &token, body)).await;
    assert_eq!(status, 403, "operator should not be allowed to POST devices: {res_body:?}");
}

// ─── Admin role ──────────────────────────────────────────────────────

#[tokio::test]
async fn admin_can_post_device() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let body = serde_json::json!({
        "serial_number": "ADMIN001",
        "label": "Admin Device",
        "host": "192.168.1.200",
        "port": 4370,
        "comm_key": 0,
    });
    let (status, body) = send(&app, post_authed("/api/devices", &token, body)).await;
    assert_eq!(status, 201, "admin should be able to POST devices");
    assert_success(&body);
}

#[tokio::test]
async fn admin_can_create_api_key() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let body = serde_json::json!({
        "name": "admin-key",
        "permissions": "read:punches",
    });
    let (status, body) = send(&app, post_authed("/api/api-keys", &token, body)).await;
    assert_eq!(status, 201, "admin should be able to create API keys");
    assert_success(&body);
}

#[tokio::test]
async fn admin_can_delete_device() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // First add a device so we can delete it
    let add_body = serde_json::json!({
        "serial_number": "TO_DELETE",
        "label": "Will Delete",
        "host": "192.168.1.201",
        "port": 4370,
        "comm_key": 0,
    });
    let _ = send(&app, post_authed("/api/devices", &token, add_body)).await;

    let (status, _body) = send(&app, delete_authed("/api/devices/TO_DELETE", &token)).await;
    assert_eq!(status, 200, "admin should be able to DELETE devices");
}

#[tokio::test]
async fn admin_can_get_devices() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/devices", &token)).await;
    assert_eq!(status, 200);
    assert_success(&body);
}
