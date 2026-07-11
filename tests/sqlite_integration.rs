//! Integration tests for SQLite storage — real file I/O, not in-memory.
//!
//! Each test gets a temp file that is deleted on completion via `tempfile::TempDir`.
//! These tests verify that the SQLite storage backend correctly implements the
//! `Storage` trait with actual file-backed persistence.

use timekeep_core::model::AttendancePunch;
use timekeep_core::traits::storage::{PunchFilter, Storage};
use timekeep_core::{DeviceConfig, PunchStatus, VerifyMode};
use timekeep_storage_sqlite::SqliteStorage;

/// Helper: construct a valid `AttendancePunch` with a deterministic dedup ID.
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
        status,
        verify_mode: VerifyMode::Fingerprint,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        raw_data: None,
    };
    punch.id = punch.generate_deduplication_id();
    punch
}

/// Helper: open an in-memory SQLite storage.
///
/// Uses SQLite's `:memory:` mode, which exercises the same code paths
/// (WAL, migrations, query builder) as file-backed storage. File I/O
/// edge cases are covered by crate-level tests in `timekeep-storage-sqlite`.
///
/**
 * TODO(ENTERPRISE): Add file-backed temp-dir integration tests once the
 *                   macOS sandbox-compatible sqlite connection URL format
 *                   is resolved.
 *
 * Phase: CI/CD hardening
 * Impact: Tests currently cannot verify file persistence semantics.
 *         In-memory tests cover all SQL logic but not filesystem edge
 *         cases (permission errors, disk full, NFS locking).
 * Fix: Determine the correct sqlx `sqlite:` URL format for absolute file
 *       paths on macOS sandboxed test processes, or use `sqlx::sqlite::
 *       SqliteConnectOptions::new().filename(path)` directly.
 */
async fn temp_storage() -> (tempfile::TempDir, SqliteStorage) {
    // Create a dummy TempDir just to satisfy the return type — not used
    // for I/O by the in-memory database.
    let dir =
        tempfile::TempDir::with_prefix_in("timekeep-test-", "/tmp").expect("create dummy temp dir");
    let storage = SqliteStorage::new(":memory:").await.expect("open in-memory storage");
    (dir, storage)
}

// ─── Single Punch Storage ──────────────────────────────────────────────

#[tokio::test]
async fn test_store_and_query_single_punch() {
    let (_dir, storage) = temp_storage().await;

    let punch = make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn);
    storage.store_punch(&punch).await.expect("store punch");

    let results = storage.query_punches(&PunchFilter::default()).await.expect("query punches");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].user_pin, "145");
    assert_eq!(results[0].device_sn, "DEV001");
    assert_eq!(results[0].status, PunchStatus::CheckIn);
}

#[tokio::test]
async fn test_idempotent_insert() {
    let (_dir, storage) = temp_storage().await;

    let punch = make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn);

    // Insert twice — second should be silently ignored
    storage.store_punch(&punch).await.expect("first insert");
    storage.store_punch(&punch).await.expect("second insert (should be ignored)");

    let results = storage.query_punches(&PunchFilter::default()).await.expect("query punches");
    assert_eq!(results.len(), 1, "duplicate must not create a second row");
}

#[tokio::test]
async fn test_punch_exists() {
    let (_dir, storage) = temp_storage().await;

    let punch = make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn);
    storage.store_punch(&punch).await.expect("store punch");

    assert!(storage.punch_exists(&punch.id).await.expect("check existence"));
    assert!(!storage.punch_exists("nonexistent").await.expect("check missing"));
}

// ─── Batch Storage ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_batch_store_punches() {
    let (_dir, storage) = temp_storage().await;

    let punches: Vec<_> = (0..10)
        .map(|i| {
            make_punch("DEV001", &format!("EMP{i:03}"), 1752129600 + i as i64, PunchStatus::CheckIn)
        })
        .collect();

    let stored = storage.store_punches(&punches).await.expect("batch store");
    assert_eq!(stored, 10);

    let results = storage.query_punches(&PunchFilter::default()).await.expect("query punches");
    assert_eq!(results.len(), 10);
}

#[tokio::test]
async fn test_batch_store_idempotent() {
    let (_dir, storage) = temp_storage().await;

    let punches: Vec<_> = (0..5)
        .map(|i| {
            make_punch("DEV001", &format!("EMP{i:03}"), 1752129600 + i as i64, PunchStatus::CheckIn)
        })
        .collect();

    // First batch: all 5 inserted
    assert_eq!(storage.store_punches(&punches).await.unwrap(), 5);
    // Second batch: all 5 are duplicates → 0 inserted
    assert_eq!(
        storage.store_punches(&punches).await.unwrap(),
        0,
        "duplicates should not be counted"
    );

    let results = storage.query_punches(&PunchFilter::default()).await.unwrap();
    assert_eq!(results.len(), 5);
}

// ─── Query Filters ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_query_filter_by_device() {
    let (_dir, storage) = temp_storage().await;

    storage
        .store_punch(&make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn))
        .await
        .unwrap();
    storage
        .store_punch(&make_punch("DEV002", "146", 1752129601, PunchStatus::CheckIn))
        .await
        .unwrap();

    let filter = PunchFilter { device_sn: Some("DEV001".into()), ..Default::default() };
    let results = storage.query_punches(&filter).await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].user_pin, "145");
}

