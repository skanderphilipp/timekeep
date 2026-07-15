//! # timekeep-engine
//!
//! The event-driven processing core. Receives domain events from the
//! provider layer, routes them through a pipeline (validate → deduplicate →
//! normalize → enrich), then fans them out to storage and distribution handlers.
//!
//! ## Pipeline Flow
//!
//! ```text
//! Event Bus → PunchReceived?
//!   ├── normalize (trim PIN, adjust timezone)
//!   ├── dedup (check in-memory cache + storage)
//!   ├── enrich (HR metadata)
//!   ├── storage (persist to SQLite/PostgreSQL)
//!   └── distribute (fire-and-forget → webhook, Odoo with circuit breakers)
//! ```

pub mod batch;
pub mod bus;
pub mod distribution;
pub mod handlers;
pub mod health;
pub mod pipeline;
pub mod telemetry;

use std::sync::Arc;

use batch::BatchWriter;
use distribution::{DistributorHandle, DistributorSnapshot, Outbox};
use pipeline::dedup::DedupCache;
use timekeep_core::{
    Error,
    events::{DomainEvent, EventBus},
    traits::{Distributor, Storage},
};
use tokio::sync::Mutex;
use tokio::sync::broadcast;
use tracing::{Span, info};

/// The central processing engine.
///
/// Created once at startup, it wires together:
/// - An event bus
/// - Zero or more storage backends
/// - Zero or more distributors (each with optional circuit breaker + outbox)
/// - A deduplication cache (in-memory LRU backed by storage)
/// - A processing pipeline (normalize → dedup → enrich → store → distribute)
pub struct Engine {
    pub event_bus: EventBus,
    storages: Vec<Arc<dyn Storage>>,
    distributors: Vec<DistributorHandle>,
    /// Batch writer for efficient bulk storage (replaces single-punch INSERTs)
    batch_writer: Option<BatchWriter>,
    /// Deduplication cache shared across all event processing.
    dedup_cache: Arc<Mutex<DedupCache>>,
    /// Outbox sender for queuing failed deliveries.
    /// Kept alive so the outbox channel stays open.
    #[allow(dead_code)]
    outbox_tx: Option<tokio::sync::mpsc::UnboundedSender<distribution::OutboxEntry>>,
    /// Outbox worker handle for graceful shutdown.
    outbox_handle: Option<tokio::task::JoinHandle<()>>,
    /// Shared health tracker for the API health endpoint.
    pub health: health::EngineHealth,
}

impl Engine {
    /// Create a new engine with the given storages and distributor handles.
    ///
    /// The first storage backend is used as the primary dedup authority
    /// and for enrichment lookups (PIN → employee name from local user table).
    /// If no storage is provided, a warning is logged and dedup operates
    /// in cache-only mode.
    ///
    /// Each `DistributorHandle` may include a circuit breaker and/or outbox
    /// configuration. Events are distributed via fire-and-forget `tokio::spawn`
    /// so slow downstream systems never block the pipeline.
    ///
    /// `health` is a shared tracker for the API health endpoint.
    /// Pass `EngineHealth::default()` if you don't need health tracking.
    pub fn new(
        storages: Vec<Arc<dyn Storage>>,
        distributors: Vec<DistributorHandle>,
        health: health::EngineHealth,
        event_bus: EventBus,
    ) -> Self {
        // Use the first storage backend for dedup lookups (cache-miss fallback).
        // If no storage is configured, use a placeholder that never finds dups.
        let dedup_storage: Arc<dyn Storage> = storages.first().cloned().unwrap_or_else(|| {
            tracing::warn!("no storage configured; dedup running in cache-only mode");
            Arc::new(NoopStorage)
        });

        // 200 entries = ~2x daily punch volume for a typical deployment (27/day × 3 scanners × 2x)
        let dedup_cache = DedupCache::new(dedup_storage.clone(), 200);

        // Batch writer: accumulate up to 500 punches or flush every 1 second.
        let batch_writer = if !storages.is_empty() {
            Some(BatchWriter::new(storages[0].clone(), 500, 1000))
        } else {
            None
        };

        // Outbox for failed deliveries (background retry with exponential backoff)
        let (outbox_tx, outbox_handle) = if distributors.iter().any(|d| d.has_outbox()) {
            let (outbox, sender) = Outbox::new(5, storages.first().cloned());
            // The outbox worker needs handles to retry distribution.
            // We clone the handles now — the actual distributors inside
            // them are Arc'd so this is cheap.
            let handles_for_outbox = distributors.clone();
            let handle = tokio::spawn(outbox.run(handles_for_outbox));
            (Some(sender), Some(handle))
        } else {
            (None, None)
        };

        Self {
            event_bus,
            storages,
            distributors,
            batch_writer,
            dedup_cache: Arc::new(Mutex::new(dedup_cache)),
            outbox_tx,
            outbox_handle,
            health,
        }
    }

