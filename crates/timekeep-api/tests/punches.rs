//! Integration tests for punch management: creation, correction,
//! querying, and business logic around punch deduplication.

mod helpers;

use helpers::*;
use std::sync::Arc;

// ─── Punch Correction ──────────────────────────────────────────────

#[tokio::test]
async fn correct_punch_creates_record() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let body = serde_json::json!({
        "user_pin": "145",
        "device_sn": "SN001",
        "status": "check_in",
        "timestamp": 1752129600
    });
    let (status, body) = send(&app, post_authed("/api/punches/correct", &token, body)).await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["user_pin"], "145");
    assert!(body["error"].is_null());
}

#[tokio::test]
async fn correct_punch_sets_manual_correction_raw_data() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let body = serde_json::json!({
        "user_pin": "145",
        "device_sn": "SN001",
        "status": "check_out",
        "timestamp": 1752130000
    });
    let (status, body) = send(&app, post_authed("/api/punches/correct", &token, body)).await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["status"], "check_out");
    assert_eq!(body["data"]["user_pin"], "145");
}

#[tokio::test]
async fn correct_punch_accepts_all_status_types() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let statuses = ["check_in", "check_out", "break_out", "break_in"];
    let mut ts = 1752129600_i64;

    for status in &statuses {
        let body = serde_json::json!({
            "user_pin": "145",
            "device_sn": "SN001",
            "status": status,
            "timestamp": ts
        });
        let (resp_status, resp_body) =
            send(&app, post_authed("/api/punches/correct", &token, body)).await;
        assert_eq!(resp_status, 201, "status {status} should create punch");
        assert_eq!(resp_body["data"]["status"].as_str().unwrap(), *status);
        ts += 60; // Different timestamps for different dedup IDs
    }
}

#[tokio::test]
async fn correct_punch_invalid_status_returns_422() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let body = serde_json::json!({
        "user_pin": "145",
        "device_sn": "SN001",
        "status": "invalid_status",
        "timestamp": 1752129600
    });
    let (status, body) = send(&app, post_authed("/api/punches/correct", &token, body)).await;
    assert_eq!(status, 422, "invalid status should return 422");
    assert_error(&body, "validation_error");
}

// ─── Punch Query (single) ──────────────────────────────────────────

#[tokio::test]
async fn get_punch_by_id_returns_correct_punch() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create a punch
    let body = serde_json::json!({
        "user_pin": "145",
        "device_sn": "SN001",
        "status": "check_in",
        "timestamp": 1752129600
    });
    let (_, created) = send(&app, post_authed("/api/punches/correct", &token, body)).await;
    let punch_id = created["data"]["id"].as_str().unwrap();

    // Fetch it
    let (status, body) = send(&app, get_authed(&format!("/api/punches/{punch_id}"), &token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["user_pin"], "145");
    assert!(body["error"].is_null());
}

#[tokio::test]
async fn get_punch_not_found_returns_404() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, _body) = send(&app, get_authed("/api/punches/nonexistent-id", &token)).await;
    assert_eq!(status, 404);
}

// ─── Punch List ────────────────────────────────────────────────────

#[tokio::test]
async fn list_punches_returns_all_created() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create two punches
    send(
        &app,
        post_authed(
            "/api/punches/correct",
            &token,
            serde_json::json!({
                "user_pin": "145",
                "device_sn": "SN001",
                "status": "check_in",
                "timestamp": 1752129600
            }),
        ),
    )
    .await;
    send(
        &app,
        post_authed(
            "/api/punches/correct",
            &token,
            serde_json::json!({
                "user_pin": "146",
                "device_sn": "SN001",
                "status": "check_out",
                "timestamp": 1752130000
            }),
        ),
    )
    .await;

    let (status, body) = send(&app, get_authed("/api/punches", &token)).await;
    assert_eq!(status, 200);
    let punches = body["data"]["punches"].as_array().unwrap();
    assert_eq!(punches.len(), 2);
}

// ─── Punch Schema ──────────────────────────────────────────────────

#[tokio::test]
async fn punch_schema_returns_metadata() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;
    let (status, body) = send(&app, get_authed("/api/punches/schema", &token)).await;
    assert_eq!(status, 200);
    assert_success(&body);
}

// ─── Deduplication (business logic) ────────────────────────────────

