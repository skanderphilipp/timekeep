//! Integration tests for the REST API — management and integration routers.

use axum::body::Body;
use serde_json::{Value, json};
use std::sync::Arc;
use timekeep_api::app_state::DeviceConnectionState;
use timekeep_api::{RouterConfig, integration_router, management_router};
use timekeep_core::ProviderRegistry;
use timekeep_core::events::EventBus;
use timekeep_core::model::AttendancePunch;
use timekeep_core::test_utils::NoopEmployeeRepo;
use timekeep_core::traits::storage::Storage;
use timekeep_core::{PunchStatus, VerifyMode};
use timekeep_engine::health::EngineHealth;
use timekeep_storage_sqlite::SqliteStorage;

fn mgmt_router(storage: Arc<dyn Storage>) -> axum::Router {
    management_router(RouterConfig {
        event_bus: EventBus::default(),
        storage,
        employees: Some(Arc::new(NoopEmployeeRepo)),
        onboarding: None,
        search: None,
        device_state: DeviceConnectionState::default(),
        provider_registry: Arc::new(ProviderRegistry::new()),
        engine_health: EngineHealth::default(),
    })
}

/// Helper: create an in-memory SQLite storage for testing.
async fn memory_storage() -> Arc<dyn Storage> {
    Arc::new(SqliteStorage::new(":memory:").await.expect("in-memory SQLite should open"))
}

/// Helper: build a punch for insertion via the storage backend directly.
fn make_punch(
    device_sn: &str,
    user_pin: &str,
    timestamp_sec: i64,
    status: PunchStatus,
) -> AttendancePunch {
    let ts = jiff::Timestamp::from_second(timestamp_sec).expect("valid timestamp");
    let mut punch = AttendancePunch {
        id: String::new(),
        device_sn: device_sn.to_string(),
        user_pin: user_pin.to_string(),
        timestamp: ts,
        local_time: None,
        time_offset_secs: None,
        timezone_name: None,
        status,
        verify_mode: VerifyMode::Fingerprint,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        is_anomaly: false,
        anomaly_type: None,
        raw_data: None,
    };
    punch.id = punch.generate_deduplication_id();
    punch
}

/// Helper: login as admin and return the JWT token.
async fn login_and_get_token(router: &axum::Router) -> String {
    let body = json!({"username": "admin", "password": "admin"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
    let v: Value = serde_json::from_slice(&body_bytes).unwrap();
    v["data"]["token"].as_str().unwrap().to_string()
}

// ─── Management Router Tests ──────────────────────────────────────────

#[tokio::test]
async fn test_health_endpoint_returns_200() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let req = axum::http::Request::get("/api/health").body(Body::empty()).unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let v: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["data"]["status"], "healthy");
}

#[tokio::test]
async fn test_metrics_endpoint_returns_prometheus_format() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let req = axum::http::Request::get("/api/metrics").body(Body::empty()).unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
    let text = String::from_utf8_lossy(&body);
    assert!(text.contains("axum_http_requests_total"), "should contain Prometheus metric");
}

#[tokio::test]
async fn test_login_returns_jwt() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let body = json!({"username": "admin", "password": "admin"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let v: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(v["data"]["token"].as_str().is_some());
    assert!(!v["data"]["token"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn test_login_bad_password_returns_401() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let body = json!({"username": "admin", "password": "wrong"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_list_devices_requires_auth() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let req = axum::http::Request::get("/api/devices").body(Body::empty()).unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_list_devices_with_valid_token() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let token = login_and_get_token(&router).await;

    let req = axum::http::Request::get("/api/devices")
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn test_list_devices_with_bad_token_returns_401() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let req = axum::http::Request::get("/api/devices")
        .header("Authorization", "Bearer bad.token.here")
        .body(Body::empty())
        .unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_add_device_rejects_empty_fields() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage);

    let token = login_and_get_token(&router).await;

    let body = json!({"serial_number": "SN-EMPTY"});
    let req = axum::http::Request::post("/api/devices")
        .header("content-type", "application/json")
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 422);
}

#[tokio::test]
async fn test_end_to_end_punch_flow() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage.clone());

    let token = login_and_get_token(&router).await;

    // 1. Add a device
    let device_body = json!({
        "serial_number": "SN-E2E-001",
        "host": "192.168.1.200",
        "label": "E2E Test Device"
    });
    let req = axum::http::Request::post("/api/devices")
        .header("content-type", "application/json")
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::from(serde_json::to_string(&device_body).unwrap()))
        .unwrap();
    let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
    assert_eq!(resp.status(), 201);

    // 2. Store a punch directly (simulating device punch)
    let punch = make_punch("SN-E2E-001", "145", 1750588800, PunchStatus::CheckIn);
    storage.store_punch(&punch).await.expect("store punch");

    // 3. Query punches
    let req = axum::http::Request::get("/api/punches?device_sn=SN-E2E-001")
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
    let v: Value = serde_json::from_slice(&body_bytes).unwrap();
    let punches = v["data"]["punches"].as_array().unwrap();
    assert_eq!(punches.len(), 1);
    assert_eq!(punches[0]["user_pin"], "145");
}

#[tokio::test]
async fn test_end_to_end_punch_correction() {
    let storage = memory_storage().await;
    let router = mgmt_router(storage.clone());

    let token = login_and_get_token(&router).await;

    let correction_body = json!({
        "user_pin": "145",
        "device_sn": "SN001",
        "status": "check_in",
        "timestamp": 1750588800
    });
    let req = axum::http::Request::post("/api/punches/correct")
        .header("content-type", "application/json")
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::from(serde_json::to_string(&correction_body).unwrap()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 201);
}

// ─── Integration Router Tests ─────────────────────────────────────────

#[tokio::test]
async fn test_integration_health_requires_api_key() {
    let storage = memory_storage().await;
    let router = integration_router(RouterConfig {
        event_bus: EventBus::default(),
        storage,
        employees: Some(Arc::new(NoopEmployeeRepo)),
        onboarding: None,
        search: None,
        device_state: DeviceConnectionState::default(),
        provider_registry: Arc::new(ProviderRegistry::new()),
        engine_health: EngineHealth::default(),
    });

    // Integration health is behind API key middleware — requires auth
    let req = axum::http::Request::get("/api/v1/health").body(Body::empty()).unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_integration_punches_requires_api_key() {
    let storage = memory_storage().await;
    let router = integration_router(RouterConfig {
        event_bus: EventBus::default(),
        storage,
        employees: Some(Arc::new(NoopEmployeeRepo)),
        onboarding: None,
        search: None,
        device_state: DeviceConnectionState::default(),
        provider_registry: Arc::new(ProviderRegistry::new()),
        engine_health: EngineHealth::default(),
    });

    let req = axum::http::Request::get("/api/v1/punches").body(Body::empty()).unwrap();
    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 401);
}
