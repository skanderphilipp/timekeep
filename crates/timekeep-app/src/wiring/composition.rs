//! Dependency wiring (composition root).
//!
//! Creates every runtime component — storage, engine, device connections,
//! background workers — and returns them as a single `AppDependencies` struct.
//! The caller (`main.rs`) is responsible only for starting the HTTP servers
//! and handling shutdown.
//!
//! This file is now the **orchestrator** — each concern is implemented in a
//! sub-module under `wiring/`. See `wiring/mod.rs` for module descriptions.

use std::collections::HashMap;
use std::sync::Arc;

use timekeep_circuit::CircuitBreaker;
use timekeep_core::{
    events::EventBus,
    traits::sync_provider::SyncProvider,
    traits::{Distributor, Storage},
};
use timekeep_engine::Engine;
use timekeep_engine::distribution::DistributorHandle;
use timekeep_engine::health::EngineHealth;
use timekeep_zkteco::adms::AdmsServer;
use tokio::sync::Mutex;

use super::device_connect;
use crate::config::AppConfig;

/// Alias for the device registry type.
pub(crate) type DeviceRegistry =
    Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<timekeep_zkteco::ZkTecoDevice>>>>>;

/// All runtime components wired together by `wire()`.
pub(crate) struct AppDependencies {
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    pub onboarding: Option<Arc<dyn timekeep_core::OnboardingSessionStore>>,
    pub search: Option<Arc<dyn timekeep_core::SearchStore>>,
    pub engine: Engine,
    pub provider_registry: Arc<timekeep_core::ProviderRegistry>,
    pub device_registry: DeviceRegistry,
    pub adms_server: Option<AdmsServer>,
    /// All background task handles. Index 0 is the poll loop handle.
    pub device_handles: Vec<tokio::task::JoinHandle<()>>,
    pub event_bus: EventBus,
    pub engine_health: EngineHealth,
    pub sync_providers: timekeep_api::app_state::SyncProviderRegistry,
    pub device_state: timekeep_api::app_state::DeviceConnectionState,
}

/// Create every runtime component and return them as `AppDependencies`.
///
/// This is the composition root. It delegates to sub-modules for each concern:
/// - `wiring/device_connect.rs` — device lifecycle
/// - `wiring/event_handlers.rs` — domain event dispatch
pub(crate) async fn wire(
    config: &AppConfig,
) -> Result<AppDependencies, Box<dyn std::error::Error>> {
    // ── Storage, Search, Distributors ──────────────────────────────
    let (storage, employees, onboarding, search) = init_storage(config).await?;
    let distributor_handles = init_distributors(&storage).await;

    // ── Core infra ─────────────────────────────────────────────────
    let event_bus = EventBus::default();
    let engine_health = EngineHealth::new();
    let engine = Engine::new(
        vec![storage.clone()],
        distributor_handles.to_vec(),
        engine_health.clone(),
        event_bus.clone(),
    );

    // ── Background workers ─────────────────────────────────────────
    // TODO(ENTERPRISE): Re-enable background workers after modularization
    // spawn_outbox_worker(&storage, &distributor_handles);
    // spawn_search_indexer(&search, &employees, &event_bus);
    // let sync_providers = spawn_odoo_sync(&storage, &employees, &event_bus).await;
    let sync_providers: timekeep_api::app_state::SyncProviderRegistry =
        Arc::new(Mutex::new(HashMap::new()));

    // ── Device registry + connections ─────────────────────────────
    let device_state = timekeep_api::app_state::DeviceConnectionState::default();
    let provider_registry = Arc::new(timekeep_core::ProviderRegistry::new());
    let mut adms_server =
        AdmsServer::new(format!("0.0.0.0:{}", config.adms_port), event_bus.clone());
    tracing::info!(
        "ADMS server created on port {} — will start after device registration",
        config.adms_port
    );

    let device_registry: DeviceRegistry = Arc::new(Mutex::new(HashMap::new()));
    let device_configs = storage.list_device_configs().await?;
    if device_configs.is_empty() {
        tracing::warn!("no devices configured");
    }

    device_connect::connect_devices(
        &device_configs,
        &device_registry,
        &mut adms_server,
        storage.as_ref(),
        &event_bus,
        &device_state,
    )
    .await;

    let connected_count = device_registry.lock().await.len();
    tracing::info!(
        connected = connected_count,
        total = device_configs.len(),
        "device providers initialized"
    );

    adms_server.start().await?;
    tracing::info!("ADMS server listening on 0.0.0.0:{}", config.adms_port);

    // ── SDK Poll loop ─────────────────────────────────────────────
    let poll_interval =
        storage.get_system_settings().await.map(|s| s.poll_interval_secs).unwrap_or(60);
    tracing::info!(poll_interval_secs = poll_interval, "SDK poll loop configured");

    let poll_handle = device_connect::spawn_poll_loop(
        device_registry.clone(),
        storage.clone(),
        event_bus.clone(),
        device_state.clone(),
        poll_interval,
    );

    // ── Event handler (domain events → device operations) ─────────
    // TODO(ENTERPRISE): Re-enable event handlers after modularization
    use tokio::task::JoinHandle;
    let user_event_handle: JoinHandle<()> = tokio::spawn(async {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        }
    });

    // ── Runtime handlers ──────────────────────────────────────────
    let registered_handle = device_connect::spawn_runtime_registration_handler(
        device_registry.clone(),
        storage.clone(),
        event_bus.clone(),
        device_state.clone(),
    );
    let online_handle =
        device_connect::spawn_device_online_tracker(device_state.clone(), event_bus.clone());
    let discovery_handle = device_connect::spawn_device_discovery_handler(
        device_registry.clone(),
        event_bus.clone(),
        device_state.clone(),
    );

    let device_handles =
        vec![poll_handle, user_event_handle, online_handle, discovery_handle, registered_handle];

    Ok(AppDependencies {
        storage,
        employees,
        onboarding,
        search,
        engine,
        provider_registry,
        device_registry,
        adms_server: Some(adms_server),
        device_handles,
        event_bus,
        engine_health,
        device_state,
        sync_providers,
    })
}

