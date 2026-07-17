//! Integration tests for device groups: CRUD, device membership,
//! department scoping, duplicate rejection, and sync validation.

mod helpers;

use helpers::*;

// ─── Group Creation ────────────────────────────────────────────────

#[tokio::test]
async fn create_group_succeeds() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Main Entrance"})),
    )
    .await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["name"], "Main Entrance");
    assert!(body["data"]["id"].is_string());
}

#[tokio::test]
async fn create_group_with_description_and_departments() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create departments first
    let (_, eng) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Engineering"})),
    )
    .await;
    let eng_id = eng["data"]["id"].as_str().unwrap();

    let (_, hr) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Human Resources"})),
    )
    .await;
    let hr_id = hr["data"]["id"].as_str().unwrap();

    let (status, body) = send(
        &app,
        post_authed(
            "/api/device-groups",
            &token,
            serde_json::json!({
                "name": "HQ Devices",
                "description": "All devices at headquarters",
                "department_ids": [eng_id, hr_id]
            }),
        ),
    )
    .await;
    assert_eq!(status, 201);
    assert_eq!(body["data"]["name"], "HQ Devices");
    assert_eq!(body["data"]["description"], "All devices at headquarters");

    let dept_ids: Vec<&str> = body["data"]["department_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    assert!(dept_ids.contains(&eng_id));
    assert!(dept_ids.contains(&hr_id));
}

#[tokio::test]
async fn create_group_rejects_empty_name() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, _body) =
        send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "   "})))
            .await;
    assert_eq!(status, 422, "empty/whitespace name should be rejected");
}

#[tokio::test]
async fn create_duplicate_group_rejected() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // First
    send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "Staff"})))
        .await;

    // Duplicate
    let (status, body) =
        send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "Staff"})))
            .await;
    assert_eq!(status, 409);
    assert_error(&body, "duplicate");
}

#[tokio::test]
async fn create_group_empty_department_ids_means_all() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "All Devices"})),
    )
    .await;
    assert_eq!(status, 201);
    // Empty department_ids means "all departments" — frontend interprets this
    let dept_ids = body["data"]["department_ids"].as_array().unwrap();
    assert!(dept_ids.is_empty(), "empty department_ids should be returned as empty array");
}

// ─── Group Listing ─────────────────────────────────────────────────

#[tokio::test]
async fn list_groups_returns_all() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "Group A"})))
        .await;
    send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "Group B"})))
        .await;

    let (status, body) = send(&app, get_authed("/api/device-groups", &token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
}

// ─── Group Detail ──────────────────────────────────────────────────

#[tokio::test]
async fn get_group_by_id() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (_, created) =
        send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "Lobby"})))
            .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    let (status, body) =
        send(&app, get_authed(&format!("/api/device-groups/{group_id}"), &token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["name"], "Lobby");
}

#[tokio::test]
async fn get_group_not_found() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, body) = send(&app, get_authed("/api/device-groups/nonexistent", &token)).await;
    assert_eq!(status, 404);
    assert_error(&body, "not_found");
}

#[tokio::test]
async fn get_group_shows_device_count() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create group
    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "With Devices"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    // Create device in that group
    send(
        &app,
        post_authed(
            "/api/devices",
            &token,
            serde_json::json!({"serial_number": "SN001", "host": "10.0.0.1", "group_id": group_id}),
        ),
    )
    .await;

    let (status, body) =
        send(&app, get_authed(&format!("/api/device-groups/{group_id}"), &token)).await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["device_count"], 1);
}

// ─── Group Update ──────────────────────────────────────────────────

#[tokio::test]
async fn update_group_rename_succeeds() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Old Name"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    let (status, body) = send(
        &app,
        put_authed(
            &format!("/api/device-groups/{group_id}"),
            &token,
            serde_json::json!({"name": "New Name"}),
        ),
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(body["data"]["name"], "New Name");
}

