//! Integration tests for the ADMS (Auto Data Master Server) HTTP endpoint.
//!
//! The ADMS protocol is how ZKTeco devices push attendance data via HTTP
//! rather than being polled via the SDK. The device sends a GET handshake
//! to discover capabilities, then POSTs tab-separated ATTLOG records.
//!
//! These tests exercise a minimal inline ADMS handler against the `EventBus`,
//! validating that:
//! - The handshake returns the expected `GET OPTION FROM:` response
//! - Tab-separated ATTLOG data is parsed and published as `PunchReceived` events

use axum::Router;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::routing::get;
use serde::Deserialize;
use std::collections::HashMap;
use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::model::{AttendancePunch, PunchStatus, VerifyMode};

// ─── Minimal ADMS Handler ───────────────────────────────────────────────

/// State shared with ADMS route handlers.
///
/// This test uses a minimal inline ADMS router for protocol-level integration
/// testing. The production ADMS module lives at `timekeep-zkteco/src/adms/` and
/// includes the full protocol spec (cdata, getrequest, devicecmd) with
/// authentication, command queuing, and logging.
#[derive(Clone)]
struct AdmsState {
    event_bus: EventBus,
}

/// Build a minimal ADMS router for testing the protocol.
fn adms_router(event_bus: EventBus) -> Router {
    let state = AdmsState { event_bus };

    Router::new()
        .route("/iclock/cdata", get(handle_adms_get).post(handle_adms_post))
        .with_state(state)
}

/// Parameters parsed from the ADMS GET query string.
#[derive(Deserialize)]
struct AdmsQuery {
    #[serde(rename = "SN")]
    sn: String,
    #[serde(default)]
    #[allow(dead_code)]
    table: Option<String>,
}

/// Handshake: ADMS devices send a GET to discover server capabilities.
///
/// The expected response format is `GET OPTION FROM: {serial_number}`,
/// followed by capability lines. This matches the ZKTeco ADMS protocol spec.
async fn handle_adms_get(Query(params): Query<AdmsQuery>) -> String {
    let mut response = format!(
        "GET OPTION FROM: {}\nATTLOGStamp=None\nOPERLOGStamp=None\nATTPHOTOStamp=None\n",
        params.sn
    );
    response.push_str("ErrorDelay=60\nDelay=30\nTransTimes=00:00;23:59\nTransInterval=5\n");
    response.push_str("TransFlag=0000001111\nRealtime=1\nEncrypt=0\n");
    response
}

/// Parses a single line of tab-separated ADMS ATTLOG data into an
/// `AttendancePunch`. Returns `None` if parsing fails.
fn parse_attlog_line(line: &str, device_sn: &str) -> Option<AttendancePunch> {
    let mut fields: HashMap<&str, &str> = HashMap::new();

    for part in line.split('\t') {
        if let Some((key, value)) = part.split_once('=') {
            fields.insert(key.trim(), value.trim());
        }
    }

    let user_pin = fields.get("PIN")?;
    let datetime = fields.get("DateTime")?;
    let status_code: i32 = fields.get("Status").unwrap_or(&"0").parse().ok()?;
    let verified: i32 = fields.get("Verified").unwrap_or(&"0").parse().ok()?;

    // The ADMS DateTime format is ISO 8601: "2026-07-10T08:30:00"
    // Parse manually: split on 'T', then parse date and time components.
    let ts = parse_iso_datetime(datetime)?;
    let status = PunchStatus::try_from(status_code).ok()?;
    let verify_mode = VerifyMode::from(verified);

    let mut punch = AttendancePunch {
        id: String::new(),
        device_sn: device_sn.to_string(),
        user_pin: user_pin.to_string(),
        timestamp: ts,
        local_time: None,
        time_offset_secs: None,
        timezone_name: None,
        status,
        verify_mode,
        work_code: fields.get("WorkCode").map(|s| s.to_string()),
        sub_status: None,
        employee_name: None,
        device_label: None,
        is_anomaly: false,
        anomaly_type: None,
        raw_data: Some(line.to_string()),
    };
    punch.id = punch.generate_deduplication_id();

    Some(punch)
}

