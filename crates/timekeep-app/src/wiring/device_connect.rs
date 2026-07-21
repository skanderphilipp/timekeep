//! Device connection and lifecycle management extracted from `wire()`.
//!
//! Handles:
//! - Startup device connection + user sync + clock sync + realtime events
//! - SDK poll loop (periodic attendance pull)
//! - Runtime device registration (POST /api/devices)
//! - Device online state tracking (for health endpoint)
//! - Device discovery (auto-connect unknown ADMS-pushing devices)

use std::sync::Arc;

use timekeep::sync::sync_users_to_storage;
use timekeep_core::BiometricDevice;
use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::traits::Storage;
use timekeep_zkteco::ZkTecoDevice;
use timekeep_zkteco::adms::AdmsServer;

use crate::DeviceRegistry;
use timekeep_api::app_state::DeviceConnectionState;

/// Connect to all configured devices at startup.
///
/// For each device config, creates a `ZkTecoDevice`, connects via SDK,
/// registers ADMS state, syncs users, syncs clock, and enables realtime events.
/// Connected devices are inserted into the registry for polling and API access.
pub(crate) async fn connect_devices(
    device_configs: &[timekeep_core::DeviceConfig],
    registry: &DeviceRegistry,
    adms_server: &mut AdmsServer,
    storage: &dyn Storage,
    event_bus: &EventBus,
    device_state: &DeviceConnectionState,
) {
    for config in device_configs {
        tracing::info!(
            label = %config.label,
            serial = %config.serial_number,
            host = %config.host,
            port = config.port,
            "connecting to device from storage"
        );

        let mut device = ZkTecoDevice::new(config.clone(), event_bus.clone());

        match device.connect().await {
            Ok(()) => {
                tracing::info!(label = %config.label, "device connected (ADMS push + SDK poller)");

                if let Some(adms_state) = device.take_adms_state() {
                    adms_server.register(config.serial_number.clone(), adms_state);
                    tracing::debug!(serial = %config.serial_number, "ADMS state registered with shared server");
                }

                if let Err(e) = sync_users_to_storage(&device, storage).await {
                    tracing::warn!(label = %config.label, error = %e, "failed to sync users from device");
                }

                let now = jiff::Timestamp::now();
                if let Err(e) = device.set_time(now).await {
                    tracing::warn!(label = %config.label, error = %e, "failed to sync device clock on connect (non-fatal)");
                } else {
                    tracing::info!(label = %config.label, offset_secs = now.as_second(), "device clock synced on connect");
                }

                spawn_realtime_listener(&mut device, config, event_bus).await;

                registry.lock().await.insert(
                    config.serial_number.clone(),
                    Arc::new(tokio::sync::Mutex::new(device)),
                );
                let now = jiff::Timestamp::now().as_second();
                device_state.set_adms_connected(&config.serial_number, now).await;
            },
            Err(e) => {
                tracing::error!(label = %config.label, error = %e, "failed to connect to device — it will be retried on next poll");
            },
        }
    }
}

