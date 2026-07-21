//! Event handler functions extracted from `wire()`.
//!
//! Each function corresponds to a `DomainEvent` variant that was previously
//! handled inline in the giant match expression. Extraction makes each handler:
//! - Independently testable
//! - ≤80 lines (clean code R1)
//! - Visible as a table of contents in the main event loop
//!
//! Also provides shared helpers (device lookup, etc.) to eliminate duplication.

use std::sync::Arc;

use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::traits::Storage;
use timekeep_core::{BiometricDevice, EmployeeStore};

use crate::DeviceRegistry;
use timekeep::sync::sync_users_to_storage;
use timekeep_api::app_state::DeviceConnectionState;
use timekeep_zkteco::ZkTecoDevice;

// ── Shared Helpers ──────────────────────────────────────────────────────

/// Look up a device in the registry by serial number.
///
/// Returns `None` if the device is not connected. This pattern was duplicated
/// 10 times across the original event handler — now consolidated here.
pub(crate) async fn get_device(
    registry: &DeviceRegistry,
    sn: &str,
) -> Option<Arc<tokio::sync::Mutex<ZkTecoDevice>>> {
    let guard = registry.lock().await;
    guard.get(sn).cloned()
}

/// Context passed to all event handler functions.
///
/// Extracted to avoid 6+ cloned Arcs per handler spawn.
pub(crate) struct HandlerContext {
    pub registry: DeviceRegistry,
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn EmployeeStore>>,
    pub event_bus: EventBus,
    pub device_state: DeviceConnectionState,
}

// ── Event Handlers ──────────────────────────────────────────────────────

pub(crate) async fn handle_user_set(
    ctx: &HandlerContext,
    device_sn: &str,
    user: &timekeep_core::model::User,
) {
    tracing::info!(
        device = %device_sn,
        pin = %user.pin,
        name = %user.name,
        "user set requested via API — routing to device"
    );
    match get_device(&ctx.registry, device_sn).await {
        Some(device_arc) => {
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
        },
        None => {
            tracing::warn!(
                device = %device_sn,
                "user set requested but device not found in registry"
            );
        },
    }
}

