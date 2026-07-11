//! ADMS (Automatic Data Master Server) — HTTP push protocol receiver.
//!
//! Implements the 5 ADMS endpoints for ALL devices on a single port:
//! - `POST /iclock/cdata` — receives attendance records, user info, device info
//! - `GET /iclock/getrequest` — device polls for pending commands
//! - `POST /iclock/devicecmd` — device confirms command execution
//! - `GET/POST /iclock/registry` — device registration & capabilities
//! - `GET /iclock/inspect` — JSON device snapshot (debugging)
//!
//! Devices identify themselves via the `SN` query parameter in every request.
//! A single `AdmsServer` instance handles all devices concurrently.

pub mod parser;
pub mod queue;
pub mod types;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::{
    Router,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use queue::CommandQueue;
use timekeep_core::{Error, EventBus, events::DomainEvent};
use tokio::net::TcpListener;

/// Status of a device tracked by the ADMS server.
#[derive(Debug, Clone)]
pub struct DeviceStatus {
    pub serial_number: String,
    pub last_seen: Option<jiff::Timestamp>,
    pub last_activity: Option<Instant>,
    pub pending_commands: usize,
    pub total_punches: u64,
    pub total_oplogs: u64,
    pub is_online: bool,
    /// Device-local timezone offset from UTC in seconds
    pub timezone_offset_secs: i32,
}

/// Time after which a device is considered offline (no contact).
#[expect(dead_code)]
const DEVICE_OFFLINE_TIMEOUT_SECS: u64 = 120;

/// Per-device state stored in the shared ADMS server registry.
///
/// Created externally (e.g., by `ZkTecoDevice`) and registered
/// with the shared `AdmsServer` so handlers can route by serial number.
#[derive(Clone)]
pub struct DeviceAdmsState {
    pub command_queue: Arc<Mutex<CommandQueue>>,
    pub status: Arc<Mutex<DeviceStatus>>,
}

impl DeviceAdmsState {
    pub fn new(serial_number: impl Into<String>) -> Self {
        Self {
            command_queue: Arc::new(Mutex::new(CommandQueue::new(300))),
            status: Arc::new(Mutex::new(DeviceStatus {
                serial_number: serial_number.into(),
                last_seen: None,
                last_activity: None,
                pending_commands: 0,
                total_punches: 0,
                total_oplogs: 0,
                is_online: false,
                timezone_offset_secs: 0,
            })),
        }
    }
}

/// A **shared** ADMS push server that handles all devices on a single port.
///
/// Devices register their per-device state via [`register`](AdmsServer::register).
/// The HTTP handlers parse the `SN` query parameter from each request
/// and route to the appropriate device's state.
pub struct AdmsServer {
    bind_addr: SocketAddr,
    event_bus: EventBus,
    /// Per-device state, keyed by serial number.
    devices: Arc<std::sync::RwLock<HashMap<String, DeviceAdmsState>>>,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl AdmsServer {
    /// Create a new shared ADMS server.
    ///
    /// The server is NOT started until [`start`](AdmsServer::start) is called.
    pub fn new(bind: impl Into<String>, event_bus: EventBus) -> Self {
        let addr: SocketAddr = bind.into().parse().unwrap_or_else(|_| "[::]:8085".parse().unwrap());
        Self {
            bind_addr: addr,
            event_bus,
            devices: Arc::new(std::sync::RwLock::new(HashMap::new())),
            shutdown_tx: None,
        }
    }

    /// Register a device's ADMS state so its serial number is recognised.
    ///
    /// Must be called **before** the scanner sends its first POST.
    /// Typically called from `ZkTecoDevice::connect()`.
    pub fn register(&self, sn: String, state: DeviceAdmsState) {
        self.devices.write().unwrap().insert(sn, state);
    }

    /// Unregister a device (e.g., on disconnect or decommission).
    pub fn unregister(&self, sn: &str) {
        self.devices.write().unwrap().remove(sn);
    }

    /// Look up a device's command queue for external use (API enqueue).
    pub fn command_queue(&self, sn: &str) -> Option<Arc<Mutex<CommandQueue>>> {
        self.devices.read().unwrap().get(sn).map(|s| s.command_queue.clone())
    }

    /// Get a snapshot of a device's current status.
    pub fn device_status(&self, sn: &str) -> Option<DeviceStatus> {
        self.devices.read().unwrap().get(sn).map(|s| s.status.lock().unwrap().clone())
    }

    /// The address this server is bound to (useful after binding to port 0).
    pub fn bind_addr(&self) -> SocketAddr {
        self.bind_addr
    }

    /// Get a snapshot of **all** device statuses.
    pub fn all_device_statuses(&self) -> HashMap<String, DeviceStatus> {
        self.devices
            .read()
            .unwrap()
            .iter()
            .map(|(sn, state)| (sn.clone(), state.status.lock().unwrap().clone()))
            .collect()
    }

    /// Start the HTTP server in a background task.
    pub async fn start(&mut self) -> Result<(), Error> {
        let app = self.router();
        let listener = TcpListener::bind(self.bind_addr)
            .await
            .map_err(|e| Error::device(format!("ADMS bind to {} failed: {e}", self.bind_addr)))?;

        // Record the actual OS-assigned address (relevant when binding to port 0)
        self.bind_addr =
            listener.local_addr().map_err(|e| Error::device(format!("ADMS local_addr: {e}")))?;

        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                })
                .await
                .unwrap_or_else(|e| {
                    tracing::error!(%e, "ADMS server error");
                });
        });

        tracing::info!(
            addr = %self.bind_addr,
            "shared ADMS server started (multi-device)"
        );
        Ok(())
    }

    /// Stop the ADMS server gracefully.
    pub async fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        tracing::info!("ADMS server stopped");
    }

    /// Build the axum Router with all ADMS endpoints.
    fn router(&self) -> Router {
        let state =
            SharedAdmsState { event_bus: self.event_bus.clone(), devices: self.devices.clone() };

        Router::new()
            .route("/iclock/cdata", post(handle_cdata).get(handle_cdata_get))
            .route("/iclock/getrequest", get(handle_getrequest))
            .route("/iclock/devicecmd", post(handle_devicecmd))
            .route("/iclock/registry", get(handle_registry).post(handle_registry))
            .route("/iclock/inspect", get(handle_inspect))
            .with_state(state)
    }
}

