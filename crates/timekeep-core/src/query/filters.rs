//! Query filter types for data access.
//!
//! These were extracted from [`traits::storage`](crate::traits::storage)
//! as part of the Store decomposition (see ADR-001). Filter types are domain
//! query objects — they belong in the shared kernel, not in a specific trait file.
//!
//! ## Design
//!
//! Filter criteria (`PunchCriteria`) are shared between list and aggregate
//! endpoints. Pagination concerns (`ListParams`) are only composed into list
//! filters. Aggregate endpoints use criteria directly — no `unlimited` flag,
//! no limit clamping, no ambiguity about what the endpoint does.

use serde::Deserialize;

use crate::model::device_event::DeviceEventType;
use crate::model::punch::{PunchStatus, VerifyMode};
use crate::query::cursor::Cursor;
use crate::query::{ListParams, SortOrder};

// ═══════════════════════════════════════════════════════════════════
// Shared filter criteria — used by list AND aggregate endpoints
// ═══════════════════════════════════════════════════════════════════

/// Domain filter criteria for punch queries.
///
/// Shared between paginated list endpoints (`GET /punches`),
/// aggregate endpoints (`GET /attendance/calendar`), and report
/// endpoints (`GET /reports/summary`).
///
/// All string fields accept comma-separated values (e.g. `user_pins=123,456`).
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema, utoipa::IntoParams)]
pub struct PunchCriteria {
    /// Comma-separated device serial numbers.
    #[param(value_type = Option<String>)]
    pub device_sns: Option<String>,
    /// Comma-separated employee PINs.
    #[param(value_type = Option<String>)]
    pub user_pins: Option<String>,
    /// Single punch status: check_in, check_out, break_out, break_in, overtime_in, overtime_out.
    #[param(value_type = Option<String>)]
    pub status: Option<String>,
    /// Comma-separated punch statuses (OR logic). Takes precedence over `status`.
    #[param(value_type = Option<String>)]
    pub statuses: Option<String>,
    /// When "true", return only punches flagged as anomalous.
    #[param(value_type = Option<String>)]
    pub anomalies_only: Option<String>,
}

impl PunchCriteria {
    /// Parse comma-separated values into a `Vec<String>`, filtering empty strings.
    pub fn parse_csv(opt: &Option<String>) -> Vec<String> {
        opt.as_deref()
            .map(|s| {
                s.split(',').map(str::trim).filter(|s| !s.is_empty()).map(String::from).collect()
            })
            .unwrap_or_default()
    }

    /// Resolve device serial numbers as a `Vec<String>`.
    pub fn device_sns_vec(&self) -> Vec<String> {
        Self::parse_csv(&self.device_sns)
    }

    /// Resolve user PINs as a `Vec<String>`.
    pub fn user_pins_vec(&self) -> Vec<String> {
        Self::parse_csv(&self.user_pins)
    }

    /// Resolve status filters. `statuses` takes precedence over `status`.
    pub fn resolved_statuses(&self) -> Option<Vec<PunchStatus>> {
        let raw = self.statuses.as_deref().or(self.status.as_deref());
        raw.map(|s| {
            s.split(',')
                .filter_map(|part| match part.trim() {
                    "check_in" => Some(PunchStatus::CheckIn),
                    "check_out" => Some(PunchStatus::CheckOut),
                    "break_out" => Some(PunchStatus::BreakOut),
                    "break_in" => Some(PunchStatus::BreakIn),
                    "overtime_in" => Some(PunchStatus::OvertimeIn),
                    "overtime_out" => Some(PunchStatus::OvertimeOut),
                    _ => None,
                })
                .collect()
        })
    }

    /// Resolve `anomalies_only` as a bool.
    pub fn anomalies_only_bool(&self) -> bool {
        self.anomalies_only.as_deref() == Some("true")
    }
}

// ═══════════════════════════════════════════════════════════════════
// Paginated list filter — for `GET /punches` and similar
// ═══════════════════════════════════════════════════════════════════

/// Filters for paginated punch list queries.
///
/// Aggregate endpoints should use [`PunchCriteria`] directly via
/// `PunchStore::query_punches_unpaged` instead of the `unlimited` flag.
#[derive(Debug, Clone)]
pub struct PunchFilter {
    /// Shared search/sort/page params.
    pub params: ListParams,
    /// Filter by device serial numbers (OR logic).
    pub device_sns: Option<Vec<String>>,
    /// Filter by user PINs (OR logic).
    pub user_pins: Option<Vec<String>>,
    /// Only punches after this timestamp (inclusive).
    pub since: Option<jiff::Timestamp>,
    /// Only punches before this timestamp (inclusive).
    pub until: Option<jiff::Timestamp>,
    /// Filter by punch status.
    pub status: Option<PunchStatus>,
    /// Filter by punch statuses (OR logic). Takes precedence over `status`.
    pub statuses: Option<Vec<PunchStatus>>,
    /// Filter by verification method (fingerprint, face, …).
    pub verify_mode: Option<VerifyMode>,
    /// When `true`, return only punches flagged as anomalous.
    pub anomalies_only: Option<bool>,

    /// Filter by specific deduplication IDs (exact match, IN clause).
    /// Used by the search layer to cross-reference Tantivy hits with the DB.
    pub ids: Option<Vec<String>>,

    /// Decoded keyset cursor for stable pagination.
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
            device_sns: None,
            user_pins: None,
            since: None,
            until: None,
            status: None,
            verify_mode: None,
            anomalies_only: None,
            ids: None,
            cursor_after: None,
            statuses: None,
        }
    }
}

/// Filters for listing devices.
#[derive(Debug, Clone)]
pub struct DeviceFilter {
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
    pub params: ListParams,
    pub department_ids: Option<Vec<String>>,
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
            department_ids: None,
            active: None,
        }
    }
}

/// Filters for listing integration endpoints.
#[derive(Debug, Clone)]
pub struct EndpointFilter {
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
    pub params: ListParams,
    pub device_sn: Option<String>,
    pub event_types: Option<Vec<DeviceEventType>>,
    pub since: Option<jiff::Timestamp>,
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