/// Parse an ISO 8601 datetime
/// Parse an ISO 8601 datetime like "2026-07-10T08:30:00" into a `jiff::Timestamp`.
///
/// Uses `jiff::civil::DateTime::new()` for construction, which is the idiomatic
/// jiff approach. No dedicated `Timestamp::from_str` exists — timestamps are
/// always constructed via `civil::DateTime` + timezone conversion.
fn parse_iso_datetime(s: &str) -> Option<jiff::Timestamp> {
    // Format: "YYYY-MM-DDTHH:MM:SS"
    let (date_part, time_part) = s.split_once('T')?;

    let mut date_parts = date_part.split('-');
    let year: i16 = date_parts.next()?.parse().ok()?;
    let month: i8 = date_parts.next()?.parse().ok()?;
    let day: i8 = date_parts.next()?.parse().ok()?;

    let mut time_parts = time_part.split(':');
    let hour: i8 = time_parts.next()?.parse().ok()?;
    let minute: i8 = time_parts.next()?.parse().ok()?;
    let second: i8 = time_parts.next()?.parse().ok()?;

    let dt = jiff::civil::DateTime::new(year, month, day, hour, minute, second, 0).ok()?;
    dt.to_zoned(jiff::tz::TimeZone::UTC).map(|z| z.timestamp()).ok()
}

/// Process an ADMS POST: the body contains newline-separated ATTLOG records.
///
/// Each line is tab-separated fields: `PIN=X\tDateTime=Y\tVerified=Z\tStatus=W`.
/// Successfully parsed punches are published to the `EventBus`.
async fn handle_adms_post(State(state): State<AdmsState>, body: String) -> impl IntoResponse {
    let lines: Vec<&str> = body.lines().filter(|l| !l.is_empty()).collect();

    // Detect device SN from the POST body or use a default for testing.
    let device_sn = lines
        .first()
        .and_then(|l| l.split('\t').find(|p| p.starts_with("SN=")).map(|p| &p[3..]))
        .unwrap_or("UNKNOWN");

    let mut parsed = 0usize;
    for line in &lines {
        if let Some(punch) = parse_attlog_line(line, device_sn) {
            state.event_bus.publish(DomainEvent::PunchReceived { punch });
            parsed += 1;
        }
    }

    if parsed > 1 {
        state.event_bus.publish(DomainEvent::PunchesBatchReceived {
            device_sn: device_sn.to_string(),
            count: parsed,
        });
    }

    format!("OK: {parsed} records")
}

// ─── ADMS Integration Tests ─────────────────────────────────────────────

#[tokio::test]
async fn test_adms_handshake_returns_get_option_from() {
    let event_bus = EventBus::default();
    let router = adms_router(event_bus);

    let req = axum::http::Request::get("/iclock/cdata?SN=TESTDEVICE&options=all&table=ATTLOG")
        .body(Body::empty())
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
    let text = String::from_utf8_lossy(&body_bytes);

    assert!(
        text.contains("GET OPTION FROM: TESTDEVICE"),
        "handshake should identify the device SN, got: {text}"
    );
    assert!(text.contains("ATTLOGStamp=None"), "handshake should report ATTLOG stamp");
    assert!(text.contains("Realtime=1"), "handshake should enable realtime mode");
}