// ── Axum shared state (cloneable) ────────────────────────────────────

/// Shared state passed to every ADMS handler via axum `State`.
#[derive(Clone)]
struct SharedAdmsState {
    event_bus: EventBus,
    devices: Arc<std::sync::RwLock<HashMap<String, DeviceAdmsState>>>,
}

impl SharedAdmsState {
    /// Look up a device by serial number.
    fn get_device(&self, sn: &str) -> Option<DeviceAdmsState> {
        self.devices.read().unwrap().get(sn).cloned()
    }
}

// ── Query parameter parsing ──────────────────────────────────────────

/// Parsed from the `?SN=...&table=...` query string that every ADMS request carries.
#[derive(serde::Deserialize)]
struct CDataQuery {
    #[serde(rename = "SN")]
    sn: Option<String>,
    table: Option<String>,
    #[allow(dead_code)]
    options: Option<String>,
    #[allow(dead_code)]
    pushver: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "PushOptionsFlag")]
    push_options_flag: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────

/// Mark a device as active (update `last_seen`, `last_activity`, `is_online`).
fn mark_device_active(state: &DeviceAdmsState) {
    if let Ok(mut status) = state.status.lock() {
        status.last_seen = Some(jiff::Timestamp::now());
        status.last_activity = Some(Instant::now());
        status.is_online = true;
    }
}

/// Resolve a device by SN, or return 404 if not registered.
macro_rules! require_device {
    ($state:expr, $sn:expr) => {
        match $state.get_device($sn) {
            Some(d) => d,
            None => {
                tracing::warn!(device = %$sn, "ADMS: unrecognised device SN");
                return (StatusCode::NOT_FOUND, "UNKNOWN DEVICE".to_string()).into_response();
            },
        }
    };
}

// ── Handlers ─────────────────────────────────────────────────────────