    /// Create a new engine from raw distributors (backward compat — no circuit breakers).
    ///
    /// Each distributor is wrapped in a plain `DistributorHandle` without
    /// circuit breaker or outbox. For production use, prefer
    /// `Engine::new()` with pre-built `DistributorHandle` values.
    pub fn with_raw_distributors(
        storages: Vec<Arc<dyn Storage>>,
        raw_distributors: Vec<Arc<dyn Distributor>>,
        event_bus: EventBus,
    ) -> Self {
        let handles: Vec<DistributorHandle> =
            raw_distributors.into_iter().map(DistributorHandle::new).collect();
        Self::new(storages, handles, health::EngineHealth::default(), event_bus)
    }

    /// Get distribution stats for health reporting.
    pub fn distribution_stats(&self) -> Vec<(String, DistributorSnapshot)> {
        self.distributors
            .iter()
            .map(|h| (h.distributor.name().to_string(), h.stats().snapshot()))
            .collect()
    }

    /// Aggregate distribution counters into the health tracker.
    /// Called periodically or on health endpoint read.
    pub fn refresh_health(&self) {
        let mut distributed = 0u64;
        let mut failed = 0u64;
        for h in &self.distributors {
            let snap = h.stats().snapshot();
            distributed += snap.delivered;
            failed += snap.dead + snap.queued;
        }
        // Note: these are absolute counters, not deltas.
        // The EngineHealth counters accumulate over the process lifetime.
        self.health.inc_distributed_by(distributed);
        self.health.inc_failed_by(failed);
    }

    /// Start the engine: subscribe to events and forward them
    /// through the pipeline to all registered handlers.
    pub async fn run(&self) -> Result<(), Error> {
        let device_count = 0; // populated by providers
        self.event_bus.publish(DomainEvent::EngineStarted { device_count });

        let mut rx = self.event_bus.subscribe();

        loop {
            match rx.recv().await {
                Ok(event) => {
                    self.handle_event(&event).await;
                },
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!(skipped = n, "event bus lagged, some events dropped");
                },
                Err(broadcast::error::RecvError::Closed) => {
                    info!("event bus closed, engine stopping");
                    break;
                },
            }
        }