#[tokio::test]
async fn update_group_to_duplicate_name_rejected() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create two groups
    send(&app, post_authed("/api/device-groups", &token, serde_json::json!({"name": "First"})))
        .await;
    let (_, second) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Second"})),
    )
    .await;
    let second_id = second["data"]["id"].as_str().unwrap();

    // Try rename Second → First
    let (status, _body) = send(
        &app,
        put_authed(
            &format!("/api/device-groups/{second_id}"),
            &token,
            serde_json::json!({"name": "First"}),
        ),
    )
    .await;
    assert_eq!(status, 409, "renaming to duplicate should return 409");
}

#[tokio::test]
async fn update_group_departments() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create departments
    let (_, eng) = send(
        &app,
        post_authed("/api/departments", &token, serde_json::json!({"name": "Engineering"})),
    )
    .await;
    let eng_id = eng["data"]["id"].as_str().unwrap();

    // Create group
    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Updatable"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    // Update departments
    let (status, body) = send(
        &app,
        put_authed(
            &format!("/api/device-groups/{group_id}"),
            &token,
            serde_json::json!({"department_ids": [eng_id]}),
        ),
    )
    .await;
    assert_eq!(status, 200);
    let dept_ids = body["data"]["department_ids"].as_array().unwrap();
    assert_eq!(dept_ids.len(), 1);
    assert_eq!(dept_ids[0], eng_id);
}

// ─── Group Delete ──────────────────────────────────────────────────

#[tokio::test]
async fn delete_group_succeeds() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "To Delete"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    let (status, _body) =
        send(&app, delete_authed(&format!("/api/device-groups/{group_id}"), &token)).await;
    assert_eq!(status, 200);

    // Verify gone
    let (status, _body) =
        send(&app, get_authed(&format!("/api/device-groups/{group_id}"), &token)).await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn delete_nonexistent_group_returns_404() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;
    let (status, body) = send(&app, delete_authed("/api/device-groups/nonexistent", &token)).await;
    assert_eq!(status, 404);
    assert_error(&body, "not_found");
}

// ─── Devices in Group ──────────────────────────────────────────────

#[tokio::test]
async fn list_devices_in_group() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create group
    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Entrance"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    // Create device in that group
    send(
        &app,
        post_authed(
            "/api/devices",
            &token,
            serde_json::json!({
                "serial_number": "SN001",
                "host": "10.0.0.1",
                "group_id": group_id
            }),
        ),
    )
    .await;

    let (status, body) =
        send(&app, get_authed(&format!("/api/device-groups/{group_id}/devices"), &token)).await;
    assert_eq!(status, 200);
    let devices = body["data"].as_array().unwrap();
    assert_eq!(devices.len(), 1);
    assert_eq!(devices[0]["serial_number"], "SN001");
}

#[tokio::test]
async fn list_devices_in_nonexistent_group_returns_404() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, _body) =
        send(&app, get_authed("/api/device-groups/nonexistent/devices", &token)).await;
    assert_eq!(status, 404);
}

// ─── Group Sync Validation ─────────────────────────────────────────

#[tokio::test]
async fn sync_nonexistent_group_rejected() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    let (status, _body) = send(
        &app,
        post_authed("/api/device-groups/nonexistent/sync", &token, serde_json::json!({})),
    )
    .await;
    assert_eq!(status, 404, "sync of nonexistent group should fail");
}

#[tokio::test]
async fn sync_empty_group_rejected() {
    let (app, _storage) = test_app();
    let token = login_as_admin(&app).await;

    // Create group with no devices
    let (_, created) = send(
        &app,
        post_authed("/api/device-groups", &token, serde_json::json!({"name": "Empty Group"})),
    )
    .await;
    let group_id = created["data"]["id"].as_str().unwrap();

    // Try sync (should fail because no devices)
    let (status, _body) = send(
        &app,
        post_authed(&format!("/api/device-groups/{group_id}/sync"), &token, serde_json::json!({})),
    )
    .await;
    assert_eq!(status, 422, "sync of empty group should be rejected");
}
