//! Persistence for the outbox — pending deliveries awaiting retry.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! When a distributor fails to deliver an event (e.g., Odoo is unreachable),
//! the event is enqueued here. A background worker retries with exponential
//! backoff. Exhausted deliveries move to a dead letter queue.

use async_trait::async_trait;

use crate::Error;
use crate::model::pending_delivery::PendingDelivery;

/// Persists and queries outbox entries for failed event deliveries.
#[async_trait]
pub trait OutboxStore: Send + Sync {
    /// Enqueue a punch delivery that failed to reach an external system.
    /// The worker will pick this up and retry with exponential backoff.
    async fn enqueue_pending_delivery(&self, _delivery: &PendingDelivery) -> Result<(), Error> {
        Err(Error::storage("outbox not implemented for this backend"))
    }

    /// List pending deliveries that are ready for retry (next_retry_at <= now).
    /// Ordered by next_retry_at ascending.
    async fn list_pending_deliveries(&self) -> Result<Vec<PendingDelivery>, Error> {
        Ok(vec![])
    }

    /// Update the attempt count and next_retry_at for a pending delivery.
    async fn update_delivery_retry(
        &self,
        _id: &str,
        _attempt_count: i32,
        _next_retry_at: i64,
    ) -> Result<(), Error> {
        Ok(())
    }

    /// Delete a pending delivery after successful delivery.
    async fn delete_pending_delivery(&self, _id: &str) -> Result<(), Error> {
        Ok(())
    }

    /// Move a delivery that has exhausted retries to the dead letter table.
    async fn move_to_dead_letter(&self, _id: &str, _last_error: Option<&str>) -> Result<(), Error> {
        Ok(())
    }
}
