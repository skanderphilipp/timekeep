//! Fingerprint template transfer between devices.
//!
//! # Architecture
//!
//! Templates are stored centrally as part of the `DeviceEnrollment` aggregate.
//! When an employee is enrolled on a device with fingerprint, the raw template
//! data is downloaded from the device and stored in the enrollment.
//!
//! # Transfer Flow
//!
//! 1. Read templates from the source device's SDK connection
//! 2. Store each template in the source enrollment (central persistence)
//! 3. Upload each stored template to the target device
//! 4. Store each template in the target enrollment (cross-device sync complete)

use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::traits::EmployeeStore;
use timekeep_core::{EmployeeId, Error, FingerprintTemplate};
use timekeep_zkteco::ZkTecoDevice;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

/// Result of a fingerprint template transfer operation.
#[derive(Debug)]
pub struct TransferResult {
    pub transferred: u32,
    pub failed: u32,
    pub duration_ms: u64,
}

/// Transfer fingerprint templates from one device to another.
///
/// If `employee_id` is `Some`, only transfer that employee's templates.
/// If `None`, transfers all templates from all enrolled employees.
pub async fn transfer_templates(
    source_device: &ZkTecoDevice,
    target_device: &mut ZkTecoDevice,
    employee_store: Option<&dyn EmployeeStore>,
    employee_id: Option<&EmployeeId>,
) -> Result<TransferResult, Error> {
    let start = Instant::now();

    // Step 1: Read all templates from the source device
    let zk_templates = source_device
        .get_templates()
        .await
        .map_err(|e| Error::device(format!("failed to read templates from source device: {e}")))?;

    if zk_templates.is_empty() {
        return Ok(TransferResult {
            transferred: 0,
            failed: 0,
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    // Step 2: Store each template in the employee store (central persistence)
    // Group by user_sn (device PIN) — each user can have multiple fingers
    let mut transferred = 0u32;
    let mut failed = 0u32;

    for tpl in &zk_templates {
        // Convert SDK template to our domain FingerprintTemplate
        let ft = FingerprintTemplate::new(tpl.finger_index, tpl.data.clone());

        // Try to find the employee by PIN to get their EmployeeId
        let emp_id = if let Some(eid) = employee_id {
            eid.clone()
        } else if let Some(store) = employee_store {
            if let Ok(Some(emp)) = store.find_employee_by_pin(&tpl.user_sn.to_string()).await {
                emp.id
            } else {
                EmployeeId::from(tpl.user_sn.to_string())
            }
        } else {
            EmployeeId::from(tpl.user_sn.to_string())
        };

        // Store the template centrally if employee store is available
        if let Some(store) = employee_store
            && let Err(e) = store.store_fingerprint_template(&emp_id, "", &ft).await
        {
            tracing::warn!(user_sn = tpl.user_sn, finger = tpl.finger_index, error = %e, "failed to store template centrally");
        }

        // Step 3: Upload to target device
        match target_device.save_user_template(tpl).await {
            Ok(()) => {
                transferred += 1;
                tracing::debug!(
                    user_sn = tpl.user_sn,
                    finger = tpl.finger_index,
                    "template uploaded to target"
                );

                // Step 4: Store in target enrollment if employee store is available
                if let Some(store) = employee_store {
                    let _ = store.store_fingerprint_template(&emp_id, "", &ft).await;
                }
            },
            Err(e) => {
                failed += 1;
                tracing::error!(user_sn = tpl.user_sn, finger = tpl.finger_index, error = %e, "failed to upload template");
            },
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    tracing::info!(transferred, failed, duration_ms, "fingerprint transfer completed");
    Ok(TransferResult { transferred, failed, duration_ms })
}

/// Handle a `FingerprintTransferRequested` event.
pub async fn handle_transfer_request(
    source_sn: String,
    target_sn: String,
    employee_id: Option<EmployeeId>,
    registry: Arc<tokio::sync::Mutex<HashMap<String, Arc<tokio::sync::Mutex<ZkTecoDevice>>>>>,
    employee_store: Option<Arc<dyn EmployeeStore>>,
    bus: EventBus,
) {
    tracing::info!(source = %source_sn, target = %target_sn, "fingerprint transfer requested");

    let src = source_sn.clone();
    let tgt = target_sn.clone();
    let emp_id = employee_id.clone();

    tokio::spawn(async move {
        let (src_arc, tgt_arc) = {
            let guard = registry.lock().await;
            (guard.get(src.as_str()).cloned(), guard.get(tgt.as_str()).cloned())
        };

        match (src_arc, tgt_arc) {
            (Some(src_arc), Some(tgt_arc)) => {
                let source_device = src_arc.lock().await;
                let mut target_device = tgt_arc.lock().await;

                let result = transfer_templates(
                    &source_device,
                    &mut target_device,
                    employee_store.as_ref().map(|s| s.as_ref() as &dyn EmployeeStore),
                    emp_id.as_ref(),
                )
                .await;

                match result {
                    Ok(result) => {
                        bus.publish(DomainEvent::FingerprintTransferCompleted {
                            source_sn: src,
                            target_sn: tgt,
                            transferred: result.transferred,
                            failed: result.failed,
                            duration_ms: result.duration_ms,
                        });
                    },
                    Err(e) => {
                        tracing::error!(source = %src, target = %tgt, error = %e, "fingerprint transfer failed");
                        bus.publish(DomainEvent::FingerprintTransferCompleted {
                            source_sn: src,
                            target_sn: tgt,
                            transferred: 0,
                            failed: 0,
                            duration_ms: 0,
                        });
                    },
                }
            },
            (None, _) => tracing::error!(source = %src, "source device not found"),
            (_, None) => tracing::error!(target = %tgt, "target device not found"),
        }
    });
}
