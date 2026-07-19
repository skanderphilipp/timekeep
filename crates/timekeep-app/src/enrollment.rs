//! Fingerprint enrollment handler.
//!
//! Consumes `FingerprintEnrollRequested` events from the event bus,
//! connects to the target device via SDK, performs the interactive
//! fingerprint enrollment (3-sample capture loop), downloads the
//! template, stores it centrally, and publishes result events.
//!
//! # Enrollment Flow
//!
//! ```
//! FingerprintEnrollRequested
//!   -> enable_realtime()              // start receiving device events
//!   -> enroll_user()                  // CMD_STARTENROLL + 3-sample loop
//!   -> (FingerprintEnrollProgress)*   // live SSE events: sample scores
//!   -> get_user_template()            // download raw template
//!   -> store_fingerprint_template     // persist centrally (EmployeeStore)
//!   -> FingerprintEnrolled            // success event
//! ```
//!
//! # Constraints
//!
//! - Requires an active SDK connection (TCP port 4370). ADMS cannot do
//!   interactive enrollment - the protocol requires a stateful session.
//! - The device mutex is held for the entire enrollment (typically 10-30s).
//!   No other operations can run on this device during enrollment.
//! - The employee must physically interact with the device (place finger
//!   three times). Progress events are published to the event bus for
//!   SSE streaming to the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::traits::EmployeeStore;
use timekeep_core::{BiometricDevice, FingerprintTemplate};
use timekeep_zkteco::ZkTecoDevice;
use timekeep_zkteco::sdk::event::RealTimeEvent;
use tokio::sync::Mutex;

