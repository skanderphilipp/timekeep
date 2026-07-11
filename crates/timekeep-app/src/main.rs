//! # timekeep
//!
//! Device Data Collection & Attendance Management.
//!
//! Single binary that wires together:
//! - Device providers loaded from database (not hardcoded)
//! - Storage backend (SQLite by default)
//! - Distributors (webhook, Odoo)
//! - REST API (management + integration)
//! - Dashboard SPA (embedded at compile time via rust-embed)
//! - Processing engine (normalize → dedup → enrich → store → distribute)

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use timekeep::sync::sync_users_to_storage;
use timekeep_circuit::CircuitBreaker;
use timekeep_core::{
    BiometricDevice,
    events::{DomainEvent, EventBus},
    traits::{Distributor, Storage},
};
use timekeep_engine::Engine;
use timekeep_engine::distribution::DistributorHandle;
use timekeep_engine::health::EngineHealth;
use timekeep_zkteco::adms::AdmsServer;
use tokio::sync::Mutex;

/// Shared registry of connected devices, keyed by serial number.
///
/// Used by the API event handler to route user set/delete/command
/// requests to the correct device instance.
type DeviceRegistry = Arc<Mutex<HashMap<String, timekeep_zkteco::ZkTecoDevice>>>;

// ─── Dashboard (embedded at compile time) ───────────────────────────

/// The compiled dashboard SPA assets, embedded via `rust-embed`.
///
/// During `cargo build`, the `dashboard/dist/` directory is
/// included in the binary. At runtime, index.html and all JS/CSS
/// chunks are served from memory — no external web server needed.
#[derive(RustEmbed)]
#[folder = "../../dashboard/dist/"]
struct DashboardAssets;

/// Serve a static file from the embedded dashboard, or fall back to
/// `index.html` for SPA client-side routing.
async fn serve_dashboard(uri: Uri) -> impl IntoResponse {
    let path_raw = uri.path().trim_start_matches('/');
    let path = if path_raw.is_empty() { "index.html" } else { path_raw };

    match DashboardAssets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data))
                .unwrap()
        },
        None => {
            // SPA fallback: serve index.html for any unmatched route
            match DashboardAssets::get("index.html") {
                Some(content) => Response::builder()
                    .header(header::CONTENT_TYPE, "text/html")
                    .body(Body::from(content.data))
                    .unwrap(),
                None => {
                    tracing::warn!(path = %path, "dashboard asset not found");
                    StatusCode::NOT_FOUND.into_response()
                },
            }
        },
    }
}

