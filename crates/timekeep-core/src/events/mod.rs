pub mod domain_events;

use std::sync::Arc;
use tokio::sync::broadcast;

pub use domain_events::DomainEvent;

/// In-process event bus using `tokio::sync::broadcast`.
///
/// For the scale of this system (~200 events/day), an external
/// message broker is overkill. The broadcast channel gives every
/// subscriber a copy of each event with bounded memory.
///
/// If multi-node deployment is ever needed, swap this implementation
/// for an `EventBus` that publishes to NATS or Kafka behind the same
/// trait — no consumer code changes.
#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<Arc<DomainEvent>>,
}

impl EventBus {
    /// Create a new event bus with the given buffer capacity.
    /// Events beyond the capacity are dropped (oldest first).
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    /// Publish an event to all subscribers.
    /// Returns the number of subscribers that received the event.
    pub fn publish(&self, event: DomainEvent) -> usize {
        self.tx.send(Arc::new(event)).unwrap_or(0)
    }

    /// Subscribe to all events.
    pub fn subscribe(&self) -> broadcast::Receiver<Arc<DomainEvent>> {
        self.tx.subscribe()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        // 1024 events buffer = ~5 days of punches at 200/day
        Self::new(1024)
    }
}
