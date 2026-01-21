use async_trait::async_trait;

use crate::Error;
use crate::events::DomainEvent;

/// Distribution layer — delivers events to external systems.
///
/// This is separate from [`Storage`](crate::traits::storage::Storage).
/// Storage persists data. Distribution notifies external systems.
///
/// Implementations include:
/// - Webhook (POST JSON to any URL)
/// - Odoo (XML-RPC to Odoo HR module)
/// - MQTT (publish to IoT broker for real-time dashboard)
/// - CSV file (batch export for payroll)
#[async_trait]
pub trait Distributor: Send + Sync {
    /// Handle a domain event.
    async fn on_event(&self, event: &DomainEvent) -> Result<(), Error>;

    /// Human-readable name for logging.
    fn name(&self) -> &str;
}