/// Validate critical environment configuration at startup.
///
/// Logs warnings for insecure defaults or missing credentials
/// so operators can catch misconfiguration before it reaches
/// production.
fn validate_config() {
    // ── JWT secret ──────────────────────────────────────────────
    let jwt = std::env::var("TIMEKEEP_JWT_SECRET").unwrap_or_default();
    if jwt.is_empty() || jwt == "change-me-in-production" {
        tracing::warn!("TIMEKEEP_JWT_SECRET is not set or using default — auth is insecure!");
    }

    // ── Admin credentials ───────────────────────────────────────
    let admin_user = std::env::var("TIMEKEEP_ADMIN_USER").unwrap_or_default();
    let admin_pass = std::env::var("TIMEKEEP_ADMIN_PASSWORD").unwrap_or_default();
    if admin_user.is_empty() || admin_pass.is_empty() {
        tracing::warn!("Admin credentials not configured — login will not work");
    }

    // ── Database backend ────────────────────────────────────────
    let backend = std::env::var("TIMEKEEP_DB_BACKEND").unwrap_or_else(|_| "sqlite".into());
    match backend.as_str() {
        "sqlite" => {
            let path = std::env::var("TIMEKEEP_DB_PATH").unwrap_or_else(|_| "timekeep.db".into());
            tracing::info!(%path, backend = "sqlite", "storage configuration valid");
        },
        "postgres" => {
            let url = std::env::var("DATABASE_URL").unwrap_or_default();
            if url.is_empty() {
                tracing::warn!("DATABASE_URL not set but TIMEKEEP_DB_BACKEND=postgres");
            }
            tracing::info!(backend = "postgres", "storage configuration valid");
        },
        other => {
            tracing::warn!(%other, "unknown TIMEKEEP_DB_BACKEND — falling back to sqlite");
        },
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // OpenTelemetry must be initialised **before** the subscriber so the
    // OTLP layer can be composed into the registry.
    timekeep_engine::telemetry::init_telemetry();

    // Validate production config early — warn about insecure defaults
    // before any device connections or API listeners are opened.
    validate_config();

    tracing::info!("timekeep v{} starting", env!("CARGO_PKG_VERSION"));

    // ─── Storage ────────────────────────────────────────────────────
    let db_backend = std::env::var("TIMEKEEP_DB_BACKEND").unwrap_or_else(|_| "sqlite".to_string());

    let storage: Arc<dyn Storage>;
    let employees: Option<Arc<dyn timekeep_core::EmployeeRepository>>;

    match db_backend.as_str() {
        "postgres" => {
            let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://timekeep:password@localhost:5432/timekeep".to_string()
            });
            tracing::info!("using PostgreSQL storage backend");
            let pg: Arc<dyn Storage> =
                Arc::new(timekeep_storage_postgres::PostgresStorage::new(&db_url).await?);
            storage = pg;
            /*
             * TODO(ENTERPRISE): Implement EmployeeRepository for PostgresStorage
             *
             * Phase: Production (before tenant onboarding)
             * Impact: Employee CRUD and enrollment unavailable with PostgreSQL backend.
             * Fix: impl EmployeeRepository for PostgresStorage in timekeep-storage-postgres.
             */
            employees = None;
        },
        _ => {
            let db_path =
                std::env::var("TIMEKEEP_DB_PATH").unwrap_or_else(|_| "attendance.db".to_string());
            tracing::info!(path = %db_path, "using SQLite storage backend (WAL mode)");
            let sqlite = Arc::new(timekeep_storage_sqlite::SqliteStorage::new(&db_path).await?);
            storage = sqlite.clone() as Arc<dyn Storage>;
            employees = Some(sqlite as Arc<dyn timekeep_core::EmployeeRepository>);
        },
    };

    // ─── Distributors — loaded from integration endpoints in database ─
    //
    // Each distributor gets a circuit breaker (5 failures → open, 30s cooldown)
    // to prevent retry storms when downstream systems are down.
    let config_endpoints = storage.list_endpoints().await.unwrap_or_default();
    let mut distributor_handles: Vec<DistributorHandle> = Vec::new();

    for ep in &config_endpoints {
        if !ep.enabled {
            tracing::debug!(name = %ep.name, kind = %ep.kind, "endpoint disabled, skipping");
            continue;
        }

        let dist: Arc<dyn Distributor> = match ep.kind {
            timekeep_core::IntegrationKind::Webhook => {
                let url = ep.config["url"].as_str().unwrap_or_default();
                let secret = ep.config["secret"].as_str();
                let mut dist = timekeep_dist_webhook::WebhookDistributor::new(url);
                if let Some(s) = secret
                    && !s.is_empty()
                {
                    dist = dist.with_secret(s);
                }
                tracing::info!(name = %ep.name, url = %url, "webhook distributor loaded");
                Arc::new(dist)
            },
            timekeep_core::IntegrationKind::Odoo => {
                let url = ep.config["url"].as_str().unwrap_or_default();
                let api_key = ep.config["api_key"].as_str().unwrap_or_default();
                let database = ep.config["database"].as_str().unwrap_or_default();
                if url.is_empty() || api_key.is_empty() || database.is_empty() {
                    tracing::warn!(name = %ep.name, "odoo endpoint has empty config, skipping");
                    continue;
                }
                tracing::info!(name = %ep.name, url = %url, database = %database, "odoo distributor loaded");
                Arc::new(timekeep_dist_odoo::OdooDistributor::new(
                    url, api_key, database, "barcode",
                ))
            },
            _ => {
                tracing::debug!(name = %ep.name, kind = %ep.kind, "integration kind not yet implemented");
                continue;
            },
        };

        // Wrap with circuit breaker
        let cb = Arc::new(
            CircuitBreaker::builder()
                .failure_threshold(5)
                .recovery_timeout(std::time::Duration::from_secs(30))
                .build(),
        );
        let handle = DistributorHandle::with_circuit_breaker(dist, cb);
        distributor_handles.push(handle);
    }

    if distributor_handles.is_empty() {
        tracing::warn!(
            "no enabled integration endpoints — punches will be stored but not forwarded"
        );
    } else {
        tracing::info!(
            count = distributor_handles.len(),
            "distributors loaded from database (with circuit breakers)"
        );
    }

    // ─── Event Bus ──────────────────────────────────────────────────
    let event_bus = EventBus::default();

    // ─── Health Tracker (shared between engine and API) ────────────
    let engine_health = EngineHealth::new();

    // ─── Engine (pipeline + storage + distributors with circuit breakers) ─
    let engine = Engine::new(vec![storage.clone()], distributor_handles, engine_health.clone());

    // ─── ADMS Server (shared — handles all devices on one port) ─────
    //
    // The ADMS protocol is HTTP-based push from ZKTeco scanners.
    // One AdmsServer on :8085 routes events to the correct device
    // by parsing the SN query parameter in each scanner POST.
    // Per-device state (command queue, status) is registered after
    // each device connects below.
    let mut adms_server = AdmsServer::new("0.0.0.0:8085", event_bus.clone());
    tracing::info!("ADMS server created — will start after device registration");

    // ─── Device Connection State (for API transparency) ───────────
    let device_state = timekeep_api::DeviceConnectionState::default();

    // ─── Provider Registry (multi-vendor support) ──────────────────
    let mut provider_registry = timekeep_core::ProviderRegistry::new();
    // Register ZKTeco as the default (and currently only) provider
    provider_registry.register(Arc::new(timekeep_zkteco::ZkTecoProvider::new()));
    let provider_registry = Arc::new(provider_registry);

    // ─── Device Providers — loaded from database ────────────────────
    let device_configs = storage.list_device_configs().await?;

    if device_configs.is_empty() {
        tracing::warn!(
            "no devices configured — add scanners via:\n  \
             curl -X POST http://localhost:3000/api/devices \\\n  \
             -H 'Content-Type: application/json' \\\n  \
             -d '{{\"serial_number\":\"CQZ7232960836\",\"label\":\"OFFICE Scanner\",\"host\":\"88.201.39.242\",\"port\":4370}}'"
        );
    }

    let device_registry: DeviceRegistry = Arc::new(Mutex::new(HashMap::new()));

    for config in &device_configs {
        tracing::info!(
            label = %config.label,
            serial = %config.serial_number,
            host = %config.host,
            port = config.port,
            "connecting to device from storage"
        );

        let mut device = timekeep_zkteco::ZkTecoDevice::new(config.clone(), event_bus.clone());

        match device.connect().await {
            Ok(()) => {
                tracing::info!(
                    label = %config.label,
                    "device connected (ADMS push + SDK poller)"
                );

                // Register per-device ADMS state with the shared server.
                // This lets the ADMS HTTP handler route scanner POSTs
                // to the correct device by serial number.
                if let Some(adms_state) = device.take_adms_state() {
                    adms_server.register(config.serial_number.clone(), adms_state);
                    tracing::debug!(
                        serial = %config.serial_number,
                        "ADMS state registered with shared server"
                    );
                }

                // Sync users from the already-connected device into local storage.
                // Uses the same device instance — no second connection needed.
                // This populates the table used by the enrichment pipeline
                // to resolve PINs → employee names.
                if let Err(e) = sync_users_to_storage(&device, storage.as_ref()).await {
                    tracing::warn!(
                        label = %config.label,
                        error = %e,
                        "failed to sync users from device"
                    );
                }

                device_registry.lock().await.insert(config.serial_number.clone(), device);
                let now = jiff::Timestamp::now().as_second();
                device_state.set_adms_connected(&config.serial_number, now).await;
            },
            Err(e) => {
                tracing::error!(
                    label = %config.label,
                    error = %e,
                    "failed to connect to device — it will be retried on next poll"
                );
            },
        }
    }

    let connected_count = device_registry.lock().await.len();
    tracing::info!(
        connected = connected_count,
        total = device_configs.len(),
        "device providers initialized"
    );

    // ─── Start ADMS Server ────────────────────────────────────────
    //
    // Must be started AFTER device registration so the server knows
    // which serial numbers to accept. The scanner POSTs arrive on
    // :8085/iclock/cdata?SN=... and the handler routes to the correct
    // device by serial number.
    adms_server.start().await?;
    tracing::info!("ADMS server listening on 0.0.0.0:8085");

    // ─── SDK Poll Loop ────────────────────────────────────────────
    //
    // Runs in parallel with ADMS push (real-time events).
    // Periodically calls get_attendance(since) on each device
    // to pull bulk records. The dedup pipeline handles duplicates
    // from the two paths.
    //
    // TODO(ENTERPRISE): Convert to concurrent JoinSet polling
    //
    // Phase: Production scale-up (before multi-tenant deployment)
    // Impact: Sequential polling means 100 devices take ~200s per cycle
    //         instead of ~2s. Acceptable for <10 devices.
    // Fix: Refactor DeviceRegistry to Arc<Mutex<HashMap<String, Arc<Mutex<ZkTecoDevice>>>>>
    //       so spawned tasks can hold independent device references.
    //       Then replace the for-loop with tokio::task::JoinSet.
    let poll_interval =
        storage.get_system_settings().await.map(|s| s.poll_interval_secs).unwrap_or(60);

    tracing::info!(poll_interval_secs = poll_interval, "SDK poll loop configured");

    let poll_registry = device_registry.clone();
    let poll_storage = storage.clone();
    let poll_bus = event_bus.clone();
    let poll_device_state = device_state.clone();
    let _poll_handle = tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(poll_interval.clamp(5, 3600) as u64);
        let mut tick = tokio::time::interval(interval);
        // Skip first tick — let ADMS push establish connections
        tick.tick().await;

        loop {
            tick.tick().await;
            let guard = poll_registry.lock().await;
            for (sn, device) in guard.iter() {
                let since = match poll_storage.latest_punch_for_device(sn).await {
                    Ok(Some(ts)) => Some(ts),
                    Ok(None) => None,
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "poll: failed to get last punch");
                        continue;
                    },
                };

                match device.get_attendance(since).await {
                    Ok(punches) if !punches.is_empty() => {
                        let now = jiff::Timestamp::now().as_second();
                        poll_device_state.set_sdk_polled(sn, now).await;
                        tracing::info!(
                            device = %sn,
                            count = punches.len(),
                            "SDK poll: retrieved records"
                        );
                        for punch in punches {
                            poll_bus.publish(DomainEvent::PunchReceived { punch });
                        }
                    },
                    Ok(_) => {
                        let now = jiff::Timestamp::now().as_second();
                        poll_device_state.set_sdk_polled(sn, now).await;
                    },
                    Err(e) => {
                        tracing::warn!(device = %sn, error = %e, "SDK poll: device unreachable");
                    },
                }
            }
        }
    });

    // ─── API Servers ────────────────────────────────────────────────
    let management_router = timekeep_api::management_router(
        event_bus.clone(),
        storage.clone(),
        employees.clone(),
        device_state.clone(),
        provider_registry.clone(),
        engine_health.clone(),
    )
    .fallback(serve_dashboard);
    let integration_router = timekeep_api::integration_router(
        event_bus.clone(),
        storage.clone(),
        employees.clone(),
        device_state.clone(),
        provider_registry.clone(),
        engine_health.clone(),
    );

    let mgmt_port: u16 = std::env::var("TIMEKEEP_API_PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);
    let mgmt_listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{mgmt_port}")).await?;
    tracing::info!("Management API  http://0.0.0.0:{mgmt_port}");
    let mgmt_handle = tokio::spawn(async move {
        axum::serve(mgmt_listener, management_router).await.unwrap();
    });

    let int_port: u16 = std::env::var("TIMEKEEP_INTEGRATION_PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .unwrap_or(3001);
    let int_listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{int_port}")).await?;
    tracing::info!("Integration API  http://0.0.0.0:{int_port}");
    let int_handle = tokio::spawn(async move {
        axum::serve(int_listener, integration_router).await.unwrap();
    });

    // ─── Run ────────────────────────────────────────────────────────
    tracing::info!("ADMS endpoint: http://0.0.0.0:8085/iclock/");
    tracing::info!("Engine running — processing attendance events");

    // ─── API Event Handler (wired to device registry) ───────────────
    let mut user_event_rx = event_bus.subscribe();
    let registry = device_registry.clone();
    let _user_event_handle = tokio::spawn(async move {
        while let Ok(event) = user_event_rx.recv().await {
            match event.as_ref() {
                DomainEvent::UserSetRequested { device_sn, user } => {
                    tracing::info!(
                        device = %device_sn,
                        pin = %user.pin,
                        name = %user.name,
                        "user set requested via API — routing to device"
                    );
                    let mut guard = registry.lock().await;
                    if let Some(device) = guard.get_mut(device_sn.as_str()) {
                        match device.set_user(user).await {
                            Ok(()) => tracing::info!(
                                device = %device_sn,
                                pin = %user.pin,
                                "user set on device successfully"
                            ),
                            Err(e) => tracing::error!(
                                device = %device_sn,
                                pin = %user.pin,
                                error = %e,
                                "failed to set user on device"
                            ),
                        }
                    } else {
                        tracing::warn!(
                            device = %device_sn,
                            "user set requested but device not found in registry"
                        );
                    }
                },
                DomainEvent::UserDeleteRequested { device_sn, user_sn } => {
                    tracing::info!(
                        device = %device_sn,
                        user_sn,
                        "user delete requested via API — routing to device"
                    );
                    let mut guard = registry.lock().await;
                    if let Some(device) = guard.get_mut(device_sn.as_str()) {
                        match device.delete_user(*user_sn).await {
                            Ok(()) => tracing::info!(
                                device = %device_sn,
                                user_sn,
                                "user deleted from device successfully"
                            ),
                            Err(e) => tracing::error!(
                                device = %device_sn,
                                user_sn,
                                error = %e,
                                "failed to delete user from device"
                            ),
                        }
                    } else {
                        tracing::warn!(
                            device = %device_sn,
                            "user delete requested but device not found in registry"
                        );
                    }
                },
                DomainEvent::DeviceCommandEnqueueRequested { device_sn, command } => {
                    tracing::info!(
                        device = %device_sn,
                        command,
                        "command enqueue requested via API — routing to ADMS queue"
                    );
                    let guard = registry.lock().await;
                    if let Some(device) = guard.get(device_sn.as_str()) {
                        if let Some(queue) = device.adms_command_queue() {
                            match queue.lock().unwrap().enqueue(device_sn, command) {
                                Ok(cmd_id) => tracing::info!(
                                    device = %device_sn,
                                    command_id = cmd_id,
                                    command,
                                    "command enqueued in ADMS queue"
                                ),
                                Err(e) => tracing::error!(
                                    device = %device_sn,
                                    command,
                                    error = %e,
                                    "failed to enqueue command"
                                ),
                            }
                        } else {
                            tracing::warn!(
                                device = %device_sn,
                                "command enqueue requested but device has no ADMS server"
                            );
                        }
                    } else {
                        tracing::warn!(
                            device = %device_sn,
                            "command enqueue requested but device not found in registry"
                        );
                    }
                },
                _ => {},
            }
        }
    });

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("Shutdown signal received");
        }
        _ = engine.run() => {}
    }

    // ─── Cleanup ────────────────────────────────────────────────────
    _poll_handle.abort();
    for (_, mut device) in device_registry.lock().await.drain() {
        let _ = device.disconnect().await;
    }
    mgmt_handle.abort();
    int_handle.abort();

    tracing::info!("timekeep stopped");
    Ok(())
}