/// POST — receive attendance data from a device.
///
/// The device serial number is parsed from the `SN` query parameter
/// and used to route the data to the correct device's state.
async fn handle_cdata(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
    body: String,
) -> impl IntoResponse {
    let sn = query.sn.as_deref().unwrap_or("UNKNOWN");
    let device = require_device!(state, sn);
    mark_device_active(&device);

    let table = query.table.as_deref().unwrap_or("UNKNOWN");

    match table {
        "ATTLOG" => {
            let mut records = parser::parse_attendance(&body, sn);

            // Apply device timezone offset to normalize timestamps to UTC
            let tz_offset_secs =
                device.status.lock().ok().map(|s| s.timezone_offset_secs).unwrap_or(0);
            if tz_offset_secs != 0 {
                for punch in &mut records {
                    let adjusted = punch.timestamp.as_second().wrapping_sub(tz_offset_secs as i64);
                    if let Ok(ts) = jiff::Timestamp::from_second(adjusted) {
                        punch.timestamp = ts;
                    }
                }
            }

            // Update punch counter
            let count = records.len();
            if let Ok(mut status) = device.status.lock() {
                status.total_punches += count as u64;
            }

            // Publish directly to the shared event bus
            for punch in records {
                state.event_bus.publish(DomainEvent::PunchReceived { punch });
            }

            tracing::info!(
                table = "ATTLOG",
                device = %sn,
                count = count,
                "attendance records received",
            );

            (StatusCode::OK, format!("OK: {count}")).into_response()
        },
        "OPERLOG" => {
            let logs = parser::parse_operation_logs(&body, sn);
            let count = logs.len();

            if let Ok(mut status) = device.status.lock() {
                status.total_oplogs += count as u64;
            }

            for log in &logs {
                state.event_bus.publish(DomainEvent::OperationLogReceived { log: log.clone() });
            }

            tracing::info!(
                table = "OPERLOG",
                device = %sn,
                count = count,
                "operation logs received",
            );
            (StatusCode::OK, format!("OK: {count}")).into_response()
        },
        "USERINFO" => {
            let users = parser::parse_users(&body, sn);
            tracing::info!(
                table = "USERINFO",
                device = %sn,
                count = users.len(),
                "user records received",
            );
            (StatusCode::OK, "OK".to_string()).into_response()
        },
        _ => {
            // Default case: may be device INFO push or unknown table
            let info = parser::parse_kv_pairs(&body);
            if !info.is_empty() {
                if let Ok(mut status) = device.status.lock()
                    && let Some(tz) = info.get("TimeZone")
                {
                    status.timezone_offset_secs = tz.parse::<i32>().unwrap_or(0) * 3600;
                }
                tracing::info!(
                    device = %sn,
                    keys = ?info.keys().collect::<Vec<_>>(),
                    "device info received"
                );
            } else {
                tracing::debug!(
                    table = %table,
                    device = %sn,
                    "unknown table type, returning OK",
                );
            }
            (StatusCode::OK, "OK".to_string()).into_response()
        },
    }
}

/// GET — device heartbeat and handshake.
///
/// The scanner calls this periodically to check in. We respond with
/// configuration parameters (poll interval, transflag, etc.).
async fn handle_cdata_get(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
) -> impl IntoResponse {
    let sn = query.sn.as_deref().unwrap_or("UNKNOWN");
    let device = require_device!(state, sn);
    mark_device_active(&device);

    let response = format!(
        "GET OPTION FROM: {sn}\r\n\
         Stamp=9999\r\n\
         OpStamp={}\r\n\
         ErrorDelay=60\r\n\
         Delay=30\r\n\
         TransTimes=00:00;14:05\r\n\
         TransInterval=1\r\n\
         TransFlag=1111000000\r\n\
         Realtime=1\r\n\
         Encrypt=0",
        jiff::Timestamp::now().as_second()
    );

    tracing::debug!(device = %sn, "ADMS handshake");
    (StatusCode::OK, response).into_response()
}

/// Device polls for pending commands.
async fn handle_getrequest(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
) -> impl IntoResponse {
    let sn = query.sn.as_deref().unwrap_or("UNKNOWN");
    let device = require_device!(state, sn);
    mark_device_active(&device);

    let mut queue = device.command_queue.lock().unwrap();
    let response = queue.get_pending(sn);

    if response != "OK" {
        tracing::info!(
            device = %sn,
            commands = %response,
            "returning pending commands to device"
        );
    } else {
        tracing::debug!(device = %sn, "getrequest: no pending commands");
    }

    (StatusCode::OK, response).into_response()
}

/// Device confirms command execution result.
async fn handle_devicecmd(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
    body: String,
) -> impl IntoResponse {
    let sn = query.sn.as_deref().unwrap_or("UNKNOWN");
    let device = require_device!(state, sn);
    mark_device_active(&device);

    let body = body.trim().to_string();

    if !body.is_empty() && body != "OK" {
        let mut queue = device.command_queue.lock().unwrap();
        for line in body.lines() {
            let cmd = line.trim();
            if !cmd.is_empty() {
                queue.confirm(sn, cmd);
            }
        }
    }

    tracing::debug!(
        device = %sn,
        body = %body,
        "devicecmd received"
    );
    (StatusCode::OK, "OK".to_string()).into_response()
}

/// Device registration and capabilities.
async fn handle_registry(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
    body: String,
) -> impl IntoResponse {
    let sn = query.sn.as_deref().unwrap_or("UNKNOWN");
    let device = require_device!(state, sn);
    mark_device_active(&device);

    if !body.is_empty() {
        let info = parser::parse_kv_pairs(&body);

        if let Ok(mut status) = device.status.lock()
            && let Some(tz) = info.get("TimeZone")
        {
            status.timezone_offset_secs = tz.parse::<i32>().unwrap_or(0) * 3600;
        }

        tracing::info!(
            device = %sn,
            keys = ?info.keys().collect::<Vec<_>>(),
            "device registry updated",
        );
    }

    (StatusCode::OK, "OK".to_string()).into_response()
}