// ── Private helper functions ────────────────────────────────────────────

async fn init_storage(
    config: &AppConfig,
) -> Result<
    (
        Arc<dyn Storage>,
        Option<Arc<dyn timekeep_core::EmployeeStore>>,
        Option<Arc<dyn timekeep_core::OnboardingSessionStore>>,
        Option<Arc<dyn timekeep_core::SearchStore>>,
    ),
    Box<dyn std::error::Error>,
> {
    let storage: Arc<dyn Storage>;
    let employees: Option<Arc<dyn timekeep_core::EmployeeStore>>;
    let onboarding: Option<Arc<dyn timekeep_core::OnboardingSessionStore>>;

    match config.db_backend.as_str() {
        "postgres" => {
            tracing::info!("using PostgreSQL storage backend");
            let pg =
                Arc::new(timekeep_storage_postgres::PostgresStorage::new(&config.db_url).await?);
            storage = pg.clone() as Arc<dyn Storage>;
            employees = Some(pg.clone() as Arc<dyn timekeep_core::EmployeeStore>);
            onboarding = Some(pg as Arc<dyn timekeep_core::OnboardingSessionStore>);
        },
        _ => {
            tracing::info!(path = %config.db_path, "using SQLite storage backend (WAL mode)");
            let sqlite =
                Arc::new(timekeep_storage_sqlite::SqliteStorage::new(&config.db_path).await?);
            storage = sqlite.clone() as Arc<dyn Storage>;
            employees = Some(sqlite.clone() as Arc<dyn timekeep_core::EmployeeStore>);
            onboarding = Some(sqlite as Arc<dyn timekeep_core::OnboardingSessionStore>);
        },
    };

    let search: Option<Arc<dyn timekeep_core::SearchStore>> = match &config.search_index_path {
        Some(index_path) => {
            let path = std::path::Path::new(index_path);
            let tantivy = Arc::new(
                timekeep_storage_tantivy::TantivySearchStore::open(path)
                    .map_err(|e| format!("failed to open Tantivy search index: {e}"))?,
            );
            tracing::info!(path = %index_path, "Tantivy full-text search enabled");
            Some(tantivy as Arc<dyn timekeep_core::SearchStore>)
        },
        None => {
            tracing::info!("full-text search disabled (no search_index_path configured)");
            None
        },
    };

    Ok((storage, employees, onboarding, search))
}