        self.event_bus.publish(DomainEvent::EngineStopping);
        Ok(())
    }

    /// Process a single domain event through the pipeline.
    async fn handle_event(&self, event: &DomainEvent) {
        match event {
            DomainEvent::PunchReceived { punch } => {
                let span = telemetry::punch_span(&punch.device_sn, &punch.user_pin);
                let _guard = span.enter();

                telemetry::record_punch_received();
                self.health.inc_processed();

                let mut punch = punch.clone();

                // Stage 1: Normalize (clean PIN, adjust timezone)
                {
                    let _stage = telemetry::stage_span("normalize");
                    let _g = _stage.enter();
                    pipeline::normalize::normalize_punch(&mut punch, None);
                }

                // Stage 2: Deduplicate (check cache + storage)
                {
                    let _stage = telemetry::stage_span("dedup");
                    let _g = _stage.enter();
                    let mut cache = self.dedup_cache.lock().await;
                    if cache.is_duplicate(&punch).await {
                        Span::current().record("cache_hit", true);
                        telemetry::record_punch_deduplicated();
                        self.health.inc_dropped();
                        tracing::debug!(
                            user_pin = %punch.user_pin,
                            timestamp = punch.timestamp.as_second(),
                            "dedup: punch filtered (duplicate)"
                        );
                        return;
                    }
                }

                // Stage 3: Enrich (resolve PIN → name from local user table)
                {
                    let _stage = telemetry::stage_span("enrich");
                    let _g = _stage.enter();
                    let primary_storage = self.storages.first();
                    pipeline::enrich::enrich_punch(&mut punch, primary_storage).await;
                }

                // Stage 4: Persist via batch writer (efficient bulk INSERTs)
                {
                    let _stage = telemetry::stage_span("store");
                    let _g = _stage.enter();
                    if let Some(writer) = &self.batch_writer {
                        writer.enqueue(punch.clone());
                        tracing::debug!(
                            user_pin = %punch.user_pin,
                            timestamp = punch.timestamp.as_second(),
                            "punch queued for batch write",
                        );
                    } else {
                        // Fallback: direct storage write (no batch writer configured)
                        for storage in &self.storages {
                            if let Err(e) = storage.store_punch(&punch).await {
                                self.health.inc_failed();
                                tracing::error!(
                                    user_pin = %punch.user_pin,
                                    error = %e,
                                    "storage failed — punch may be lost",
                                );
                            }
                        }
                    }
                }

                // Stage 5: Distribute (fire-and-forget — never blocks the pipeline)
                {
                    let _stage = telemetry::stage_span("distribute");
                    let _g = _stage.enter();
                    let event = DomainEvent::PunchReceived { punch };
                    for handle in &self.distributors {
                        let name = handle.distributor.name().to_string();
                        handle.distribute(event.clone(), name);
                    }
                    telemetry::record_punch_distributed("multi");
                }
            },
            _other => {
                // Persist ADMS-pushed user lists to local device-user store
                if let DomainEvent::DeviceUsersReceived { device_sn, users } = event {
                    let count = users.len();
                    for storage in &self.storages {
                        for user in users {
                            if let Err(e) = storage
                                .upsert_user(
                                    device_sn,
                                    &user.pin,
                                    &user.name,
                                    Some(user.privilege as i32),
                                    user.card_number.as_deref(),
                                    user.group.map(|g| g as i32),
                                    user.timezone.map(|t| t as i32),
                                    user.password_raw.as_deref(),
                                )
                                .await
                            {
                                tracing::warn!(
                                    device = %device_sn,
                                    pin = %user.pin,
                                    error = %e,
                                    "failed to persist ADMS user"
                                );
                            }
                        }
                    }
                    tracing::info!(
                        device = %device_sn,
                        count = count,
                        "persisted ADMS-pushed user list"
                    );
                }

                // Auto-register devices discovered via ADMS push
                if let DomainEvent::DeviceDiscovered { probe } = event {
                    let config = timekeep_core::DeviceConfig {
                        label: probe.serial_number.clone(),
                        serial_number: probe.serial_number.clone(),
                        host: probe.host.clone(),
                        port: 4370,
                        comm_key: 0,
                        timezone: None,
                        push_enabled: true,
                        vendor: probe.vendor.clone(),
                        location: None,
                        poll_interval_secs: None,
                    };
                    for storage in &self.storages {
                        if let Err(e) = storage.upsert_device_config(&config).await {
                            tracing::warn!(
                                device = %probe.serial_number,
                                error = %e,
                                "failed to auto-register discovered device in storage"
                            );
                        } else {
                            tracing::info!(
                                device = %probe.serial_number,
                                "auto-registered ADMS device in storage"
                            );
                        }
                    }
                }

                // Store enriched device metadata when device info is pulled on connect
                if let DomainEvent::DeviceInfoUpdated { device } = event {
                    for storage in &self.storages {
                        if let Err(e) = storage.upsert_device_info(device).await {
                            tracing::warn!(
                                device = %device.serial_number,
                                error = %e,
                                "failed to store device info"
                            );
                        } else {
                            tracing::info!(
                                device = %device.serial_number,
                                platform = %device.platform,
                                fw = %device.firmware_version,
                                "device info stored"
                            );
                        }
                    }
                }

                // Persist device lifecycle events to storage for the activity timeline
                self.persist_device_event(event).await;

                // Non-punch events: forward directly to distributors
                // These are lightweight lifecycle events — distribute synchronously
                for handle in &self.distributors {
                    let name = handle.distributor.name().to_string();
                    handle.distribute(event.clone(), name);
                }
            },
        }
    }

    /// Persist device lifecycle events to storage for the activity timeline.
    /// Maps DomainEvent variants to DeviceEventType variants.
    async fn persist_device_event(&self, event: &DomainEvent) {
        use DomainEvent::*;
        use timekeep_core::model::device_event::DeviceEvent;
        use timekeep_core::model::device_event::DeviceEventType::*;

        let (device_sn, event_type) = match event {
            DeviceOnline { device_sn, .. } => (device_sn.clone(), CameOnline),
            DeviceOffline { device_sn, last_seen } => (
                device_sn.clone(),
                WentOffline { reason: format!("no activity since {}", last_seen.as_second()) },
            ),
            DeviceStorageWarning { device_sn, records_used, records_capacity, percentage } => (
                device_sn.clone(),
                StorageWarning {
                    records_used: *records_used,
                    records_capacity: *records_capacity,
                    percentage: *percentage,
                },
            ),
            DeviceSyncCompleted { device_sn, records_synced, duration_ms } => (
                device_sn.clone(),
                SyncCompleted { records_synced: *records_synced, duration_ms: *duration_ms },
            ),
            DeviceSyncFailed { device_sn, error, records_synced } => (
                device_sn.clone(),
                SyncFailed { error: error.clone(), records_synced: *records_synced },
            ),
            // New: Operation log from ADMS OPERLOG or SDK OpLog pull
            OperationLogReceived { log } => (
                log.device_sn.clone(),
                OperationLog {
                    op_type: format!("{:?}", log.operation),
                    admin_pin: log.admin_pin.clone(),
                    detail: None,
                },
            ),
            // New: Server-initiated user push
            UserSetRequested { device_sn, user } => (
                device_sn.clone(),
                UserSynced {
                    action: "set".into(),
                    pin: user.pin.clone(),
                    name: Some(user.name.clone()),
                },
            ),
            // New: Server-initiated user delete
            UserDeleteRequested { device_sn, .. } => (
                device_sn.clone(),
                UserSynced { action: "delete".into(), pin: String::new(), name: None },
            ),
            _ => return, // Not a persistable device lifecycle event
        };

        let device_event = DeviceEvent::new(&device_sn, jiff::Timestamp::now(), event_type);

        for storage in &self.storages {
            if let Err(e) = storage.record_device_event(&device_event).await {
                tracing::warn!(
                    device = %device_sn,
                    event_type = %device_event.event_type.key(),
                    error = %e,
                    "failed to persist device event"
                );
            }
        }
    }
}