async fn spawn_realtime_listener(
    device: &mut ZkTecoDevice,
    config: &timekeep_core::DeviceConfig,
    event_bus: &EventBus,
) {
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
                                local_time: None,
                                time_offset_secs: None,
                                timezone_name: None,
                                status: timekeep_core::PunchStatus::CheckIn,
                                verify_mode,
                                work_code: None,
                                sub_status: None,
                                employee_name: None,
                                device_label: None,
                                is_anomaly: false,
                                anomaly_type: None,
                                raw_data: None,
                            };
                            punch.id = punch.generate_deduplication_id();
                            tracing::info!(device = %sn, pin = %punch.user_pin, ts = %punch.timestamp, "real-time attendance event via SDK");
                            bus.publish(DomainEvent::PunchReceived { punch });
                        },
                        // Explicitly log all other realtime events for observability.
                        // Intentional no-op — these events are informational only.
                        timekeep_zkteco::sdk::event::RealTimeEvent::Finger
                        | timekeep_zkteco::sdk::event::RealTimeEvent::EnrollFinger { .. }
                        | timekeep_zkteco::sdk::event::RealTimeEvent::EnrollUser { .. }
                        | timekeep_zkteco::sdk::event::RealTimeEvent::Button
                        | timekeep_zkteco::sdk::event::RealTimeEvent::Unlock
                        | timekeep_zkteco::sdk::event::RealTimeEvent::Verify { .. }
                        | timekeep_zkteco::sdk::event::RealTimeEvent::FingerScore { .. }
                        | timekeep_zkteco::sdk::event::RealTimeEvent::Alarm { .. } => {
                            tracing::debug!(device = %sn, event = ?event, "real-time event");
                        },
                    }
                }
            });
        },
        Err(e) => {
            tracing::warn!(label = %config.label, error = %e, "real-time events not available (non-fatal)");
        },
    }
}

/// Spawn the SDK poll loop that periodically pulls attendance records.
///
/// Uses `JoinSet` for concurrent per-device polling — slow devices
/// don't block fast ones.
pub(crate) fn spawn_poll_loop(
    registry: DeviceRegistry,
    storage: Arc<dyn Storage>,
    event_bus: EventBus,
    device_state: DeviceConnectionState,
    poll_interval_secs: u32,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(poll_interval_secs.clamp(5, 3600) as u64);
        let mut tick = tokio::time::interval(interval);
        tick.tick().await; // Skip first tick — let ADMS push establish connections

        loop {
            tick.tick().await;
            let devices: Vec<(String, Arc<tokio::sync::Mutex<ZkTecoDevice>>)> =
                { registry.lock().await.iter().map(|(k, v)| (k.clone(), v.clone())).collect() };
            let mut set = tokio::task::JoinSet::new();
            for (sn, device_arc) in devices {
                let storage = storage.clone();
                let bus = event_bus.clone();
                let state = device_state.clone();
                set.spawn(async move {
                    poll_single_device(&sn, &device_arc, &*storage, &bus, &state).await;
                });
            }
            while let Some(result) = set.join_next().await {
                if let Err(e) = result {
                    tracing::error!(error = %e, "poll task panicked");
                }
            }
        }
    })
}

async fn poll_single_device(
    sn: &str,
    device_arc: &Arc<tokio::sync::Mutex<ZkTecoDevice>>,
    storage: &dyn Storage,
    bus: &EventBus,
    state: &DeviceConnectionState,
) {
    let since = match storage.latest_punch_for_device(sn).await {
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
            state.set_sdk_polled(sn, now).await;
            tracing::info!(device = %sn, count = punches.len(), "SDK poll: retrieved records");
            for punch in punches {
                bus.publish(DomainEvent::PunchReceived { punch });
            }
        },
        Ok(_) => {
            let now = jiff::Timestamp::now().as_second();
            state.set_sdk_polled(sn, now).await;
        },
        Err(e) => {
            tracing::warn!(device = %sn, error = %e, "SDK poll: device unreachable");
            let now = jiff::Timestamp::now();
            state.set_disconnected(sn, now.as_second()).await;
            bus.publish(DomainEvent::DeviceOffline { device_sn: sn.to_string(), last_seen: now });
        },
    }
}

