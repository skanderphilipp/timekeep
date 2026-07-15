//! Persistence for audit logs and device lifecycle events.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Audit logs track user actions (who did what, when). Device events track
//! scanner lifecycle (online, offline, sync started, error). Both are append-only
//! event streams queried for activity timelines.

use async_trait::async_trait;

use crate::Error;
use crate::model::audit::{AuditEvent, AuditFilter};
use crate::model::device_event::DeviceEvent;
use crate::query::ListResult;
use crate::query::filters::DeviceEventFilter;

/// Persists and queries audit log entries and device lifecycle events.
#[async_trait]
pub trait AuditLogStore: Send + Sync {
    /// Record an audit event.
    async fn record_audit(&self, _event: &AuditEvent) -> Result<(), Error> {
        Ok(()) // default: silently drop (non-critical path)
    }

    /// Query audit logs with filter, sort, and pagination.
    async fn query_audit_logs(
        &self,
        _filter: &AuditFilter,
    ) -> Result<ListResult<AuditEvent>, Error> {
        Ok(ListResult::single_page(vec![]))
    }

    /// Record a device lifecycle event for the activity timeline.
    ///
    /// Unlike `DomainEvent` (ephemeral on the event bus), these events are
    /// persisted in the database and queried to build device timelines.
    async fn record_device_event(&self, _event: &DeviceEvent) -> Result<(), Error> {
        Ok(()) // default: silently drop
    }

    /// Query device events with filter, sort, and pagination.
    async fn query_device_events(
        &self,
        _filter: &DeviceEventFilter,
    ) -> Result<ListResult<DeviceEvent>, Error> {
        Ok(ListResult::single_page(vec![]))
    }

    /// Count device events matching a filter (for pagination totals).
    async fn count_device_events(&self, _filter: &DeviceEventFilter) -> Result<u64, Error> {
        Ok(0)
    }

    /// Query audit logs related to a specific device.
    ///
    /// Filters audit_logs where the resource path contains the device serial
    /// number (e.g. "/api/devices/JJA12533/sync-users"). Results are merged
    /// with device events to build per-device activity timelines.
    async fn query_device_audit_logs(
        &self,
        _device_sn: &str,
        _limit: u32,
        _offset: u32,
    ) -> Result<ListResult<AuditEvent>, Error> {
        Ok(ListResult { items: vec![], has_more: false, total: None, next_cursor: None })
    }
}