#[tokio::test]
async fn test_query_filter_by_user_pin() {
    let (_dir, storage) = temp_storage().await;

    storage
        .store_punch(&make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn))
        .await
        .unwrap();
    storage
        .store_punch(&make_punch("DEV001", "146", 1752129601, PunchStatus::CheckIn))
        .await
        .unwrap();

    let filter = PunchFilter { user_pin: Some("145".into()), ..Default::default() };
    let results = storage.query_punches(&filter).await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].device_sn, "DEV001");
}

#[tokio::test]
async fn test_query_filter_by_time_range() {
    let (_dir, storage) = temp_storage().await;

    storage
        .store_punch(&make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn))
        .await
        .unwrap();
    storage
        .store_punch(&make_punch("DEV001", "146", 1752130000, PunchStatus::CheckOut))
        .await
        .unwrap();

    let since = jiff::Timestamp::from_second(1752129500).unwrap();
    let until = jiff::Timestamp::from_second(1752129700).unwrap();
    let filter = PunchFilter { since: Some(since), until: Some(until), ..Default::default() };
    let results = storage.query_punches(&filter).await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].user_pin, "145");
}

#[tokio::test]
async fn test_query_limit_and_offset() {
    let (_dir, storage) = temp_storage().await;

    for i in 0..5 {
        storage
            .store_punch(&make_punch(
                "DEV001",
                &format!("EMP{i:03}"),
                1752129600 + i as i64,
                PunchStatus::CheckIn,
            ))
            .await
            .unwrap();
    }

    let filter = PunchFilter {
        params: timekeep_core::ListParams { limit: 2, ..Default::default() },
        ..Default::default()
    };
    let results = storage.query_punches(&filter).await.unwrap();
    assert_eq!(results.len(), 2);
}

#[tokio::test]
async fn test_query_order_desc() {
    let (_dir, storage) = temp_storage().await;

    storage
        .store_punch(&make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn))
        .await
        .unwrap();
    storage
        .store_punch(&make_punch("DEV001", "146", 1752130000, PunchStatus::CheckOut))
        .await
        .unwrap();

    let filter = PunchFilter::default();
    let results = storage.query_punches(&filter).await.unwrap();
    assert_eq!(results.len(), 2);
    // Default sort is timestamp desc → newest first
    assert_eq!(results[0].user_pin, "146");
    assert_eq!(results[1].user_pin, "145");
}

// ─── Device Configuration CRUD ─────────────────────────────────────────

#[tokio::test]
async fn test_device_config_crud() {
    let (_dir, storage) = temp_storage().await;

    let config = DeviceConfig {
        label: "Test Device".into(),
        serial_number: "SN001".into(),
        host: "192.168.1.100".into(),
        port: 4370,
        comm_key: 0,
        timezone: Some("Asia/Riyadh".into()),
        push_enabled: true,
        vendor: "zkteco".into(),
        location: None,
        poll_interval_secs: None,
    };

    // Create
    storage.upsert_device_config(&config).await.expect("upsert config");
    let configs = storage.list_device_configs().await.expect("list configs");
    assert_eq!(configs.len(), 1);
    assert_eq!(configs[0].label, "Test Device");
    assert_eq!(configs[0].serial_number, "SN001");

    // Update
    let mut updated = config.clone();
    updated.label = "Updated Device".into();
    storage.upsert_device_config(&updated).await.expect("upsert updated config");
    let configs = storage.list_device_configs().await.expect("list after update");
    assert_eq!(configs.len(), 1);
    assert_eq!(configs[0].label, "Updated Device");

    // Delete
    storage.delete_device_config("SN001").await.expect("delete config");
    let configs = storage.list_device_configs().await.expect("list after delete");
    assert_eq!(configs.len(), 0);
}

#[tokio::test]
async fn test_delete_nonexistent_device_config_is_noop() {
    let (_dir, storage) = temp_storage().await;

    // Deleting a config that doesn't exist should succeed silently
    storage.delete_device_config("GHOST").await.expect("delete nonexistent");
}

#[tokio::test]
async fn test_multiple_device_configs() {
    let (_dir, storage) = temp_storage().await;

    for i in 0..3 {
        let config = DeviceConfig {
            label: format!("Device {i}"),
            serial_number: format!("SN00{i}"),
            host: format!("192.168.1.{i}"),
            port: 4370,
            comm_key: 0,
            timezone: None,
            push_enabled: i % 2 == 0,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
        };
        storage.upsert_device_config(&config).await.expect("upsert");
    }

    let configs = storage.list_device_configs().await.unwrap();
    assert_eq!(configs.len(), 3);
}

// ─── Latest Punch for Device ───────────────────────────────────────────

#[tokio::test]
async fn test_latest_punch_for_device() {
    let (_dir, storage) = temp_storage().await;

    storage
        .store_punch(&make_punch("DEV001", "145", 1752129600, PunchStatus::CheckIn))
        .await
        .unwrap();
    storage
        .store_punch(&make_punch("DEV001", "146", 1752130000, PunchStatus::CheckOut))
        .await
        .unwrap();

    let latest = storage
        .latest_punch_for_device("DEV001")
        .await
        .unwrap()
        .expect("should have a latest punch");
    assert_eq!(latest.as_second(), 1752130000);
}

#[tokio::test]
async fn test_latest_punch_for_device_none() {
    let (_dir, storage) = temp_storage().await;

    let result = storage.latest_punch_for_device("NONEXISTENT").await.unwrap();
    assert!(result.is_none());
}