#[tokio::test]
async fn test_adms_cdata_post_attlog_single_punch() {
    let event_bus = EventBus::default();
    let mut subscriber = event_bus.subscribe();
    let router = adms_router(event_bus);

    // Simulate a device pushing a single ATTLOG record
    let body =
        "SN=TESTDEVICE\tPIN=145\tDateTime=2026-07-10T08:30:00\tVerified=1\tStatus=0\tWorkCode=0";

    let req = axum::http::Request::post("/iclock/cdata")
        .header("content-type", "text/plain")
        .body(Body::from(body.to_string()))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let text = String::from_utf8_lossy(&body_bytes);
    assert!(text.contains("OK: 1 records"), "should confirm 1 record ingested, got: {text}");

    // Verify the PunchReceived event was published
    let event = tokio::time::timeout(std::time::Duration::from_secs(1), subscriber.recv())
        .await
        .expect("timeout waiting for event")
        .expect("event should be received");

    match event.as_ref() {
        DomainEvent::PunchReceived { punch } => {
            assert_eq!(punch.user_pin, "145");
            assert_eq!(punch.device_sn, "TESTDEVICE");
            assert_eq!(punch.status, PunchStatus::CheckIn);
            assert_eq!(punch.verify_mode, VerifyMode::Fingerprint);
            assert_eq!(punch.work_code.as_deref(), Some("0"));
        },
        other => panic!("expected PunchReceived, got {:?}", other.event_type()),
    }
}

#[tokio::test]
async fn test_adms_cdata_post_attlog_batch() {
    let event_bus = EventBus::default();
    let mut subscriber = event_bus.subscribe();
    let router = adms_router(event_bus);

    // Simulate a device pushing 3 ATTLOG records in one batch
    let body = [
        "SN=TESTDEVICE\tPIN=145\tDateTime=2026-07-10T08:30:00\tVerified=1\tStatus=0",
        "SN=TESTDEVICE\tPIN=146\tDateTime=2026-07-10T09:00:00\tVerified=1\tStatus=0",
        "SN=TESTDEVICE\tPIN=145\tDateTime=2026-07-10T17:00:00\tVerified=1\tStatus=1",
    ]
    .join("\n");

    let req = axum::http::Request::post("/iclock/cdata")
        .header("content-type", "text/plain")
        .body(Body::from(body))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let text = String::from_utf8_lossy(&body_bytes);
    assert!(text.contains("OK: 3 records"));

    // Collect all events: 3 per-punch + 1 batch
    let mut punch_events = Vec::new();
    let mut batch_event_seen = false;

    for _ in 0..4 {
        let event = tokio::time::timeout(std::time::Duration::from_secs(1), subscriber.recv())
            .await
            .expect("timeout")
            .expect("event expected");

        match event.as_ref() {
            DomainEvent::PunchReceived { punch } => {
                punch_events.push(punch.clone());
            },
            DomainEvent::PunchesBatchReceived { count, .. } => {
                assert_eq!(*count, 3);
                batch_event_seen = true;
            },
            other => panic!("unexpected event type: {:?}", other.event_type()),
        }
    }

    assert_eq!(punch_events.len(), 3);
    assert!(batch_event_seen, "batch event should have been published");

    // Verify the last punch is a CheckOut
    assert_eq!(punch_events[2].user_pin, "145");
    assert_eq!(punch_events[2].status, PunchStatus::CheckOut);
}

#[tokio::test]
async fn test_adms_cdata_post_invalid_line_is_skipped() {
    let event_bus = EventBus::default();
    let mut subscriber = event_bus.subscribe();
    let router = adms_router(event_bus);

    // One valid line, one garbage line
    let body = [
        "SN=TESTDEVICE\tPIN=145\tDateTime=2026-07-10T08:30:00\tVerified=1\tStatus=0",
        "this is garbage data that cannot be parsed",
    ]
    .join("\n");

    let req = axum::http::Request::post("/iclock/cdata")
        .header("content-type", "text/plain")
        .body(Body::from(body))
        .unwrap();

    let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
    assert_eq!(resp.status(), 200);

    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let text = String::from_utf8_lossy(&body_bytes);
    // Only the valid line should be counted
    assert!(text.contains("OK: 1 records"));

    // Only the valid punch should generate a PunchReceived event
    let event = tokio::time::timeout(std::time::Duration::from_secs(1), subscriber.recv())
        .await
        .expect("timeout")
        .expect("event expected");

    match event.as_ref() {
        DomainEvent::PunchReceived { punch } => {
            assert_eq!(punch.user_pin, "145");
        },
        other => panic!("expected PunchReceived, got {:?}", other.event_type()),
    }
}
