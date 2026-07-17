//! Integration tests for authentication: login, token validation,
//! role-based access control, and permission enforcement.

mod helpers;

use helpers::*;

// ─── Health ─────────────────────────────────────────────────────────

#[tokio::test]
async fn health_returns_envelope() {
    let (app, _storage) = test_app();
    let req = axum::http::Request::get("/api/health").body(axum::body::Body::empty()).unwrap();
    let (status, body) = send(&app, req).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["status"], "healthy");
    assert!(body["error"].is_null());
}

// ─── Login ──────────────────────────────────────────────────────────

#[tokio::test]
async fn login_with_valid_credentials_returns_jwt() {
    let (app, _storage) = test_app();
    let body = serde_json::json!({"username": "admin", "password": "admin"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let (status, body) = send(&app, req).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["token_type"], "Bearer");
    assert!(body["data"]["token"].as_str().unwrap().len() > 10);
    assert_eq!(body["data"]["username"], "admin");
}

#[tokio::test]
async fn login_with_wrong_password_returns_401() {
    let (app, _storage) = test_app();
    let body = serde_json::json!({"username": "admin", "password": "wrong"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let (status, body) = send(&app, req).await;
    assert_eq!(status, 401);
    assert_error(&body, "unauthorized");
}

#[tokio::test]
async fn login_with_nonexistent_user_returns_401() {
    let (app, _storage) = test_app();
    let body = serde_json::json!({"username": "nonexistent", "password": "irrelevant"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let (status, body) = send(&app, req).await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn login_returns_correct_user_role() {
    let (app, _storage) = test_app();
    let body = serde_json::json!({"username": "admin", "password": "admin"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let (status, body) = send(&app, req).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["role"], "admin");
    // Admin should have permissions (space-separated string)
    let perms = body["data"]["permissions"].as_str().unwrap();
    assert!(!perms.is_empty(), "admin should have permissions");
}

// ─── Auth Middleware ────────────────────────────────────────────────

#[tokio::test]
async fn protected_endpoint_without_token_returns_401() {
    let (app, _storage) = test_app();
    let req = axum::http::Request::get("/api/devices").body(axum::body::Body::empty()).unwrap();
    let (status, _body) = send(&app, req).await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn protected_endpoint_with_valid_token_returns_200() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;
    let (status, body) = send(&app, get_authed("/api/devices", &token)).await;
    assert_eq!(status, 200);
    assert_success(&body);
}

#[tokio::test]
async fn protected_endpoint_with_invalid_token_returns_401() {
    let (app, _storage) = test_app();
    let req = axum::http::Request::get("/api/devices")
        .header("Authorization", "Bearer invalid.token.here")
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, _body) = send(&app, req).await;
    assert_eq!(status, 401);
}

#[tokio::test]
async fn protected_endpoint_with_expired_token_returns_401() {
    let (app, _storage) = test_app();
    // Token that expired in the past
    let expired = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInBlcm1pc3Npb25zIjoiYWxsIiwiZXhwIjoxNzAwMDAwMDAwLCJpYXQiOjE3MDAwMDAwMDB9.invalid";
    let req = axum::http::Request::get("/api/devices")
        .header("Authorization", format!("Bearer {expired}"))
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, _body) = send(&app, req).await;
    assert_eq!(status, 401, "expired token should be rejected");
}

#[tokio::test]
async fn multiple_protected_endpoints_accept_same_token() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // The same token should work across multiple endpoints that don't need employee store
    let endpoints = ["/api/devices", "/api/punches", "/api/device-groups"];
    for path in &endpoints {
        let (status, body) = send(&app, get_authed(path, &token)).await;
        assert_eq!(status, 200, "endpoint {path} should accept valid token");
        assert_success(&body);
    }
}

// ─── Envelope Contract ─────────────────────────────────────────────

#[tokio::test]
async fn success_response_has_correct_envelope_shape() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/devices", &token)).await;
    assert_eq!(status, 200);
    assert!(body["data"].is_array(), "data should be array for list endpoint");
    assert!(body["meta"].is_object(), "meta should be present");
    assert!(body["error"].is_null(), "error should be null on success");
}

#[tokio::test]
async fn error_response_has_correct_envelope_shape() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/devices/NONEXISTENT", &token)).await;
    assert_eq!(status, 404);
    assert!(body["data"].is_null(), "data should be null on error");
    assert!(body["meta"].is_null(), "meta should be null on error");
    assert!(body["error"].is_object(), "error should be present");
    assert_eq!(body["error"]["code"], "not_found");
}

// ─── Punches Schema (unauthenticated check) ────────────────────────

#[tokio::test]
async fn punch_schema_endpoint_requires_auth() {
    let (app, _storage) = test_app();
    let req =
        axum::http::Request::get("/api/punches/schema").body(axum::body::Body::empty()).unwrap();
    let (status, _body) = send(&app, req).await;
    assert_eq!(status, 401, "schema endpoint should require auth");
}