/// Spawn a handler that connects newly-registered devices at runtime.
///
/// Listens for `DeviceRegistered` events (published by POST /api/devices)
/// and establishes SDK connectivity so new devices can be polled immediately.
pub(crate) fn spawn_runtime_registration_handler(
    registry: DeviceRegistry,
    storage: Arc<dyn Storage>,
    event_bus: EventBus,
    device_state: DeviceConnectionState,
) -> tokio::task::JoinHandle<()> {
    let mut rx = event_bus.subscribe();
    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            if let DomainEvent::DeviceRegistered { device_sn } = event.as_ref() {
                let sn = device_sn.clone();
                tracing::info!(device = %sn, "DeviceRegistered — loading config and connecting");

                let configs = match storage.list_device_configs().await {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "DeviceRegistered: failed to list configs");
                        continue;
                    },
                };
                let config = match configs.iter().find(|c| c.serial_number == sn) {
                    Some(c) => c.clone(),
                    None => {
                        tracing::warn!(device = %sn, "DeviceRegistered: config not found in storage");
                        continue;
                    },
                };

                {
                    let guard = registry.lock().await;
                    if guard.contains_key(&sn) {
                        tracing::info!(device = %sn, "DeviceRegistered: already connected, skipping");
                        continue;
                    }
                }

                let mut device = ZkTecoDevice::new(config.clone(), event_bus.clone());

                match device.connect().await {
                    Ok(()) => {
                        tracing::info!(device = %sn, label = %config.label, "DeviceRegistered: connected successfully");
                        if let Err(e) = sync_users_to_storage(&device, storage.as_ref()).await {
                            tracing::warn!(device = %sn, error = %e, "DeviceRegistered: user sync failed");
                        }
                        let now = jiff::Timestamp::now();
                        let _ = device.set_time(now).await;

                        spawn_realtime_listener(&mut device, &config, &event_bus).await;

                        registry
                            .lock()
                            .await
                            .insert(sn.clone(), Arc::new(tokio::sync::Mutex::new(device)));
                        let now = jiff::Timestamp::now().as_second();
                        device_state.set_adms_connected(&sn, now).await;
                    },
                    Err(e) => {
                        tracing::error!(device = %sn, host = %config.host, port = config.port, error = %e, "DeviceRegistered: failed to connect — device will be tried on next restart");
                    },
                }
            }
        }
    })
}

/// Spawn a handler that updates device connection state on DeviceOnline events.
pub(crate) fn spawn_device_online_tracker(
    device_state: DeviceConnectionState,
    event_bus: EventBus,
) -> tokio::task::JoinHandle<()> {
    let mut rx = event_bus.subscribe();
    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            if let DomainEvent::DeviceOnline { device_sn, .. } = event.as_ref() {
                let now = jiff::Timestamp::now().as_second();
                device_state.set_adms_connected(device_sn, now).await;
            }
        }
    })
}

/// Spawn a handler that auto-connects unknown ADMS-pushing devices.
pub(crate) fn spawn_device_discovery_handler(
    registry: DeviceRegistry,
    event_bus: EventBus,
    device_state: DeviceConnectionState,
) -> tokio::task::JoinHandle<()> {
    let mut rx = event_bus.subscribe();
    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            if let DomainEvent::DeviceDiscovered { probe } = event.as_ref() {
                let sn = probe.serial_number.clone();
                let host = probe.host.clone();

                if host.is_empty() {
                    tracing::debug!(device = %sn, "DeviceDiscovered without host — skipping SDK connect");
                    continue;
                }

                {
                    let guard = registry.lock().await;
                    if guard.contains_key(&sn) {
                        continue;
                    }
                }

                tracing::info!(device = %sn, host = %host, "DeviceDiscovered — attempting SDK connect");

                let device_config = timekeep_core::DeviceConfig::minimal(&sn, &host);
                let mut device = ZkTecoDevice::new(device_config, event_bus.clone());

                match device.connect().await {
                    Ok(()) => {
                        registry
                            .lock()
                            .await
                            .insert(sn.clone(), Arc::new(tokio::sync::Mutex::new(device)));
                        let now = jiff::Timestamp::now().as_second();
                        device_state.set_adms_connected(&sn, now).await;
                        tracing::info!(device = %sn, host = %host, "runtime device connected — now polled via SDK");
                    },
                    Err(e) => {
                        tracing::warn!(device = %sn, host = %host, error = %e, "runtime device SDK connect failed — will retry on next discovery");
                    },
                }
            }
        }
    })
}