/// No-op storage used as a placeholder when no real storage is configured.
/// Always returns "not found" for punch_exists checks.
struct NoopStorage;

#[async_trait::async_trait]
impl Storage for NoopStorage {
    async fn store_punch(
        &self,
        _punch: &timekeep_core::model::AttendancePunch,
    ) -> Result<(), Error> {
        Ok(())
    }
    async fn query_punches(
        &self,
        _filter: &timekeep_core::PunchFilter,
    ) -> Result<Vec<timekeep_core::model::AttendancePunch>, Error> {
        Ok(vec![])
    }
    async fn upsert_device(&self, _device: &timekeep_core::model::Device) -> Result<(), Error> {
        Ok(())
    }
    async fn upsert_device_config(
        &self,
        _config: &timekeep_core::DeviceConfig,
    ) -> Result<(), Error> {
        Ok(())
    }
    async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
        Ok(vec![])
    }
    async fn delete_device_config(&self, _sn: &str) -> Result<(), Error> {
        Ok(())
    }
    async fn latest_punch_for_device(
        &self,
        _device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        Ok(None)
    }
    async fn punch_exists(&self, _dedup_id: &str) -> Result<bool, Error> {
        Ok(false)
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        // Abort the outbox worker if it's still running
        if let Some(handle) = self.outbox_handle.take() {
            handle.abort();
        }
    }
}