/// JSON snapshot of device state (debug endpoint).
///
/// Accepts `?SN=DEVICE_SN` to inspect a specific device,
/// or shows a summary of all registered devices.
async fn handle_inspect(
    State(state): State<SharedAdmsState>,
    Query(query): Query<CDataQuery>,
) -> impl IntoResponse {
    if let Some(sn) = &query.sn {
        // Inspect a specific device
        match state.get_device(sn) {
            Some(device) => {
                let pending = device.command_queue.lock().unwrap().pending_count(sn);
                let status = device.status.lock().unwrap();

                let body = serde_json::json!({
                    "device": sn,
                    "status": if status.is_online { "online" } else { "offline" },
                    "last_seen": status.last_seen.map(|ts| ts.as_second().to_string()),
                    "timezone_offset_secs": status.timezone_offset_secs,
                    "total_punches": status.total_punches,
                    "total_oplogs": status.total_oplogs,
                    "pending_commands": pending,
                });
                (StatusCode::OK, body.to_string()).into_response()
            },
            None => {
                (StatusCode::NOT_FOUND, format!("Device '{sn}' not registered")).into_response()
            },
        }
    } else {
        // Show summary of all devices
        let devices = state.devices.read().unwrap();
        let summary: Vec<serde_json::Value> = devices
            .iter()
            .map(|(sn, device)| {
                let pending = device.command_queue.lock().unwrap().pending_count(sn);
                let status = device.status.lock().unwrap();
                serde_json::json!({
                    "device": sn,
                    "status": if status.is_online { "online" } else { "offline" },
                    "last_seen": status.last_seen.map(|ts| ts.as_second().to_string()),
                    "total_punches": status.total_punches,
                    "total_oplogs": status.total_oplogs,
                    "pending_commands": pending,
                })
            })
            .collect();

        let body = serde_json::json!({
            "device_count": devices.len(),
            "devices": summary,
        });
        (StatusCode::OK, body.to_string()).into_response()
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use timekeep_core::events::EventBus;
    use tower::ServiceExt;

    /// Create a test ADMS server with one registered device.
    fn test_server(sn: &str) -> (AdmsServer, DeviceAdmsState) {
        let event_bus = EventBus::default();
        let server = AdmsServer::new("0.0.0.0:0", event_bus);
        let state = DeviceAdmsState::new(sn);
        (server, state)
    }

    fn test_router(state: SharedAdmsState) -> Router {
        Router::new()
            .route("/iclock/cdata", post(handle_cdata).get(handle_cdata_get))
            .route("/iclock/getrequest", get(handle_getrequest))
            .route("/iclock/devicecmd", post(handle_devicecmd))
            .route("/iclock/registry", get(handle_registry).post(handle_registry))
            .route("/iclock/inspect", get(handle_inspect))
            .with_state(state)
    }

    #[tokio::test]
    async fn test_cdata_get_handshake() {
        let (server, state) = test_server("TEST001");
        server.register("TEST001".into(), state);
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/cdata?SN=TEST001")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_cdata_get_marks_device_online() {
        let (server, state) = test_server("TEST001");
        server.register("TEST001".into(), state.clone());
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let _ = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/cdata?SN=TEST001")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let status = state.status.lock().unwrap();
        assert!(status.is_online);
        assert!(status.last_seen.is_some());
    }

    #[tokio::test]
    async fn test_cdata_post_attlog() {
        let (server, state) = test_server("TEST001");
        let mut rx = server.event_bus.subscribe();
        server.register("TEST001".into(), state);
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let body = "1\t2026-07-11 08:42:15\t1\t15\t0\t0\t";
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/cdata?SN=TEST001&table=ATTLOG")
                    .method("POST")
                    .header("Content-Type", "text/plain")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        // Verify event was published
        let event = rx.recv().await.unwrap();
        assert_eq!(event.event_type(), "punch_received");
    }

    #[tokio::test]
    async fn test_unrecognised_device_returns_404() {
        let event_bus = EventBus::default();
        let shared = SharedAdmsState {
            event_bus: event_bus.clone(),
            devices: Arc::new(std::sync::RwLock::new(HashMap::new())),
        };
        let app = test_router(shared);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/cdata?SN=GHOST&table=ATTLOG")
                    .method("POST")
                    .header("Content-Type", "text/plain")
                    .body(Body::from("1\t2026-01-01 00:00:00\t1\t1\t0\t0\t"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_getrequest_no_pending_commands() {
        let (server, state) = test_server("TEST001");
        server.register("TEST001".into(), state);
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/getrequest?SN=TEST001")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_inspect_all_devices() {
        let (server, state) = test_server("TEST001");
        server.register("TEST001".into(), state);
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/inspect")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_inspect_specific_device() {
        let (server, state) = test_server("TEST001");
        server.register("TEST001".into(), state);
        let shared = SharedAdmsState {
            event_bus: server.event_bus.clone(),
            devices: server.devices.clone(),
        };
        let app = test_router(shared);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/iclock/inspect?SN=TEST001")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
