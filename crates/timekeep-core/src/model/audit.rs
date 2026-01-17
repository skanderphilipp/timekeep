//! Audit log domain model.
//!
//! Every authenticated API request is captured automatically by
//! middleware — no handler code changes needed. The audit log
//! provides a complete, immutable timeline of system activity.
//!
//! ## Design
//!
//! ```text
//! Request → JWT middleware → Audit middleware → Handler → Response
//!                                │
//!                                └── record_audit(AuditEvent {
//!                                      actor, action, resource, status, ...
//!                                    })
//! ```
//!
//! ## Actions
//!
//! Action strings follow the pattern `{resource}.{operation}`:
//! - `device.created`, `device.updated`, `device.deleted`
//! - `punch.corrected`
//! - `endpoint.created`, `endpoint.updated`, `endpoint.deleted`
//! - `settings.updated`
//! - `auth.login`, `auth.login_failed`

use serde::{Deserialize, Serialize};

/// A single audit log entry — who did what, when, and the result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unique identifier (UUID v7).
    pub id: String,

    /// Unix timestamp (seconds).
    pub timestamp: i64,

    /// Username of who performed the action ("system" for automated actions).
    pub actor: String,

    /// What happened: "device.created", "punch.corrected", "settings.updated", etc.
    pub action: String,

    /// What was affected: "device/SN001", "punch/abc123", "settings".
    pub resource: String,

    /// Action-specific detail as JSON (e.g., device label, old/new values).
    pub detail: Option<serde_json::Value>,

    /// IP address of the client that made the request.
    pub ip_address: Option<String>,

    /// "success" or "error".
    pub status: String,

    /// Error message if status is "error".
    pub error_message: Option<String>,
}

impl AuditEvent {
    /// Create a new audit event with the current timestamp.
    pub fn new(actor: String, action: String, resource: String, status: String) -> Self {
        Self {
            id: uuid::Uuid::now_v7().to_string(),
            timestamp: jiff::Timestamp::now().as_second(),
            actor,
            action,
            resource,
            detail: None,
            ip_address: None,
            status,
            error_message: None,
        }
    }

    /// Builder: attach request detail.
    pub fn with_detail(mut self, detail: serde_json::Value) -> Self {
        self.detail = Some(detail);
        self
    }

    /// Builder: attach IP address.
    pub fn with_ip(mut self, ip: String) -> Self {
        self.ip_address = Some(ip);
        self
    }

    /// Builder: attach error message.
    pub fn with_error(mut self, error: String) -> Self {
        self.error_message = Some(error);
        self
    }
}

/// Filters for querying audit logs.
#[derive(Debug, Clone, Default)]
pub struct AuditFilter {
    /// Filter by actor username.
    pub actor: Option<String>,

    /// Filter by action prefix (e.g., "device." matches all device actions).
    pub action: Option<String>,

    /// Filter by resource path.
    pub resource: Option<String>,

    /// Only events after this timestamp (inclusive).
    pub since: Option<jiff::Timestamp>,

    /// Only events before this timestamp (inclusive).
    pub until: Option<jiff::Timestamp>,

    /// Search across actor, action, and resource.
    pub search: Option<String>,

    /// Sort field: "timestamp" (default).
    pub sort_by: String,

    /// Sort direction.
    pub sort_order: crate::query::SortOrder,

    /// Items per page. Default: 50.
    pub limit: u32,

    /// Cursor for pagination.
    pub cursor: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_event_new() {
        let event = AuditEvent::new(
            "admin".into(),
            "device.created".into(),
            "device/SN001".into(),
            "success".into(),
        );
        assert_eq!(event.actor, "admin");
        assert_eq!(event.action, "device.created");
        assert_eq!(event.status, "success");
        assert!(!event.id.is_empty());
        assert!(event.timestamp > 0);
    }

    #[test]
    fn test_audit_event_builders() {
        let event =
            AuditEvent::new("admin".into(), "test".into(), "test/1".into(), "success".into())
                .with_ip("192.168.1.1".into())
                .with_detail(serde_json::json!({"key": "value"}))
                .with_error("something went wrong".into());

        assert_eq!(event.ip_address, Some("192.168.1.1".into()));
        assert!(event.detail.is_some());
        assert_eq!(event.error_message, Some("something went wrong".into()));
    }
}
