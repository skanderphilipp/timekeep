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

mod config;
mod wiring;


use axum::{
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use clap::Parser;
use rust_embed::RustEmbed;
use timekeep_core::BiometricDevice;

/// Shared registry of connected devices, keyed by serial number.
///
/// Each device is wrapped in `Arc<Mutex<>>` so spawned tasks can
/// hold independent references without contending on the registry lock.
/// Used by the API event handler to route user set/delete/command
/// requests to the correct device instance.
pub(crate) use wiring::DeviceRegistry;

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

/// CLI arguments for the timekeep server binary.
///
/// All flags are optional; when omitted, environment variables
/// or sensible defaults are used instead.
#[derive(Parser)]
#[command(name = "timekeep", about = "Device Data Collection & Attendance Management")]
struct Args {
    /// SQLite database path (e.g., `dev.db` or `sqlite://dev.db`).
    ///
    /// The `sqlite://` prefix is stripped automatically so both forms work.
    /// Overrides `TIMEKEEP_DB_PATH` env var. Ignored for Postgres backends.
    #[arg(long, value_name = "PATH")]
    db: Option<String>,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    // OpenTelemetry must be initialised **before** the subscriber so the
    // OTLP layer can be composed into the registry.
    timekeep_engine::telemetry::init_telemetry();

    if let Err(e) = try_main(args).await {
        // Print the full error chain for operators
        tracing::error!(error = %e, "timekeep failed to start");
        eprint!("Fatal: {e}");
        let mut source: Option<&dyn std::error::Error> = e.source();
        while let Some(s) = source {
            eprint!("\n  caused by: {s}");
            source = s.source();
        }
        eprintln!();
        std::process::exit(1);
    }
}

async fn try_main(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    // Normalise the --db value: strip sqlite:// or sqlite: prefix so the
    // config layer gets a plain path (SqliteStorage::new does its own stripping).
    let db_path_override = args.db.map(|raw| {
        raw.strip_prefix("sqlite://")
            .or_else(|| raw.strip_prefix("sqlite:"))
            .unwrap_or(&raw)
            .to_string()
    });

    let config = config::load(config::CliOverrides { db_path: db_path_override });
    let deps = wiring::wire(&config).await?;
    start_server(deps, &config).await
}

/// Start the HTTP servers, run the engine, and handle graceful shutdown.
///
/// Destructures `AppDependencies` to extract the engine (which is consumed
/// by `engine.run()`), creates management and integration routers, binds
/// to configured ports, and waits for either Ctrl+C or engine completion.
async fn start_server(
    deps: wiring::AppDependencies,
    config: &config::AppConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    let wiring::AppDependencies {
        storage,
        employees,
        onboarding,
        search,
        engine,
        provider_registry,
        device_registry,
        adms_server: _adms_server,
        device_handles,
        event_bus,
        engine_health,
        device_state,
        sync_providers,
    } = deps;

    // ─── API Servers ────────────────────────────────────────────────
    let management_router = timekeep_api::management_router(timekeep_api::RouterConfig {
        event_bus: event_bus.clone(),
        storage: storage.clone(),
        employees: employees.clone(),
        onboarding: onboarding.clone(),
        search: search.clone(),
        device_state: device_state.clone(),
        provider_registry: provider_registry.clone(),
        engine_health: engine_health.clone(),
        sync_providers: sync_providers.clone(),
    })
    .fallback(serve_dashboard);
    let integration_router = timekeep_api::integration_router(timekeep_api::RouterConfig {
        event_bus: event_bus.clone(),
        storage: storage.clone(),
        employees: employees.clone(),
        onboarding: onboarding.clone(),
        search: search.clone(),
        device_state: device_state.clone(),
        provider_registry: provider_registry.clone(),
        engine_health: engine_health.clone(),
        sync_providers: sync_providers.clone(),
    });

    let mgmt_listener =
        tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.management_port)).await?;
    tracing::info!("Management API  http://0.0.0.0:{}", config.management_port);
    let mgmt_handle = tokio::spawn(async move {
        axum::serve(mgmt_listener, management_router).await.unwrap();
    });

    let int_listener =
        tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.integration_port)).await?;
    tracing::info!("Integration API  http://0.0.0.0:{}", config.integration_port);
    let int_handle = tokio::spawn(async move {
        axum::serve(int_listener, integration_router).await.unwrap();
    });

    // ─── Run ────────────────────────────────────────────────────────
    tracing::info!("ADMS endpoint: http://0.0.0.0:{}/iclock/", config.adms_port);
    tracing::info!("Engine running — processing attendance events");

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("Shutdown signal received");
        }
        _ = engine.run() => {}
    }

    // ─── Cleanup ────────────────────────────────────────────────────
    // Abort the poll loop (index 0 in device_handles)
    if let Some(poll_handle) = device_handles.first() {
        poll_handle.abort();
    }
    for (_, device_arc) in device_registry.lock().await.drain() {
        let mut device = device_arc.lock().await;
        let _ = device.disconnect().await;
    }
    mgmt_handle.abort();
    int_handle.abort();

    tracing::info!("timekeep stopped");
    Ok(())
}