/// Handle a `FingerprintEnrollRequested` event.
///
/// Spawns a background task that performs the full enrollment pipeline.
/// The handler returns immediately after spawning so the event loop
/// is not blocked. Progress events are published to the event bus
/// during the capture loop for SSE streaming to the frontend.
pub async fn handle_enroll_request(
    device_sn: String,
    user_pin: String,
    finger_index: u8,
    registry: Arc<Mutex<HashMap<String, Arc<Mutex<ZkTecoDevice>>>>>,
    employee_store: Option<Arc<dyn EmployeeStore>>,
    bus: EventBus,
) {
    tracing::info!(
        device = %device_sn,
        pin = %user_pin,
        finger = finger_index,
        "fingerprint enrollment requested"
    );

    // Look up the device
    let device_arc = {
        let guard = registry.lock().await;
        guard.get(&device_sn).cloned()
    };

    let device_arc = match device_arc {
        Some(d) => d,
        None => {
            tracing::error!(device = %device_sn, "enrollment: device not found in registry");
            bus.publish(DomainEvent::FingerprintEnrollFailed {
                device_sn: device_sn.clone(),
                user_pin: user_pin.clone(),
                finger_index,
                reason: "device not found in registry".into(),
            });
            return;
        },
    };

    // Spawn enrollment in a background task so:
    // 1. The event loop is not blocked
    // 2. Progress events can be published concurrently during the capture loop
    let sn = device_sn.clone();
    let pin = user_pin.clone();
    let progress_bus = bus.clone();
    let result_bus = bus.clone();
    let store = employee_store.clone();

    tokio::spawn(async move {
        let mut device = device_arc.lock().await;

        // Enable real-time events
        if let Err(e) = device.enable_realtime().await {
            tracing::error!(device = %sn, error = %e, "failed to enable real-time events");
            result_bus.publish(DomainEvent::FingerprintEnrollFailed {
                device_sn: sn.clone(),
                user_pin: pin.clone(),
                finger_index,
                reason: format!("failed to enable real-time events: {e}"),
            });
            return;
        }

        // Create an event channel for enrollment observation.
        // The SDK forwards events here; we publish them to the bus for SSE.
        let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel();

        // Spawn a task that forwards finger score events to the event bus.
        // This runs concurrently with enroll_user() so progress is live.
        let forward_sn = sn.clone();
        let forward_pin = pin.clone();
        let forward_bus = progress_bus.clone();
        let forward_handle = tokio::spawn(async move {
            let mut sample: u8 = 0;
            while let Some(event) = event_rx.recv().await {
                match event {
                    RealTimeEvent::FingerScore { score } => {
                        sample = sample.saturating_add(1);
                        let status = if score >= 100 { "good" } else { "retry" };
                        forward_bus.publish(DomainEvent::FingerprintEnrollProgress {
                            device_sn: forward_sn.clone(),
                            user_pin: forward_pin.clone(),
                            finger_index,
                            sample,
                            score,
                            status: status.into(),
                            template_size: None,
                        });
                        tracing::debug!(
                            device = %forward_sn,
                            pin = %forward_pin,
                            sample,
                            score,
                            "finger score"
                        );
                    },
                    RealTimeEvent::Finger => {
                        tracing::debug!(device = %forward_sn, "finger detected");
                    },
                    _ => {
                        tracing::debug!(device = %forward_sn, ?event, "enrollment event");
                    },
                }
            }
        });

        // Perform enrollment (3-sample capture loop)
        let enroll_result = device.enroll_user(&pin, finger_index, 0, &event_tx).await;

        // Stop the event forwarding task
        forward_handle.abort();

        match enroll_result {
            Ok(()) => {
                tracing::info!(device = %sn, pin = %pin, finger = finger_index, "enrollment OK, downloading template");

                // Publish progress: enrolled
                progress_bus.publish(DomainEvent::FingerprintEnrollProgress {
                    device_sn: sn.clone(),
                    user_pin: pin.clone(),
                    finger_index,
                    sample: 3,
                    score: 100,
                    status: "enrolled".into(),
                    template_size: None,
                });

                // Find the user's internal serial number
                let users = match device.get_users().await {
                    Ok(u) => u,
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "enrollment OK but failed to query users");
                        result_bus.publish(DomainEvent::FingerprintEnrollFailed {
                            device_sn: sn.clone(),
                            user_pin: pin.clone(),
                            finger_index,
                            reason: format!("enrollment succeeded but failed to query users: {e}"),
                        });
                        return;
                    },
                };

                let user_sn = match users.iter().find(|u| u.pin == pin) {
                    Some(u) => u.internal_sn,
                    None => {
                        tracing::warn!(device = %sn, pin = %pin, "enrollment OK but user not in device list");
                        result_bus.publish(DomainEvent::FingerprintEnrolled {
                            device_sn: sn,
                            user_pin: pin,
                            finger_index,
                            template_size: 0,
                        });
                        return;
                    },
                };

                // Download the captured template
                let template = match device.get_user_template(user_sn, finger_index).await {
                    Ok(Some(tpl)) => tpl,
                    Ok(None) => {
                        tracing::warn!(device = %sn, pin = %pin, "template not found on device");
                        result_bus.publish(DomainEvent::FingerprintEnrolled {
                            device_sn: sn,
                            user_pin: pin,
                            finger_index,
                            template_size: 0,
                        });
                        return;
                    },
                    Err(e) => {
                        tracing::error!(device = %sn, error = %e, "failed to download template");
                        result_bus.publish(DomainEvent::FingerprintEnrollFailed {
                            device_sn: sn.clone(),
                            user_pin: pin.clone(),
                            finger_index,
                            reason: format!("download failed: {e}"),
                        });
                        return;
                    },
                };

                let template_size = template.data.len();

                // Store template centrally for cross-device transfer
                if let Some(store) = &store {
                    if let Ok(Some(employee)) = store.find_employee_by_pin(&pin).await {
                        let ft = FingerprintTemplate::new(finger_index, template.data.clone());
                        if let Err(e) =
                            store.store_fingerprint_template(&employee.id, &sn, &ft).await
                        {
                            tracing::error!(device = %sn, pin = %pin, error = %e, "failed to store template centrally");
                        } else {
                            tracing::info!(device = %sn, pin = %pin, finger = finger_index, template_bytes = template_size, "template stored centrally");
                            result_bus.publish(DomainEvent::FingerprintTemplateBackedUp {
                                device_sn: sn.clone(),
                                user_pin: pin.clone(),
                                finger_index,
                                storage_location: format!(
                                    "central://templates/{}/{}",
                                    employee.id, finger_index
                                ),
                            });
                        }
                    }
                }

                // Publish success
                result_bus.publish(DomainEvent::FingerprintEnrolled {
                    device_sn: sn,
                    user_pin: pin,
                    finger_index,
                    template_size,
                });
            },
            Err(e) => {
                tracing::error!(device = %sn, pin = %pin, finger = finger_index, error = %e, "enrollment failed");
                progress_bus.publish(DomainEvent::FingerprintEnrollProgress {
                    device_sn: sn.clone(),
                    user_pin: pin.clone(),
                    finger_index,
                    sample: 0,
                    score: 0,
                    status: "failed".into(),
                    template_size: None,
                });
                result_bus.publish(DomainEvent::FingerprintEnrollFailed {
                    device_sn: sn,
                    user_pin: pin,
                    finger_index,
                    reason: format!("{e}"),
                });
            },
        }
    });
}
