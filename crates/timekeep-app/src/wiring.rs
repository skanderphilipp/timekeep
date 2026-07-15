//! Dependency wiring (composition root).
//!
//! Creates every runtime component — storage, engine, device connections,
//! background workers — and returns them as a single `AppDependencies` struct.
//! The caller (`main.rs`) is responsible only for starting the HTTP servers
//! and handling shutdown.

use std::collections::HashMap;
use std::sync::Arc;

use timekeep::fingerprint_transfer;
use timekeep::outbox_worker;
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

use crate::DeviceRegistry;
use crate::config::AppConfig;

/// All runtime components wired together by `wire()`.
///
/// The caller destructures this to start the HTTP servers, then
/// runs the engine and handles shutdown.
pub(crate) struct AppDependencies {
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    pub engine: Engine,
    pub provider_registry: Arc<timekeep_core::ProviderRegistry>,
    pub device_registry: DeviceRegistry,
    pub adms_server: Option<AdmsServer>,
    /// All background task handles spawned during wiring.
    /// Index 0 is the poll loop handle (explicitly aborted on shutdown);
    /// remaining handles are dropped naturally.
    pub device_handles: Vec<tokio::task::JoinHandle<()>>,
    pub event_bus: EventBus,
    pub engine_health: EngineHealth,
    pub device_state: timekeep_api::app_state::DeviceConnectionState,
}