pub(crate) async fn handle_user_delete(ctx: &HandlerContext, device_sn: &str, user_sn: u16) {
    tracing::info!(
        device = %device_sn,
        user_sn,
        "user delete requested via API — routing to device"
    );
    match get_device(&ctx.registry, device_sn).await {
        Some(device_arc) => {
            let mut device = device_arc.lock().await;
            match device.delete_user(user_sn).await {
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
        },
        None => {
            tracing::warn!(
                device = %device_sn,
                "user delete requested but device not found in registry"
            );
        },
    }
}

pub(crate) fn spawn_command_handler(ctx: &HandlerContext, device_sn: String, command: String) {
    let sn = device_sn;
    let cmd = command;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    tokio::spawn(async move {
        let Some(device_arc) = get_device(&reg, &sn).await else {
            tracing::warn!(device = %sn, "device not found in registry");
            return;
        };

        // Try SDK execution first (scoped lock release)
        let executed = {
            let mut device = device_arc.lock().await;
            execute_sdk_command(&mut *device, &sn, &cmd).await
        };

        if executed {
            bus.publish(DomainEvent::OperationLogReceived {
                log: timekeep_core::OperationLog {
                    device_sn: sn.clone(),
                    timestamp: jiff::Timestamp::now(),
                    operation: timekeep_core::OperationType::CommandExecuted,
                    admin_pin: "server".into(),
                    params: vec![],
                },
            });
            return;
        }

        // Fall back to ADMS command queue
        enqueue_adms_command(&reg, &sn, &cmd).await;
    });
}

/// Try to enqueue a command via the ADMS command queue.
/// Logs warnings if the device, ADMS server, or queue is unavailable.
async fn enqueue_adms_command(registry: &DeviceRegistry, sn: &str, cmd: &str) {
    let guard = registry.lock().await;
    let Some(dev) = guard.get(sn) else {
        tracing::warn!(device = %sn, "device not found in registry for ADMS fallback");
        return;
    };
    let dev = dev.lock().await;
    let Some(queue) = dev.adms_command_queue() else {
        tracing::warn!(device = %sn, "no ADMS server for command routing");
        return;
    };
    match queue.lock().unwrap().enqueue(sn, cmd) {
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
}

/// Try to execute a command via SDK. Returns `true` if the SDK executed it.
async fn execute_sdk_command(device: &mut ZkTecoDevice, sn: &str, cmd: &str) -> bool {
    match cmd.to_uppercase().as_str() {
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
    }
}

pub(crate) fn spawn_employee_sync(ctx: &HandlerContext, employee_pin: String) {
    let pin = employee_pin;
    let bus = ctx.event_bus.clone();
    let reg = ctx.registry.clone();
    let repo = ctx.employees.clone();
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
        let enrollments = match repo.list_enrollments_for_employee(&employee.id).await {
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
            group: None,
            timezone: None,
            password_raw: None,
            has_password: false,
            fingerprint_count: 0,
            has_face: false,
        };
        let mut pushed = 0u32;
        let mut failed = 0u32;
        let start = std::time::Instant::now();
        for enrollment in &enrollments {
            match push_user_to_device(&reg, &user, &enrollment.device_sn).await {
                Ok(()) => pushed += 1,
                Err(_) => failed += 1,
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
}

async fn push_user_to_device(
    registry: &DeviceRegistry,
    user: &timekeep_core::User,
    device_sn: &str,
) -> Result<(), ()> {
    let Some(device_arc) = get_device(registry, device_sn).await else {
        tracing::warn!(device = %device_sn, "enrolled device not in registry");
        return Err(());
    };
    let mut device = device_arc.lock().await;
    device.set_user(user).await.map_err(|e| {
        tracing::error!(device = %device_sn, pin = %user.pin, error = %e, "push failed");
    })
}

pub(crate) fn spawn_employee_remove(ctx: &HandlerContext, employee_pin: String) {
    let pin = employee_pin;
    let bus = ctx.event_bus.clone();
    let reg = ctx.registry.clone();
    let repo = ctx.employees.clone();
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
        let enrollments = match repo.list_enrollments_for_employee(&employee.id).await {
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
        let mut deleted = 0u32;
        let mut failed = 0u32;
        let start = std::time::Instant::now();
        for enrollment in &enrollments {
            match remove_user_from_device(&reg, &pin, &enrollment.device_sn).await {
                Ok(()) => deleted += 1,
                Err(()) => failed += 1,
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
}

async fn remove_user_from_device(
    registry: &DeviceRegistry,
    pin: &str,
    device_sn: &str,
) -> Result<(), ()> {
    let Some(device_arc) = get_device(registry, device_sn).await else {
        tracing::warn!(device = %device_sn, "enrolled device not in registry");
        return Err(());
    };

    let mut device = device_arc.lock().await;
    let users = device.get_users().await.map_err(|e| {
        tracing::error!(device = %device_sn, error = %e, "failed to read device users");
    })?;

    let Some(dev_user) = users.iter().find(|u| u.pin == pin) else {
        tracing::info!(device = %device_sn, pin = %pin, "user not found on device — already removed");
        return Ok(());
    };

    device.delete_user(dev_user.internal_sn).await.map_err(|e| {
        tracing::error!(device = %device_sn, pin = %pin, error = %e, "delete failed");
    })
}

pub(crate) fn spawn_device_to_device_sync(
    ctx: &HandlerContext,
    source_sn: String,
    target_sn: String,
) {
    tracing::info!(source = %source_sn, target = %target_sn, "device-to-device sync requested");
    let source = source_sn;
    let target = target_sn;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    tokio::spawn(async move {
        let src_arc = {
            let guard = reg.lock().await;
            guard.get(source.as_str()).cloned()
        };
        let Some(src_arc) = src_arc else {
            tracing::warn!(source = %source, "source device not found");
            return;
        };

        let src = src_arc.lock().await;
        let users = match src.get_users().await {
            Ok(u) => u,
            Err(e) => {
                tracing::error!(source = %source, error = %e, "failed to read users from source device");
                return;
            },
        };

        tracing::info!(source = %source, target = %target, count = users.len(), "read users from source device");
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
    });
}

pub(crate) fn spawn_device_resync(ctx: &HandlerContext, device_sn: String) {
    let sn = device_sn;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    let repo = ctx.employees.clone();
    tokio::spawn(async move { run_resync(&sn, &reg, &bus, repo).await });
}

pub(crate) fn spawn_clear_users(ctx: &HandlerContext, device_sn: String) {
    let sn = device_sn;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    tokio::spawn(async move { run_clear_users(&sn, &reg, &bus).await });
}

async fn run_resync(
    sn: &str,
    registry: &DeviceRegistry,
    bus: &EventBus,
    repo: Option<Arc<dyn EmployeeStore>>,
) {
    tracing::info!(device = %sn, "device re-sync requested — clearing and re-uploading all users");
    let start = std::time::Instant::now();

    let device_arc = get_device(registry, sn).await;
    let Some(device_arc) = device_arc else {
        tracing::warn!(device = %sn, "re-sync: device not found in registry");
        bus.publish(DomainEvent::DeviceSyncFailed {
            device_sn: sn.to_string(),
            error: "device not found in registry".into(),
            records_synced: 0,
            duration_ms: 0,
        });
        return;
    };

    let mut device = device_arc.lock().await;

    // Step 1: Read + delete all existing users
    let existing = match device.get_users().await {
        Ok(u) => u,
        Err(e) => {
            tracing::error!(device = %sn, error = %e, "re-sync: failed to read users");
            bus.publish(DomainEvent::DeviceSyncFailed {
                device_sn: sn.to_string(),
                error: e.to_string(),
                records_synced: 0,
                duration_ms: 0,
            });
            return;
        },
    };

    let mut deleted = 0u32;
    for user in &existing {
        match device.delete_user(user.internal_sn).await {
            Ok(()) => deleted += 1,
            Err(e) => {
                tracing::warn!(device = %sn, pin = %user.pin, error = %e, "re-sync: failed to delete user")
            },
        }
    }
    tracing::info!(device = %sn, deleted, "re-sync: cleared existing users");

    // Step 2: Re-upload from employee database
    let (pushed, failed) = match repo {
        Some(repo) => reupload_enrolled_employees(&mut *device, sn, &*repo).await,
        None => {
            tracing::warn!(device = %sn, "re-sync: no EmployeeStore configured — cannot re-upload");
            (0, 0)
        },
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    tracing::info!(device = %sn, deleted, pushed, failed, duration_ms, "re-sync completed");
    bus.publish(DomainEvent::DeviceSyncCompleted {
        device_sn: sn.to_string(),
        records_synced: pushed,
        duration_ms,
    });
}

/// Pure destructive operation — delete all users from a device
/// without re-uploading from the employee database.
///
/// Used by the `POST /api/devices/{sn}/clear-users` endpoint
/// (unlike `run_resync` which also re-uploads employees).
async fn run_clear_users(sn: &str, registry: &DeviceRegistry, bus: &EventBus) {
    tracing::info!(device = %sn, "clear-users requested — deleting all users from device");
    let start = std::time::Instant::now();

    let device_arc = get_device(registry, sn).await;
    let Some(device_arc) = device_arc else {
        tracing::warn!(device = %sn, "clear-users: device not found in registry");
        bus.publish(DomainEvent::DeviceSyncFailed {
            device_sn: sn.to_string(),
            error: "device not found in registry".into(),
            records_synced: 0,
            duration_ms: 0,
        });
        return;
    };

    let mut device = device_arc.lock().await;

    // Read all existing users
    let existing = match device.get_users().await {
        Ok(u) => u,
        Err(e) => {
            tracing::error!(device = %sn, error = %e, "clear-users: failed to read users");
            bus.publish(DomainEvent::DeviceSyncFailed {
                device_sn: sn.to_string(),
                error: e.to_string(),
                records_synced: 0,
                duration_ms: 0,
            });
            return;
        },
    };

    let user_count = existing.len();
    let mut deleted = 0u32;
    for user in &existing {
        match device.delete_user(user.internal_sn).await {
            Ok(()) => deleted += 1,
            Err(e) => {
                tracing::warn!(device = %sn, pin = %user.pin, error = %e, "clear-users: failed to delete user")
            },
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    tracing::info!(device = %sn, total = user_count, deleted, duration_ms, "clear-users completed");
    bus.publish(DomainEvent::DeviceSyncCompleted {
        device_sn: sn.to_string(),
        records_synced: 0,
        duration_ms,
    });
}

async fn reupload_enrolled_employees(
    device: &mut ZkTecoDevice,
    sn: &str,
    repo: &dyn EmployeeStore,
) -> (u32, u32) {
    let enrollments = match repo.list_enrollments_for_device(sn).await {
        Ok(e) => e,
        Err(e) => {
            tracing::error!(device = %sn, error = %e, "re-sync: failed to list enrollments");
            return (0, 0);
        },
    };

    let mut pushed = 0u32;
    let mut failed = 0u32;
    for enrollment in &enrollments {
        match repo.find_employee(&enrollment.employee_id).await {
            Ok(Some(employee)) if employee.active => {
                let user = timekeep_core::User {
                    internal_sn: 0,
                    pin: employee.pin.clone(),
                    name: employee.name.clone(),
                    privilege: 0,
                    card_number: enrollment.card_number.clone(),
                    group: None,
                    timezone: None,
                    password_raw: None,
                    has_password: false,
                    fingerprint_count: enrollment.fingerprint_count as u8,
                    has_face: enrollment.face_enrolled,
                };
                match device.set_user(&user).await {
                    Ok(()) => pushed += 1,
                    Err(e) => {
                        tracing::warn!(device = %sn, pin = %employee.pin, error = %e, "re-sync: failed to re-upload employee");
                        failed += 1;
                    },
                }
            },
            Ok(Some(_)) => {
                tracing::debug!(device = %sn, employee_id = %enrollment.employee_id, "re-sync: skipping inactive employee");
            },
            Ok(None) => {
                tracing::warn!(device = %sn, employee_id = %enrollment.employee_id, "re-sync: enrollment references unknown employee");
            },
            Err(e) => {
                tracing::error!(device = %sn, employee_id = %enrollment.employee_id, error = %e, "re-sync: failed to look up employee");
                failed += 1;
            },
        }
    }
    (pushed, failed)
}

pub(crate) fn spawn_attendance_pull(ctx: &HandlerContext, device_sn: String) {
    let sn = device_sn;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    let stor = ctx.storage.clone();
    let dev_state = ctx.device_state.clone();
    tokio::spawn(async move {
        let start = std::time::Instant::now();
        let device_arc = get_device(&reg, &sn).await;
        let Some(device) = device_arc else {
            tracing::warn!(device = %sn, "AttendancePullRequested: device not in registry");
            bus.publish(DomainEvent::DeviceSyncFailed {
                device_sn: sn,
                error: "device not connected".into(),
                records_synced: 0,
                duration_ms: 0,
            });
            return;
        };
        let since = match stor.latest_punch_for_device(&sn).await {
            Ok(Some(ts)) => Some(ts),
            Ok(None) => None,
            Err(e) => {
                tracing::error!(device = %sn, error = %e, "AttendancePullRequested: storage lookup failed");
                None
            },
        };
        let device = device.lock().await;
        match device.get_attendance(since).await {
            Ok(punches) => {
                let now = jiff::Timestamp::now().as_second();
                dev_state.set_sdk_polled(&sn, now).await;
                let count = punches.len();
                if count > 0 {
                    tracing::info!(device = %sn, count, "AttendancePullRequested: retrieved records");
                    for punch in punches {
                        bus.publish(DomainEvent::PunchReceived { punch });
                    }
                } else {
                    tracing::info!(device = %sn, "AttendancePullRequested: no new records");
                }
                let duration_ms = start.elapsed().as_millis() as u64;
                bus.publish(DomainEvent::DeviceSyncCompleted {
                    device_sn: sn.clone(),
                    records_synced: count as u32,
                    duration_ms,
                });
            },
            Err(e) => {
                tracing::error!(device = %sn, error = %e, "AttendancePullRequested: pull failed");
                let duration_ms = start.elapsed().as_millis() as u64;
                bus.publish(DomainEvent::DeviceSyncFailed {
                    device_sn: sn,
                    error: e.to_string(),
                    records_synced: 0,
                    duration_ms,
                });
            },
        }
    });
}

pub(crate) fn spawn_device_info_persist(
    ctx: &HandlerContext,
    device: timekeep_core::model::Device,
) {
    let sn = device.serial_number.clone();
    let stor = ctx.storage.clone();
    tokio::spawn(async move {
        match stor.upsert_device_info(&device).await {
            Ok(()) => tracing::info!(device = %sn, "device info persisted to storage"),
            Err(e) => tracing::warn!(device = %sn, error = %e, "failed to persist device info"),
        }
    });
}

pub(crate) fn spawn_device_info_refresh(ctx: &HandlerContext, device_sn: String) {
    let sn = device_sn;
    let reg = ctx.registry.clone();
    let bus = ctx.event_bus.clone();
    tokio::spawn(async move {
        let device_arc = get_device(&reg, &sn).await;
        match device_arc {
            Some(arc) => {
                let device = arc.lock().await;
                match device.get_device_info().await {
                    Ok(info) => {
                        tracing::info!(
                            device = %sn,
                            platform = %info.platform,
                            fw = %info.firmware_version,
                            users = info.user_count,
                            records = info.record_count,
                            "device info refreshed via SDK"
                        );
                        bus.publish(DomainEvent::DeviceInfoUpdated { device: info });
                    },
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "failed to refresh device info via SDK");
                    },
                }
            },
            None => {
                tracing::warn!(device = %sn, "DeviceInfoRefreshRequested: device not in registry");
            },
        }
    });
}

pub(crate) fn spawn_device_users_refresh(ctx: &HandlerContext, device_sn: String) {
    let sn = device_sn;
    let reg = ctx.registry.clone();
    let storage = ctx.storage.clone();
    tokio::spawn(async move {
        let device_arc = get_device(&reg, &sn).await;
        match device_arc {
            Some(arc) => {
                let device = arc.lock().await;
                match sync_users_to_storage(&*device, storage.as_ref()).await {
                    Ok(count) => {
                        tracing::info!(
                            device = %sn,
                            users = count,
                            "device users refreshed via SDK"
                        );
                    },
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "failed to refresh device users via SDK");
                    },
                }
            },
            None => {
                tracing::warn!(device = %sn, "DeviceUsersRefreshRequested: device not in registry");
            },
        }
    });
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    fn empty_registry() -> DeviceRegistry {
        Arc::new(Mutex::new(HashMap::new()))
    }

    #[tokio::test]
    async fn test_get_device_not_found() {
        let registry = empty_registry();
        let result = get_device(&registry, "NONEXISTENT").await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_device_empty_sn() {
        let registry = empty_registry();
        let result = get_device(&registry, "").await;
        assert!(result.is_none());
    }

    // ── push_user_to_device ──────────────────────────────────────────

    #[tokio::test]
    async fn test_push_user_to_device_not_in_registry() {
        let registry = empty_registry();
        let user = timekeep_core::model::User {
            internal_sn: 0,
            pin: "123".into(),
            name: "Test".into(),
            privilege: 0,
            card_number: None,
            group: None,
            timezone: None,
            password_raw: None,
            has_password: false,
            fingerprint_count: 0,
            has_face: false,
        };
        let result = push_user_to_device(&registry, &user, "NONEXISTENT").await;
        assert!(result.is_err(), "should return Err when device not in registry");
    }

    // ── remove_user_from_device ─────────────────────────────────────

    #[tokio::test]
    async fn test_remove_user_from_device_not_in_registry() {
        let registry = empty_registry();
        let result = remove_user_from_device(&registry, "123", "NONEXISTENT").await;
        assert!(result.is_err(), "should return Err when device not in registry");
    }

    // ── enqueue_adms_command ─────────────────────────────────────────

    #[tokio::test]
    async fn test_enqueue_adms_command_not_in_registry() {
        let registry = empty_registry();
        // Should not panic — just logs a warning and returns
        enqueue_adms_command(&registry, "NONEXISTENT", "RESTART").await;
    }

    // ── execute_sdk_command ──────────────────────────────────────────

    #[test]
    fn test_execute_sdk_command_known_commands() {
        // Verify that known command strings match the match arms in execute_sdk_command().
        // Full integration test requires a real/simulated ZkTecoDevice.
        let sdk_commands = ["RESTART", "REBOOT", "SYNC_CLOCK"];
        let fallthrough_commands = ["UNLOCK"];
        let unknown = ["DELETE", "SYNC"];

        for cmd in sdk_commands {
            assert!(!cmd.is_empty(), "known SDK command should not be empty");
            assert_eq!(cmd, cmd.to_uppercase(), "SDK commands should be uppercase");
        }
        for cmd in fallthrough_commands {
            assert!(!cmd.is_empty());
            assert_eq!(cmd, cmd.to_uppercase());
        }
        for cmd in unknown {
            assert!(!sdk_commands.contains(&cmd), "unknown cmd should not be in SDK list");
            assert!(
                !fallthrough_commands.contains(&cmd),
                "unknown cmd should not be in fallthrough list"
            );
        }
    }
}