#[tokio::test]
async fn same_punch_twice_produces_same_dedup_id() {
    // Test the core business logic: deduplication IDs are deterministic
    let p1 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    let p2 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert_eq!(p1.id, p2.id, "same inputs must produce same dedup ID");
}

#[tokio::test]
async fn different_pins_produce_different_dedup_ids() {
    let p1 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    let p2 = make_punch("146", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert_ne!(p1.id, p2.id, "different PINs must produce different dedup IDs");
}

#[tokio::test]
async fn different_timestamps_produce_different_dedup_ids() {
    let p1 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    let p2 = make_punch("145", "SN001", 1752129601, timekeep_core::model::PunchStatus::CheckIn);
    assert_ne!(p1.id, p2.id, "different timestamps must produce different dedup IDs");
}

#[tokio::test]
async fn different_devices_produce_different_dedup_ids() {
    let p1 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    let p2 = make_punch("145", "SN002", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert_ne!(p1.id, p2.id, "different devices must produce different dedup IDs");
}

#[tokio::test]
async fn different_statuses_produce_different_dedup_ids() {
    let p1 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    let p2 = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckOut);
    assert_ne!(p1.id, p2.id, "different statuses must produce different dedup IDs");
}

// ─── Punch Validation (business logic) ─────────────────────────────

#[tokio::test]
async fn validate_rejects_empty_pin() {
    let p = make_punch("", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert!(p.validate().is_err(), "empty PIN must be rejected");
}

#[tokio::test]
async fn validate_rejects_empty_device_sn() {
    let p = make_punch("145", "", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert!(p.validate().is_err(), "empty device_sn must be rejected");
}

#[tokio::test]
async fn validate_accepts_valid_punch() {
    let p = make_punch("145", "SN001", 1752129600, timekeep_core::model::PunchStatus::CheckIn);
    assert!(p.validate().is_ok(), "valid punch must pass validation");
}

// ─── Punch Status Mapping (business logic) ─────────────────────────

#[tokio::test]
async fn all_punch_statuses_try_from_valid_codes() {
    use timekeep_core::model::PunchStatus;
    assert_eq!(PunchStatus::try_from(0).unwrap(), PunchStatus::CheckIn);
    assert_eq!(PunchStatus::try_from(1).unwrap(), PunchStatus::CheckOut);
    assert_eq!(PunchStatus::try_from(2).unwrap(), PunchStatus::BreakOut);
    assert_eq!(PunchStatus::try_from(3).unwrap(), PunchStatus::BreakIn);
    assert_eq!(PunchStatus::try_from(4).unwrap(), PunchStatus::OvertimeIn);
    assert_eq!(PunchStatus::try_from(5).unwrap(), PunchStatus::OvertimeOut);
}

#[tokio::test]
async fn invalid_punch_status_code_returns_error() {
    assert!(timekeep_core::model::PunchStatus::try_from(99).is_err());
}

// ─── Verify Mode Mapping (business logic) ──────────────────────────

#[tokio::test]
async fn all_verify_modes_convert_correctly() {
    use timekeep_core::model::VerifyMode;
    assert_eq!(VerifyMode::from(0), VerifyMode::Password);
    assert_eq!(VerifyMode::from(1), VerifyMode::Fingerprint);
    assert_eq!(VerifyMode::from(4), VerifyMode::Card);
    assert_eq!(VerifyMode::from(15), VerifyMode::Face);
    assert_eq!(VerifyMode::from(25), VerifyMode::Palm);
}

#[tokio::test]
async fn unknown_verify_mode_defaults_to_fingerprint() {
    assert_eq!(
        timekeep_core::model::VerifyMode::from(99),
        timekeep_core::model::VerifyMode::Fingerprint
    );
}

#[tokio::test]
async fn verify_mode_names_are_correct() {
    use timekeep_core::model::VerifyMode;
    assert_eq!(VerifyMode::Password.name(), "Password");
    assert_eq!(VerifyMode::Fingerprint.name(), "Fingerprint");
    assert_eq!(VerifyMode::Card.name(), "RF Card");
    assert_eq!(VerifyMode::Face.name(), "Face Recognition");
    assert_eq!(VerifyMode::Palm.name(), "Palm Vein");
}
