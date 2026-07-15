//! Full-text search store — abstraction over the search index.
//!
//! This trait follows the Store decomposition pattern (ADR-001).
//! Implementations back the search index with Tantivy (embedded),
//! Meilisearch (standalone), or a simple no-op for deployments
//! that don't need full-text search.
//!
//! # Warm-up / Cold Start
//!
//! On first launch (or when the index directory is missing), the index
//! is empty. Implementors should provide a `rebuild` method that the
//! application calls during startup to populate the index from the
//! primary database.

use async_trait::async_trait;

use crate::Error;
use crate::model::employee::Employee;
use crate::model::employee::EmployeeId;
use crate::model::punch::AttendancePunch;
use crate::query::search::{SearchQuery, SearchResults};

/// Full-text search operations.
///
/// # Concurrency
///
/// All methods are `&self` (not `&mut self`) — implementations must
/// use internal synchronization (e.g., `Arc<RwLock<IndexWriter>>`).
///
/// # Consistency
///
/// The index is **eventually consistent** with the primary database.
/// Writes go to the database first, then the index is updated
/// asynchronously via domain events. Reads may briefly return stale
/// data (typically < 1ms window).
#[async_trait]
pub trait SearchStore: Send + Sync {
    /// Execute a full-text search query.
    ///
    /// If `query.entity_type` is set, only results of that type are
    /// returned. Otherwise, all indexable entity types are searched.
    async fn search(&self, query: &SearchQuery) -> Result<SearchResults, Error>;

    /// Index or update an employee in the search index.
    ///
    /// Called after `EmployeeCreated` or when employee metadata changes.
    async fn index_employee(&self, employee: &Employee) -> Result<(), Error>;

    /// Remove an employee from the search index.
    ///
    /// Called after `EmployeeDeactivated`.
    async fn delete_employee(&self, id: &EmployeeId) -> Result<(), Error>;

    /// Rebuild the entire employee index from the database.
    ///
    /// This is a potentially expensive operation — it clears the index
    /// and re-indexes every active employee. Call during startup or
    /// after manual index corruption.
    async fn rebuild_employees(&self, employees: &[Employee]) -> Result<(), Error>;

    /// Check if the search index is healthy (readable).
    async fn health_check(&self) -> Result<(), Error>;

    // ── Punch indexing ─────────────────────────────────────────────

    /// Index a single attendance punch.
    ///
    /// Called after `PunchReceived` or `PunchesBatchReceived` events.
    /// Punches are indexed with user_pin, employee_name, device_sn,
    /// device_label, and status for full-text search.
    async fn index_punch(&self, punch: &AttendancePunch) -> Result<(), Error>;

    /// Rebuild the entire punch index from the database.
    ///
    /// Punches are high-volume — implementations should batch-commit
    /// periodically to avoid memory pressure.
    async fn rebuild_punches(&self, punches: &[AttendancePunch]) -> Result<(), Error>;
}
