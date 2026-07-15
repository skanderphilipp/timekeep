//! Search indexer — keeps the Tantivy index in sync with domain events.
//!
//! This is a background task that subscribes to the [`EventBus`] and reacts
//! to `EmployeeCreated`, `EmployeeUpdated`, `EmployeeDeactivated`, and
//! `PunchReceived` events to keep the search index eventually consistent
//! with the database.
//!
//! ## Startup
//!
//! On application startup, the indexer performs a full rebuild of the
//! employee index from the database. After that, it switches to event-driven
//! incremental updates.

use std::sync::Arc;

use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use timekeep_core::events::DomainEvent;
use timekeep_core::{EmployeeStore, Error, SearchStore};

/// Background worker that keeps the search index in sync.
pub struct SearchIndexer {
    search: Arc<dyn SearchStore>,
    employees: Arc<dyn EmployeeStore>,
    event_rx: broadcast::Receiver<Arc<DomainEvent>>,
}

impl SearchIndexer {
    /// Create a new search indexer.
    ///
    /// `event_rx` should be obtained from `EventBus::subscribe()`.
    pub fn new(
        search: Arc<dyn SearchStore>,
        employees: Arc<dyn EmployeeStore>,
        event_rx: broadcast::Receiver<Arc<DomainEvent>>,
    ) -> Self {
        Self { search, employees, event_rx }
    }

    /// Bootstrap: rebuild the full employee index from the database,
    /// then switch to incremental event-driven updates.
    pub async fn run(mut self) {
        info!("SearchIndexer: starting bootstrap…");

        if let Err(e) = self.bootstrap_employees().await {
            error!(%e, "SearchIndexer: bootstrap failed — continuing with event-driven updates");
        }

        info!("SearchIndexer: bootstrap complete, listening for events");

        loop {
            match self.event_rx.recv().await {
                Ok(event) => {
                    if let Err(e) = self.handle_event(&event).await {
                        error!(%e, event_type = %event.event_type(), "SearchIndexer: failed to handle event");
                    }
                },
                Err(broadcast::error::RecvError::Lagged(skipped)) => {
                    warn!(skipped, "SearchIndexer: lagging behind event bus — rebuilding index");
                    if let Err(e) = self.bootstrap_employees().await {
                        error!(%e, "SearchIndexer: rebuild after lag failed");
                    }
                },
                Err(broadcast::error::RecvError::Closed) => {
                    info!("SearchIndexer: event bus closed — shutting down");
                    break;
                },
            }
        }
    }

    /// Rebuild the full employee search index from the database.
    async fn bootstrap_employees(&self) -> Result<(), Error> {
        let params = timekeep_core::ListParams { limit: 10_000, ..Default::default() };
        let result = self.employees.list_employees(&params).await?;
        self.search.rebuild_employees(&result.items).await
    }

    /// Handle a single domain event.
    async fn handle_event(&self, event: &DomainEvent) -> Result<(), Error> {
        match event {
            DomainEvent::EmployeeCreated { pin, name, .. } => {
                // Fetch the full employee record by PIN
                if let Some(emp) = self.employees.find_employee_by_pin(pin).await? {
                    self.search.index_employee(&emp).await?;
                    debug!(%pin, %name, "SearchIndexer: employee indexed");
                } else {
                    warn!(%pin, "SearchIndexer: EmployeeCreated but employee not found in DB");
                }
            },
            DomainEvent::EmployeeUpdated { id, .. } => {
                // Fetch the full employee record by ID
                let emp_id = timekeep_core::EmployeeId::from(id.as_str());
                if let Some(emp) = self.employees.find_employee(&emp_id).await? {
                    self.search.index_employee(&emp).await?;
                    debug!(%id, "SearchIndexer: employee updated in index");
                } else {
                    warn!(%id, "SearchIndexer: EmployeeUpdated but employee not found in DB");
                }
            },
            DomainEvent::EmployeeDeactivated { pin } => {
                // We don't remove from the index on deactivation — just mark inactive.
                // The employee is still findable but filtered by the API layer.
                // TODO(ENTERPRISE): Consider adding an `active` field to the schema
                //                   and using it as a filter in the search query.
                debug!(%pin, "SearchIndexer: employee deactivated (keeping in index)");
                let _ = pin;
            },
            DomainEvent::PunchReceived { punch } => {
                self.search.index_punch(punch).await?;
                debug!(
                    punch_id = %punch.id,
                    user_pin = %punch.user_pin,
                    "SearchIndexer: punch indexed"
                );
            },
            DomainEvent::PunchesBatchReceived { device_sn, count } => {
                debug!(
                    %device_sn,
                    %count,
                    "SearchIndexer: batch punch received (punches indexed individually via PunchReceived)"
                );
                // PunchesBatchReceived carries a count summary, not the punches themselves.
                // Individual PunchReceived events are published for each punch in the batch,
                // so we don't need to do anything here — each punch is indexed separately.
                let _ = (device_sn, count);
            },
            _ => {
                // Not an employee or punch event — ignore
            },
        }
        Ok(())
    }
}