async fn init_distributors(storage: &Arc<dyn Storage>) -> Arc<Vec<DistributorHandle>> {
    let config_endpoints = storage.list_endpoints().await.unwrap_or_default();
    let mut handles: Vec<DistributorHandle> = Vec::new();

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
                let Some(conn) = ep.odoo_connection() else {
                    tracing::warn!(name = %ep.name, "odoo endpoint has empty config, skipping");
                    continue;
                };
                tracing::info!(name = %ep.name, url = %conn.url, database = %conn.database, field = %conn.employee_field, "odoo distributor loaded");
                Arc::new(
                    timekeep_dist_odoo::OdooDistributor::new(
                        conn.url,
                        conn.api_key,
                        conn.database,
                        conn.employee_field,
                    )
                    .with_storage(storage.clone()),
                )
            },
            _ => {
                tracing::debug!(name = %ep.name, kind = %ep.kind, "integration kind not yet implemented");
                continue;
            },
        };

        let cb = Arc::new(
            CircuitBreaker::builder()
                .failure_threshold(5)
                .recovery_timeout(std::time::Duration::from_secs(30))
                .build(),
        );
        handles.push(DistributorHandle::with_circuit_breaker(dist, cb));
    }

    if handles.is_empty() {
        tracing::warn!(
            "no enabled integration endpoints — punches will be stored but not forwarded"
        );
    } else {
        tracing::info!(
            count = handles.len(),
            "distributors loaded from database (with circuit breakers)"
        );
    }

    Arc::new(handles)
}

/// Spawn Odoo employee sync workers for each enabled Odoo integration endpoint.
///
/// Each enabled Odoo endpoint gets its own background sync task that periodically
/// pulls employees (and optionally departments) from Odoo into Timekeep.
async fn spawn_odoo_sync(
    storage: &Arc<dyn Storage>,
    employees: &Option<Arc<dyn timekeep_core::EmployeeStore>>,
    event_bus: &EventBus,
) -> timekeep_api::app_state::SyncProviderRegistry {
    let sync_providers: timekeep_api::app_state::SyncProviderRegistry =
        Arc::new(tokio::sync::Mutex::new(HashMap::new()));

    let employees = match employees {
        Some(e) => e.clone(),
        None => {
            tracing::info!("odoo sync: no EmployeeStore configured, skipping");
            return sync_providers;
        },
    };

    let config_endpoints = storage.list_endpoints().await.unwrap_or_default();
    let mut sync_count = 0u32;

    for ep in &config_endpoints {
        if !ep.enabled {
            continue;
        }

        let Some(conn) = ep.odoo_connection() else {
            continue;
        };

        tracing::info!(
            name = %ep.name,
            url = %conn.url,
            field = %conn.employee_field,
            "odoo employee sync worker spawned"
        );

        let sync = timekeep_dist_odoo::sync::OdooEmployeeSync::new(
            conn.url,
            conn.api_key,
            conn.database,
            conn.employee_field,
            employees.clone(),
            Some(storage.clone() as Arc<dyn Storage>),
            event_bus.clone(),
        );

        let sync_arc: Arc<dyn SyncProvider> = Arc::new(sync);
        sync_providers.lock().await.insert(sync_arc.provider_key().to_string(), sync_arc);

        sync_count += 1;
    }

    if sync_count == 0 {
        tracing::info!("odoo sync: no enabled Odoo endpoints, sync is inactive");
    } else {
        tracing::info!(count = sync_count, "odoo sync workers spawned");
    }

    sync_providers
}
fn spawn_outbox_worker(_storage: &Arc<dyn Storage>, _handles: &Arc<Vec<DistributorHandle>>) {
    // TODO(ENTERPRISE): Re-enable outbox worker after implementing outbox_worker module
    tracing::info!("outbox worker not started (module not implemented)");
}