/// Create every runtime component and return them as `AppDependencies`.
///
/// This is the composition root: all side effects (I/O, network, spawning)
/// happen here. The function is async because storage backends and device
/// connections are async.
pub(crate) async fn wire(
    config: &AppConfig,
) -> Result<AppDependencies, Box<dyn std::error::Error>> {
    // ─── Storage ────────────────────────────────────────────────────
    let db_backend = &config.db_backend;

    let storage: Arc<dyn Storage>;
    let employees: Option<Arc<dyn timekeep_core::EmployeeStore>>;

    match db_backend.as_str() {
        "postgres" => {
            let db_url = &config.db_url;
            tracing::info!("using PostgreSQL storage backend");
            let pg = Arc::new(timekeep_storage_postgres::PostgresStorage::new(db_url).await?);
            storage = pg.clone() as Arc<dyn Storage>;
            employees = Some(pg as Arc<dyn timekeep_core::EmployeeStore>);
        },
        _ => {
            let db_path = &config.db_path;
            tracing::info!(path = %db_path, "using SQLite storage backend (WAL mode)");
            let sqlite = Arc::new(timekeep_storage_sqlite::SqliteStorage::new(db_path).await?);
            storage = sqlite.clone() as Arc<dyn Storage>;
            employees = Some(sqlite as Arc<dyn timekeep_core::EmployeeStore>);
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
                let odoo =
                    timekeep_dist_odoo::OdooDistributor::new(url, api_key, database, "barcode")
                        .with_storage(storage.clone());
                Arc::new(odoo)
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

    // Wrap distributor handles in Arc so the outbox worker can share them
    let distributor_handles = Arc::new(distributor_handles);

    // ─── Event Bus ──────────────────────────────────────────────────
    let event_bus = EventBus::default();

    // ─── Health Tracker (shared between engine and API) ────────────
    let engine_health = EngineHealth::new();

    // ─── Engine (pipeline + storage + distributors with circuit breakers) ─
    let engine = Engine::new(
        vec![storage.clone()],
        distributor_handles.to_vec(),
        engine_health.clone(),
        event_bus.clone(),
    );

    // ─── Outbox Worker (retry failed deliveries) ─────────────────────
    //
    // Runs in the background, retrying punches that failed to reach
    // external systems. Uses exponential backoff (30s → 60s → 2m → 5m → 10m → 30m).
    let outbox_storage = storage.clone();
    let outbox_handles = distributor_handles.clone();
    tokio::spawn(async move {
        outbox_worker::run_outbox_worker(outbox_storage, outbox_handles).await;
    });
    tracing::info!("outbox worker spawned");

    // ─── ADMS Server (shared — handles all devices on one port) ─────
    //
    // The ADMS protocol is HTTP-based push from ZKTeco scanners.
    // One AdmsServer routes events to the correct device
    // by parsing the SN query parameter in each scanner POST.
    // Port is configurable via TIMEKEEP_ADMS_PORT env var (default: 8085).
    let adms_port = config.adms_port;
    let mut adms_server = AdmsServer::new(format!("0.0.0.0:{adms_port}"), event_bus.clone());
    tracing::info!(
        "ADMS server created on port {adms_port} — will start after device registration"
    );

    // ─── Device Connection State (for API transparency) ───────────
    let device_state = timekeep_api::app_state::DeviceConnectionState::default();

    // ─── Provider Registry (multi-vendor support) ──────────────────
    //
    // Providers are discovered at link time via inventory::submit!
    // in each adapter crate (e.g., timekeep-zkteco). Adding a new
    // vendor means creating a crate + submitting a ProviderManifest —
    // no manual wiring needed here.
    let mut provider_registry = timekeep_core::ProviderRegistry::new();
    provider_registry.init_from_inventory();
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

                // Auto-sync device clock on connect
                let now = jiff::Timestamp::now();
                match device.set_time(now).await {
                    Ok(()) => tracing::info!(
                        label = %config.label,
                        offset_secs = now.as_second(),
                        "device clock synced on connect"
                    ),
                    Err(e) => tracing::warn!(
                        label = %config.label,
                        error = %e,
                        "failed to sync device clock on connect (non-fatal)"
                    ),
                }

                // Start real-time event subscription
                match device.enable_realtime().await {
                    Ok(mut rx) => {
                        let bus = event_bus.clone();
                        let sn = config.serial_number.clone();
                        tokio::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                match event {
                                    timekeep_zkteco::sdk::event::RealTimeEvent::AttLog {
                                        user_pin,
                                        verify_mode,
                                        timestamp,
                                    } => {
                                        let mut punch = timekeep_core::AttendancePunch {
                                            id: String::new(),
                                            device_sn: sn.clone(),
                                            user_pin,
                                            timestamp,
                                            status: timekeep_core::PunchStatus::CheckIn,
                                            verify_mode,
                                            work_code: None,
                                            sub_status: None,
                                            employee_name: None,
                                            device_label: None,
                                            raw_data: None,
                                        };
                                        punch.id = punch.generate_deduplication_id();
                                        tracing::info!(
                                            device = %sn,
                                            pin = %punch.user_pin,
                                            ts = %punch.timestamp,
                                            "real-time attendance event via SDK"
                                        );
                                        bus.publish(DomainEvent::PunchReceived { punch });
                                    },
                                    _ => {
                                        tracing::debug!(device = %sn, event = ?event, "real-time event");
                                    },
                                }
                            }
                        });
                    },
                    Err(e) => {
                        tracing::warn!(
                            label = %config.label,
                            error = %e,
                            "real-time events not available (non-fatal)"
                        );
                    },
                }

                device_registry.lock().await.insert(
                    config.serial_number.clone(),
                    Arc::new(tokio::sync::Mutex::new(device)),
                );
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
    tracing::info!("ADMS server listening on 0.0.0.0:{adms_port}");

    // ─── SDK Poll Loop (concurrent JoinSet) ──────────────────────
    //
    // Runs in parallel with ADMS push (real-time events).
    // Periodically calls get_attendance(since) on each device
    // to pull bulk records. The dedup pipeline handles duplicates
    // from the two paths.
    //
    // Devices are polled concurrently via JoinSet: the registry lock
    // is held only briefly to collect Arc references; each spawned
    // task locks its own device independently, avoiding head-of-line
    // blocking from slow devices.
    let poll_interval =
        storage.get_system_settings().await.map(|s| s.poll_interval_secs).unwrap_or(60);

    tracing::info!(poll_interval_secs = poll_interval, "SDK poll loop configured");

    let poll_registry = device_registry.clone();
    let poll_storage = storage.clone();
    let poll_bus = event_bus.clone();
    let poll_device_state = device_state.clone();
    let poll_handle = tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(poll_interval.clamp(5, 3600) as u64);
        let mut tick = tokio::time::interval(interval);
        // Skip first tick — let ADMS push establish connections
        tick.tick().await;

        loop {
            tick.tick().await;
            // Collect device Arc references under a short lock, then poll concurrently
            let devices: Vec<(String, Arc<tokio::sync::Mutex<timekeep_zkteco::ZkTecoDevice>>)> = {
                poll_registry.lock().await.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
            };
            let mut set = tokio::task::JoinSet::new();
            for (sn, device_arc) in devices {
                let storage = poll_storage.clone();
                let bus = poll_bus.clone();
                let state = poll_device_state.clone();
                set.spawn(async move {
                    let since = match storage.latest_punch_for_device(&sn).await {
                        Ok(Some(ts)) => Some(ts),
                        Ok(None) => None,
                        Err(e) => {
                            tracing::error!(device = %sn, error = %e, "poll: failed to get last punch");
                            return;
                        },
                    };
                    let device = device_arc.lock().await;
                    match device.get_attendance(since).await {
                        Ok(punches) if !punches.is_empty() => {
                            let now = jiff::Timestamp::now().as_second();
                            state.set_sdk_polled(&sn, now).await;
                            tracing::info!(
                                device = %sn,
                                count = punches.len(),
                                "SDK poll: retrieved records"
                            );
                            for punch in punches {
                                bus.publish(DomainEvent::PunchReceived { punch });
                            }
                        },
                        Ok(_) => {
                            let now = jiff::Timestamp::now().as_second();
                            state.set_sdk_polled(&sn, now).await;
                        },
                        Err(e) => {
                            tracing::warn!(device = %sn, error = %e, "SDK poll: device unreachable");
                        },
                    }
                });
            }
            // Await all poll tasks before the next cycle
            while let Some(result) = set.join_next().await {
                if let Err(e) = result {
                    tracing::error!(error = %e, "poll task panicked");
                }
            }
        }
    });

    // ─── API Event Handler (wired to device registry) ───────────────
    let mut user_event_rx = event_bus.subscribe();
    let registry = device_registry.clone();
    let emp_repo = employees.clone();
    let handler_event_bus = event_bus.clone();
    let user_event_handle = tokio::spawn(async move {
        while let Ok(event) = user_event_rx.recv().await {
            match event.as_ref() {
                DomainEvent::UserSetRequested { device_sn, user } => {
                    tracing::info!(
                        device = %device_sn,
                        pin = %user.pin,
                        name = %user.name,
                        "user set requested via API — routing to device"
                    );
                    let device_arc = {
                        let guard = registry.lock().await;
                        guard.get(device_sn.as_str()).cloned()
                    };
                    if let Some(device_arc) = device_arc {
                        let mut device = device_arc.lock().await;
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
                    let device_arc = {
                        let guard = registry.lock().await;
                        guard.get(device_sn.as_str()).cloned()
                    };
                    if let Some(device_arc) = device_arc {
                        let mut device = device_arc.lock().await;
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
                        "command enqueue requested — trying SDK first, then ADMS"
                    );
                    let sn = device_sn.clone();
                    let cmd = command.clone();
                    let reg = registry.clone();
                    let bus = handler_event_bus.clone();
                    tokio::spawn(async move {
                        let device_arc = {
                            let guard = reg.lock().await;
                            guard.get(sn.as_str()).cloned()
                        };
                        match device_arc {
                            Some(device_arc) => {
                                let mut device = device_arc.lock().await;
                                // Try SDK execution first for direct commands
                                let executed = match cmd.to_uppercase().as_str() {
                                    "RESTART" | "REBOOT" => match device.restart().await {
                                        Ok(()) => {
                                            tracing::info!(device = %sn, "device restarted via SDK");
                                            true
                                        },
                                        Err(e) => {
                                            tracing::warn!(device = %sn, error = %e, "SDK restart failed, falling back to ADMS");
                                            false
                                        },
                                    },
                                    "SYNC_CLOCK" => {
                                        let now = jiff::Timestamp::now();
                                        match device.set_time(now).await {
                                            Ok(()) => {
                                                tracing::info!(device = %sn, "clock synced via SDK");
                                                true
                                            },
                                            Err(e) => {
                                                tracing::warn!(device = %sn, error = %e, "SDK clock sync failed, falling back to ADMS");
                                                false
                                            },
                                        }
                                    },
                                    "UNLOCK" => {
                                        // SDK unlock isn't implemented yet — fall through to ADMS
                                        false
                                    },
                                    _ => false,
                                };
                                drop(device); // release the Mutex lock

                                if executed {
                                    // Record the event as an operation log for audit trail
                                    bus.publish(DomainEvent::OperationLogReceived {
                                        log: timekeep_core::OperationLog {
                                            device_sn: sn.clone(),
                                            timestamp: jiff::Timestamp::now(),
                                            operation:
                                                timekeep_core::OperationType::CommandExecuted,
                                            admin_pin: "server".into(),
                                            params: vec![],
                                        },
                                    });
                                    return;
                                }

                                // Fall back to ADMS command queue
                                let guard = reg.lock().await;
                                if let Some(dev) = guard.get(sn.as_str()) {
                                    let dev = dev.lock().await;
                                    if let Some(queue) = dev.adms_command_queue() {
                                        match queue.lock().unwrap().enqueue(&sn, &cmd) {
                                            Ok(cmd_id) => tracing::info!(
                                                device = %sn,
                                                command_id = cmd_id,
                                                command = %cmd,
                                                "command enqueued in ADMS queue"
                                            ),
                                            Err(e) => tracing::error!(
                                                device = %sn,
                                                command = %cmd,
                                                error = %e,
                                                "failed to enqueue command"
                                            ),
                                        }
                                    } else {
                                        tracing::warn!(
                                            device = %sn,
                                            "no ADMS server for command routing"
                                        );
                                    }
                                } else {
                                    tracing::warn!(
                                        device = %sn,
                                        "device not found in registry"
                                    );
                                }
                            },
                            None => {
                                tracing::warn!(
                                    device = %sn,
                                    "device not found in registry"
                                );
                            },
                        }
                    });
                },
                // ── Employee Sync: push to all assigned devices ──
                DomainEvent::EmployeeSyncRequested { employee_pin } => {
                    tracing::info!(
                        pin = %employee_pin,
                        "employee sync requested — pushing to all enrolled devices"
                    );
                    let pin = employee_pin.clone();
                    let bus = handler_event_bus.clone();
                    let reg = registry.clone();
                    let repo = emp_repo.clone();
                    tokio::spawn(async move {
                        let repo = match repo {
                            Some(r) => r,
                            None => {
                                tracing::warn!(pin = %pin, "EmployeeSyncRequested: no EmployeeStore configured");
                                return;
                            },
                        };
                        let employee = match repo.find_employee_by_pin(&pin).await {
                            Ok(Some(e)) => e,
                            Ok(None) => {
                                tracing::warn!(pin = %pin, "EmployeeSyncRequested: employee not found");
                                return;
                            },
                            Err(e) => {
                                tracing::error!(pin = %pin, error = %e, "EmployeeSyncRequested: lookup failed");
                                return;
                            },
                        };
                        let enrollments = match repo
                            .list_enrollments_for_employee(&employee.id)
                            .await
                        {
                            Ok(e) => e,
                            Err(e) => {
                                tracing::error!(pin = %pin, error = %e, "EmployeeSyncRequested: failed to list enrollments");
                                return;
                            },
                        };
                        if enrollments.is_empty() {
                            tracing::info!(pin = %pin, "EmployeeSyncRequested: no device enrollments — nothing to sync");
                            return;
                        }
                        let user = timekeep_core::User {
                            internal_sn: 0,
                            pin: employee.pin.clone(),
                            name: employee.name.clone(),
                            privilege: 0,
                            card_number: None,
                            has_password: false,
                            fingerprint_count: 0,
                            has_face: false,
                        };
                        let mut pushed = 0u32;
                        let mut failed = 0u32;
                        let start = std::time::Instant::now();
                        for enrollment in &enrollments {
                            let device_arc = {
                                let guard = reg.lock().await;
                                guard.get(enrollment.device_sn.as_str()).cloned()
                            };
                            match device_arc {
                                Some(device_arc) => {
                                    let mut device = device_arc.lock().await;
                                    match device.set_user(&user).await {
                                        Ok(()) => {
                                            pushed += 1;
                                            tracing::debug!(
                                                device = %enrollment.device_sn,
                                                pin = %pin,
                                                "employee pushed to device"
                                            );
                                        },
                                        Err(e) => {
                                            tracing::error!(
                                                device = %enrollment.device_sn,
                                                pin = %pin,
                                                error = %e,
                                                "EmployeeSyncRequested: push failed"
                                            );
                                            failed += 1;
                                        },
                                    }
                                },
                                None => {
                                    tracing::warn!(
                                        device = %enrollment.device_sn,
                                        "EmployeeSyncRequested: enrolled device not in registry"
                                    );
                                    failed += 1;
                                },
                            }
                        }
                        let duration_ms = start.elapsed().as_millis() as u64;
                        tracing::info!(pin = %pin, pushed, failed, duration_ms, "employee sync completed");
                        bus.publish(DomainEvent::UsersBulkSynced {
                            device_sn: String::new(),
                            pushed,
                            deleted: 0,
                            failed,
                            duration_ms,
                        });
                    });
                },
                DomainEvent::EmployeeRemoveRequested { employee_pin } => {
                    tracing::info!(
                        pin = %employee_pin,
                        "employee remove requested — deleting from all enrolled devices"
                    );
                    let pin = employee_pin.clone();
                    let bus = handler_event_bus.clone();
                    let reg = registry.clone();
                    let repo = emp_repo.clone();
                    tokio::spawn(async move {
                        let repo = match repo {
                            Some(r) => r,
                            None => {
                                tracing::warn!(pin = %pin, "EmployeeRemoveRequested: no EmployeeStore configured");
                                return;
                            },
                        };
                        let employee = match repo.find_employee_by_pin(&pin).await {
                            Ok(Some(e)) => e,
                            Ok(None) => {
                                tracing::warn!(pin = %pin, "EmployeeRemoveRequested: employee not found");
                                return;
                            },
                            Err(e) => {
                                tracing::error!(pin = %pin, error = %e, "EmployeeRemoveRequested: lookup failed");
                                return;
                            },
                        };
                        let enrollments = match repo
                            .list_enrollments_for_employee(&employee.id)
                            .await
                        {
                            Ok(e) => e,
                            Err(e) => {
                                tracing::error!(pin = %pin, error = %e, "EmployeeRemoveRequested: failed to list enrollments");
                                return;
                            },
                        };
                        if enrollments.is_empty() {
                            tracing::info!(pin = %pin, "EmployeeRemoveRequested: no device enrollments — nothing to do");
                            return;
                        }
                        // We need the device user's internal_sn to delete.
                        // Read current users from each device to find the matching PIN.
                        let mut deleted = 0u32;
                        let mut failed = 0u32;
                        let start = std::time::Instant::now();
                        for enrollment in &enrollments {
                            let device_arc = {
                                let guard = reg.lock().await;
                                guard.get(enrollment.device_sn.as_str()).cloned()
                            };
                            match device_arc {
                                Some(device_arc) => {
                                    let mut device = device_arc.lock().await;
                                    match device.get_users().await {
                                        Ok(users) => {
                                            if let Some(dev_user) =
                                                users.iter().find(|u| u.pin == pin)
                                            {
                                                match device.delete_user(dev_user.internal_sn).await
                                                {
                                                    Ok(()) => {
                                                        deleted += 1;
                                                        tracing::debug!(
                                                            device = %enrollment.device_sn,
                                                            pin = %pin,
                                                            "employee removed from device"
                                                        );
                                                    },
                                                    Err(e) => {
                                                        tracing::error!(
                                                            device = %enrollment.device_sn,
                                                            pin = %pin,
                                                            error = %e,
                                                            "EmployeeRemoveRequested: delete failed"
                                                        );
                                                        failed += 1;
                                                    },
                                                }
                                            } else {
                                                tracing::info!(
                                                    device = %enrollment.device_sn,
                                                    pin = %pin,
                                                    "EmployeeRemoveRequested: user not found on device — already removed"
                                                );
                                                deleted += 1;
                                            }
                                        },
                                        Err(e) => {
                                            tracing::error!(
                                                device = %enrollment.device_sn,
                                                error = %e,
                                                "EmployeeRemoveRequested: failed to read device users"
                                            );
                                            failed += 1;
                                        },
                                    }
                                },
                                None => {
                                    tracing::warn!(
                                        device = %enrollment.device_sn,
                                        "EmployeeRemoveRequested: enrolled device not in registry"
                                    );
                                    failed += 1;
                                },
                            }
                        }
                        let duration_ms = start.elapsed().as_millis() as u64;
                        tracing::info!(pin = %pin, deleted, failed, duration_ms, "employee removal completed");
                        bus.publish(DomainEvent::UsersBulkSynced {
                            device_sn: String::new(),
                            pushed: 0,
                            deleted,
                            failed,
                            duration_ms,
                        });
                    });
                },
                // ── Device-to-Device Sync ──
                DomainEvent::DeviceToDeviceSyncRequested { source_sn, target_sn } => {
                    tracing::info!(
                        source = %source_sn,
                        target = %target_sn,
                        "device-to-device sync requested"
                    );
                    let source = source_sn.clone();
                    let target = target_sn.clone();
                    let reg = registry.clone();
                    let bus = handler_event_bus.clone();
                    tokio::spawn(async move {
                        let (src_arc, tgt_arc) = {
                            let guard = reg.lock().await;
                            (
                                guard.get(source.as_str()).cloned(),
                                guard.get(target.as_str()).cloned(),
                            )
                        };

                        match (src_arc, tgt_arc) {
                            (Some(src_arc), Some(_tgt_arc)) => {
                                let src = src_arc.lock().await;
                                match src.get_users().await {
                                    Ok(users) => {
                                        tracing::info!(
                                            source = %source,
                                            target = %target,
                                            count = users.len(),
                                            "read users from source device"
                                        );
                                        for user in &users {
                                            bus.publish(DomainEvent::UserSetRequested {
                                                device_sn: target.clone(),
                                                user: user.clone(),
                                            });
                                        }
                                        bus.publish(DomainEvent::UsersBulkSynced {
                                            device_sn: target.clone(),
                                            pushed: users.len() as u32,
                                            deleted: 0,
                                            failed: 0,
                                            duration_ms: 0,
                                        });
                                    },
                                    Err(e) => {
                                        tracing::error!(
                                            source = %source,
                                            error = %e,
                                            "failed to read users from source device"
                                        );
                                    },
                                }
                            },
                            (None, _) => {
                                tracing::warn!(source = %source, "source device not found")
                            },
                            (_, None) => {
                                tracing::warn!(target = %target, "target device not found")
                            },
                        }
                    });
                },
                // ── Full Device Re-sync ──
                DomainEvent::DeviceResyncRequested { device_sn } => {
                    tracing::info!(
                        device = %device_sn,
                        "device re-sync requested — clearing and re-uploading all users"
                    );
                    let sn = device_sn.clone();
                    let reg = registry.clone();
                    let bus = handler_event_bus.clone();
                    let repo = emp_repo.clone();
                    tokio::spawn(async move {
                        let start = std::time::Instant::now();
                        let device_arc = {
                            let guard = reg.lock().await;
                            guard.get(sn.as_str()).cloned()
                        };
                        match device_arc {
                            Some(device_arc) => {
                                let mut device = device_arc.lock().await;
                                // Step 1: Read current users
                                let existing = match device.get_users().await {
                                    Ok(u) => u,
                                    Err(e) => {
                                        tracing::error!(device = %sn, error = %e, "re-sync: failed to read users");
                                        bus.publish(DomainEvent::DeviceSyncFailed {
                                            device_sn: sn.clone(),
                                            error: e.to_string(),
                                            records_synced: 0,
                                        });
                                        return;
                                    },
                                };

                                // Step 2: Delete all existing users
                                let mut deleted = 0u32;
                                for user in &existing {
                                    match device.delete_user(user.internal_sn).await {
                                        Ok(()) => deleted += 1,
                                        Err(e) => tracing::warn!(
                                            device = %sn,
                                            pin = %user.pin,
                                            error = %e,
                                            "re-sync: failed to delete user"
                                        ),
                                    }
                                }
                                tracing::info!(device = %sn, deleted, "re-sync: cleared existing users");

                                // Step 3: Re-upload from employee database
                                let mut pushed = 0u32;
                                let mut failed_reupload = 0u32;
                                if let Some(repo) = repo {
                                    // Find all employees enrolled on this device
                                    match repo.list_enrollments_for_device(&sn).await {
                                        Ok(enrollments) => {
                                            for enrollment in &enrollments {
                                                match repo
                                                    .find_employee(&enrollment.employee_id)
                                                    .await
                                                {
                                                    Ok(Some(employee)) if employee.active => {
                                                        let user = timekeep_core::User {
                                                            internal_sn: 0,
                                                            pin: employee.pin.clone(),
                                                            name: employee.name.clone(),
                                                            privilege: 0,
                                                            card_number: enrollment
                                                                .card_number
                                                                .clone(),
                                                            has_password: false,
                                                            fingerprint_count: enrollment
                                                                .fingerprint_count
                                                                as u8,
                                                            has_face: enrollment.face_enrolled,
                                                        };
                                                        match device.set_user(&user).await {
                                                            Ok(()) => pushed += 1,
                                                            Err(e) => {
                                                                tracing::warn!(
                                                                    device = %sn,
                                                                    pin = %employee.pin,
                                                                    error = %e,
                                                                    "re-sync: failed to re-upload employee"
                                                                );
                                                                failed_reupload += 1;
                                                            },
                                                        }
                                                    },
                                                    Ok(Some(_)) => {
                                                        // Inactive employee — skip
                                                        tracing::debug!(
                                                            device = %sn,
                                                            employee_id = %enrollment.employee_id,
                                                            "re-sync: skipping inactive employee"
                                                        );
                                                    },
                                                    Ok(None) => {
                                                        tracing::warn!(
                                                            device = %sn,
                                                            employee_id = %enrollment.employee_id,
                                                            "re-sync: enrollment references unknown employee"
                                                        );
                                                    },
                                                    Err(e) => {
                                                        tracing::error!(
                                                            device = %sn,
                                                            employee_id = %enrollment.employee_id,
                                                            error = %e,
                                                            "re-sync: failed to look up employee"
                                                        );
                                                        failed_reupload += 1;
                                                    },
                                                }
                                            }
                                        },
                                        Err(e) => {
                                            tracing::error!(device = %sn, error = %e, "re-sync: failed to list enrollments");
                                        },
                                    }
                                } else {
                                    tracing::warn!(device = %sn, "re-sync: no EmployeeStore configured — cannot re-upload");
                                }

                                let duration_ms = start.elapsed().as_millis() as u64;
                                let records_synced = pushed;
                                tracing::info!(
                                    device = %sn,
                                    deleted,
                                    pushed,
                                    failed_reupload,
                                    duration_ms,
                                    "re-sync completed"
                                );
                                bus.publish(DomainEvent::DeviceSyncCompleted {
                                    device_sn: sn.clone(),
                                    records_synced,
                                    duration_ms,
                                });
                            },
                            None => {
                                tracing::warn!(device = %sn, "re-sync: device not found in registry");
                                bus.publish(DomainEvent::DeviceSyncFailed {
                                    device_sn: sn.clone(),
                                    error: "device not found in registry".into(),
                                    records_synced: 0,
                                });
                            },
                        }
                    });
                },
                // ── Fingerprint Template Transfer ──
                DomainEvent::FingerprintTransferRequested { source_sn, target_sn, employee_id } => {
                    fingerprint_transfer::handle_transfer_request(
                        source_sn.clone(),
                        target_sn.clone(),
                        employee_id.clone(),
                        registry.clone(),
                        emp_repo.clone(),
                        handler_event_bus.clone(),
                    )
                    .await;
                },
                _ => {},
            }
        }
    });

    // ─── Device Online Event Handler (health tracking) ───────────
    //
    // Listens for DeviceOnline events published by the ADMS server
    // (on every device push) and updates the shared DeviceConnectionState
    // so the health endpoint can show accurate per-device online status.
    //
    // This connects the two previously-disconnected state systems:
    //   - DeviceAdmsState (ADMS-internal, written by handlers)
    //   - DeviceConnectionState (API-facing, read by health endpoint)
    let mut device_online_rx = event_bus.subscribe();
    let online_device_state = device_state.clone();
    let device_online_handle = tokio::spawn(async move {
        while let Ok(event) = device_online_rx.recv().await {
            if let DomainEvent::DeviceOnline { device_sn, .. } = event.as_ref() {
                let now = jiff::Timestamp::now().as_second();
                online_device_state.set_adms_connected(device_sn, now).await;
            }
        }
    });

    // ─── Device Discovery Handler (runtime auto-registration) ───
    //
    // When a previously-unknown device pushes ADMS data, the ADMS
    // handler auto-registers it and publishes DeviceDiscovered.
    // This subscriber picks up that event and attempts to establish
    // SDK connectivity so the device can be polled for attendance.
    let mut discovery_rx = event_bus.subscribe();
    let discovery_registry = device_registry.clone();
    let discovery_device_state = device_state.clone();
    let discovery_event_bus = event_bus.clone();
    let discovery_handle = tokio::spawn(async move {
        while let Ok(event) = discovery_rx.recv().await {
            if let DomainEvent::DeviceDiscovered { probe } = event.as_ref() {
                let sn = probe.serial_number.clone();
                let host = probe.host.clone();

                if host.is_empty() {
                    tracing::debug!(
                        device = %sn,
                        "DeviceDiscovered without host — skipping SDK connect"
                    );
                    continue;
                }

                // Skip if already registered
                {
                    let guard = discovery_registry.lock().await;
                    if guard.contains_key(&sn) {
                        continue;
                    }
                }

                tracing::info!(
                    device = %sn,
                    host = %host,
                    "DeviceDiscovered — attempting SDK connect"
                );

                let device_config = timekeep_core::DeviceConfig::minimal(&sn, &host);
                let mut device =
                    timekeep_zkteco::ZkTecoDevice::new(device_config, discovery_event_bus.clone());

                match device.connect().await {
                    Ok(()) => {
                        discovery_registry
                            .lock()
                            .await
                            .insert(sn.clone(), Arc::new(tokio::sync::Mutex::new(device)));
                        let now = jiff::Timestamp::now().as_second();
                        discovery_device_state.set_adms_connected(&sn, now).await;
                        tracing::info!(
                            device = %sn,
                            host = %host,
                            "runtime device connected — now polled via SDK"
                        );
                    },
                    Err(e) => {
                        tracing::warn!(
                            device = %sn,
                            host = %host,
                            error = %e,
                            "runtime device SDK connect failed — will retry on next discovery"
                        );
                    },
                }
            }
        }
    });

    // Collect background task handles.
    // Index 0 = poll handle (explicitly aborted on shutdown).
    // Remaining handles are dropped naturally when AppDependencies is dropped.
    let mut device_handles: Vec<tokio::task::JoinHandle<()>> = Vec::new();
    device_handles.push(poll_handle);
    device_handles.push(user_event_handle);
    device_handles.push(device_online_handle);
    device_handles.push(discovery_handle);

    Ok(AppDependencies {
        storage,
        employees,
        engine,
        provider_registry,
        device_registry,
        adms_server: Some(adms_server),
        device_handles,
        event_bus,
        engine_health,
        device_state,
    })
}
