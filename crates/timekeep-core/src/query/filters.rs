//! Query filter types for data access.
//!
//! These were extracted from [`traits::storage`](crate::traits::storage)
//! as part of the Store decomposition (see ADR-001). Filter types are domain
//! query objects — they belong in the shared kernel, not in a specific trait file.

use crate::model::device_event::DeviceEventType;
use crate::model::punch::{PunchStatus, VerifyMode};
use crate::query::cursor::Cursor;
use crate::query::{ListParams, SortOrder};

/// Filters for querying attendance punches.
#[derive(Debug, Clone)]
pub struct PunchFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
    /// Filter by device serial number (single, for backward compat).
    /// Prefer `device_sns` for multi-select.
    pub device_sn: Option<String>,
    /// Filter by multiple device serial numbers (OR logic).
    pub device_sns: Option<Vec<String>>,
    /// Filter by user PIN (exact match).
    pub user_pin: Option<String>,
    /// Only punches after this timestamp (inclusive).
    pub since: Option<jiff::Timestamp>,
    /// Only punches before this timestamp (inclusive).
    pub until: Option<jiff::Timestamp>,
    /// Filter by punch status (check_in, check_out, …).
    pub status: Option<PunchStatus>,
    /// Filter by verification method (fingerprint, face, …).
    pub verify_mode: Option<VerifyMode>,
    /// When `true`, return only punches flagged as anomalous.
    pub anomalies_only: Option<bool>,

    /// Filter by specific deduplication IDs (exact match, IN clause).
    /// Used by the search layer to cross-reference Tantivy hits with the DB.
    /// When set, other filters (except `params.limit`) are ignored.
    pub ids: Option<Vec<String>>,

    /// Decoded keyset cursor for stable pagination.
    ///
    /// When set, the storage layer generates a keyset WHERE clause instead of
    /// using `since` for pagination. `since` and `until` still apply as range
    /// filters when combined with cursor-based pagination.
    ///
    /// Set by the API route handler after decoding `params.cursor`.
    pub cursor_after: Option<Cursor>,
}

impl Default for PunchFilter {
    fn default() -> Self {
        Self {
            params: ListParams {
                sort_by: Some("timestamp".into()),
                limit: 10_000,
                ..Default::default()
            },
            device_sn: None,
            device_sns: None,
            user_pin: None,
            since: None,
            until: None,
            status: None,
            verify_mode: None,
            anomalies_only: None,
            ids: None,
            cursor_after: None,
        }
    }
}

/// Filters for listing devices.
#[derive(Debug, Clone)]
pub struct DeviceFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
}

impl Default for DeviceFilter {
    fn default() -> Self {
        Self {
            params: ListParams {
                sort_by: Some("label".into()),
                sort_order: SortOrder::Asc,
                ..Default::default()
            },
        }
    }
}

/// Filters for listing employees.
#[derive(Debug, Clone)]
pub struct EmployeeFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
    /// Filter by department UUID (exact match).
    pub department_id: Option<String>,
    /// Filter by active status.
    pub active: Option<bool>,
}

impl Default for EmployeeFilter {
    fn default() -> Self {
        Self {
            params: ListParams {
                sort_by: Some("name".into()),
                sort_order: SortOrder::Asc,
                ..Default::default()
            },
            department_id: None,
            active: None,
        }
    }
}

/// Filters for listing integration endpoints.
#[derive(Debug, Clone)]
pub struct EndpointFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
}

impl Default for EndpointFilter {
    fn default() -> Self {
        Self { params: ListParams { sort_by: Some("created_at".into()), ..Default::default() } }
    }
}

/// Filters for querying device lifecycle events (activity timeline).
#[derive(Debug, Clone)]
pub struct DeviceEventFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
    /// Filter by device serial number.
    pub device_sn: Option<String>,
    /// Filter by event type(s). If empty, all types are returned.
    pub event_types: Option<Vec<DeviceEventType>>,
    /// Only events after this timestamp (inclusive).
    pub since: Option<jiff::Timestamp>,
    /// Only events before this timestamp (inclusive).
    pub until: Option<jiff::Timestamp>,
}

impl Default for DeviceEventFilter {
    fn default() -> Self {
        Self {
            params: ListParams {
                sort_by: Some("timestamp".into()),
                sort_order: SortOrder::Desc,
                limit: 50,
                ..Default::default()
            },
            device_sn: None,
            event_types: None,
            since: None,
            until: None,
        }
    }
}
