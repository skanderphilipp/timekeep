//! Outbox worker — background task that retries failed distributor deliveries.
//!
//! Periodically queries the `pending_deliveries` table for records that are
//! ready for retry, attempts delivery through the appropriate distributor,
//! and updates the record with backoff scheduling or moves it to dead letter.
//!
//! ## Backoff Schedule
//!
//! Attempt 1:  30s (scheduled by enqueue)
//! Attempt 2:  60s
//! Attempt 3: 120s
//! Attempt 4: 300s  (5 min)
//! Attempt 5: 600s  (10 min)
//! Attempt 6: 1800s (30 min)
//!
//! After 6 failures → moved to `dead_letter_deliveries` for manual inspection.

use std::sync::Arc;
use std::time::Duration;
use timekeep_core::traits::storage::Storage;
use timekeep_core::{events::DomainEvent, model::AttendancePunch, model::PendingDelivery};
use timekeep_engine::distribution::DistributorHandle;

/// Background task that retries failed distributor deliveries.
///
/// Runs every 15 seconds, picks up all pending deliveries whose
/// `next_retry_at` has elapsed, and attempts to re-deliver them.
pub async fn run_outbox_worker(
    storage: Arc<dyn Storage>,
    distributor_handles: Arc<Vec<DistributorHandle>>,
) {
    let interval = Duration::from_secs(15);
    tracing::info!("outbox worker started (poll interval: 15s)");

    loop {
        tokio::time::sleep(interval).await;

        match storage.list_pending_deliveries().await {
            Ok(deliveries) => {
                if deliveries.is_empty() {
                    continue;
                }
                tracing::debug!(
                    count = deliveries.len(),
                    "outbox: pending deliveries ready for retry"
                );
                for delivery in &deliveries {
                    process_delivery(&storage, &distributor_handles, delivery).await;
                }
            },
            Err(e) => {
                tracing::error!(error = %e, "outbox: failed to query pending deliveries");
            },
        }
    }
}

/// Attempt to re-deliver a single pending delivery.
async fn process_delivery(
    storage: &Arc<dyn Storage>,
    handles: &[DistributorHandle],
    delivery: &PendingDelivery,
) {
    // Parse the stored punch from JSON
    let punch: AttendancePunch = match serde_json::from_str(&delivery.event_json) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(
                delivery_id = %delivery.id,
                error = %e,
                "outbox: malformed event JSON, moving to dead letter"
            );
            let _ = storage
                .move_to_dead_letter(&delivery.id, Some(&format!("malformed JSON: {e}")))
                .await;
            return;
        },
    };

    let event = DomainEvent::PunchReceived { punch };

    // Attempt delivery on all matching distributors
    let mut delivered = false;
    for handle in handles {
        match handle.distributor.on_event(&event).await {
            Ok(()) => {
                delivered = true;
                break;
            },
            Err(e) => {
                tracing::warn!(
                    delivery_id = %delivery.id,
                    distributor = handle.distributor.name(),
                    error = %e,
                    "outbox: retry delivery failed"
                );
            },
        }
    }

    if delivered {
        // Success — remove from pending
        if let Err(e) = storage.delete_pending_delivery(&delivery.id).await {
            tracing::error!(
                delivery_id = %delivery.id,
                error = %e,
                "outbox: failed to delete delivered record"
            );
        } else {
            tracing::info!(
                delivery_id = %delivery.id,
                attempts = delivery.attempt_count + 1,
                "outbox: delivery succeeded on retry"
            );
        }
    } else {
        // Failure — schedule next retry or move to dead letter
        let mut updated = delivery.clone();
        match updated.schedule_next_retry() {
            Some(next_at) => {
                if let Err(e) = storage
                    .update_delivery_retry(&delivery.id, updated.attempt_count, next_at)
                    .await
                {
                    tracing::error!(
                        delivery_id = %delivery.id,
                        error = %e,
                        "outbox: failed to update retry schedule"
                    );
                } else {
                    tracing::warn!(
                        delivery_id = %delivery.id,
                        attempt = updated.attempt_count,
                        next_retry_in_secs = next_at - jiff::Timestamp::now().as_second(),
                        "outbox: delivery failed, scheduled next retry"
                    );
                }
            },
            None => {
                // Exhausted all retries — move to dead letter
                tracing::error!(
                    delivery_id = %delivery.id,
                    attempts = delivery.attempt_count,
                    "outbox: max retries exhausted, moving to dead letter"
                );
                if let Err(e) =
                    storage.move_to_dead_letter(&delivery.id, Some("max retries exhausted")).await
                {
                    tracing::error!(
                        delivery_id = %delivery.id,
                        error = %e,
                        "outbox: failed to move to dead letter"
                    );
                }
            },
        }
    }
}
