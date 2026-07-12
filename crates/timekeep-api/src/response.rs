//! Typed API response infrastructure.
//!
//! Every endpoint returns `ApiEnvelope<T>`, providing a consistent
//! contract for all consumers (dashboard SPA, Odoo integration, mobile apps).
//!
//! ## Envelope shape
//!
//! ```json
//! {
//!   "data": { ... },
//!   "meta": { "has_more": true, "next_cursor": "MTc1Mj...", "total": 243 },
//!   "error": null
//! }
//! ```
//!
//! When an error occurs, `data` is `null` and `error` carries the details:
//!
//! ```json
//! {
//!   "data": null,
//!   "meta": null,
//!   "error": { "code": "not_found", "message": "Device CQZ723... not found" }
//! }
//! ```

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use utoipa::ToSchema;

// ─── Envelope ───────────────────────────────────────────────────────

/// The standard response wrapper for every API endpoint.
///
/// `data` is the domain payload. `meta` carries pagination info.
/// `error` is populated only on failure — in which case `data` is `None`.
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiEnvelope<T: Serialize + ToSchema> {
    pub data: Option<T>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<PageMeta>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

impl<T: Serialize + ToSchema> ApiEnvelope<T> {
    /// Build a success envelope with optional pagination metadata.
    pub fn success(data: T) -> Self {
        Self { data: Some(data), meta: None, error: None }
    }

    /// Success with pagination metadata attached.
    pub fn paginated(data: T, meta: PageMeta) -> Self {
        Self { data: Some(data), meta: Some(meta), error: None }
    }

    /// Build an error-only envelope (data is always `None`).
    pub fn error(error: ApiError) -> Self {
        Self { data: None, meta: None, error: Some(error) }
    }
}

/// Convenience: `ApiEnvelope::error(...)` → axum `Response`.
impl<T: Serialize + ToSchema> IntoResponse for ApiEnvelope<T> {
    fn into_response(self) -> Response {
        Json(self).into_response()
    }
}

// ─── Pagination ─────────────────────────────────────────────────────

/// Pagination metadata attached to list endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PageMeta {
    /// `true` when more results exist beyond the current page.
    pub has_more: bool,

    /// Opaque cursor for the next page (cursor-based pagination).
    /// Clients pass this as `?cursor=<value>` to fetch the next page.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,

    /// Total result count (when cheap to compute; omit for streaming endpoints).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

impl PageMeta {
    /// A single page with no further data.
    pub fn single() -> Self {
        Self { has_more: false, next_cursor: None, total: None }
    }

    /// A page where more data exists.
    pub fn has_more(next_cursor: String) -> Self {
        Self { has_more: true, next_cursor: Some(next_cursor), total: None }
    }

    /// A page with a known total count.
    pub fn with_total(total: u64) -> Self {
        Self { has_more: false, next_cursor: None, total: Some(total) }
    }
}

// ─── Error ──────────────────────────────────────────────────────────

/// Machine-readable error returned in the envelope.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ApiError {
    /// Stable error code for programmatic handling (e.g. `"not_found"`, `"validation_error"`).
    pub code: &'static str,

    /// Human-readable description for logging and debugging.
    pub message: String,

    /// Optional map of field-level validation errors.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<FieldError>>,
}

/// A single field-level validation error.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}

impl ApiError {
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self { code: "not_found", message: resource.into(), fields: None }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self { code: "validation_error", message: message.into(), fields: None }
    }

    pub fn validation_with_fields(message: impl Into<String>, fields: Vec<FieldError>) -> Self {
        Self { code: "validation_error", message: message.into(), fields: Some(fields) }
    }

    pub fn duplicate(message: impl Into<String>) -> Self {
        Self { code: "duplicate", message: message.into(), fields: None }
    }

    pub fn unauthorized() -> Self {
        Self { code: "unauthorized", message: "authentication required".into(), fields: None }
    }

    pub fn forbidden() -> Self {
        Self { code: "forbidden", message: "insufficient permissions".into(), fields: None }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self { code: "internal_error", message: message.into(), fields: None }
    }
}

// ─── App-level error (implements IntoResponse) ────────────────────

/// Typed application error that maps to an HTTP status code + envelope.
///
/// Handlers return `Result<Json<ApiEnvelope<T>>, AppError>`. The `?` operator
/// auto-converts `AppError` into an HTTP response with the correct status code.
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Validation(ApiError),
    Duplicate(String),
    Unauthorized,
    Forbidden,
    Internal(String),
}

impl AppError {
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound(resource.into())
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(ApiError::validation(message))
    }

    pub fn duplicate(message: impl Into<String>) -> Self {
        Self::Duplicate(message.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error) = match self {
            Self::NotFound(msg) => (StatusCode::NOT_FOUND, ApiError::not_found(msg)),
            Self::Validation(e) => (StatusCode::UNPROCESSABLE_ENTITY, e),
            Self::Duplicate(msg) => (StatusCode::CONFLICT, ApiError::duplicate(msg)),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, ApiError::unauthorized()),
            Self::Forbidden => (StatusCode::FORBIDDEN, ApiError::forbidden()),
            Self::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, ApiError::internal(msg)),
        };

        let envelope = ApiEnvelope::<()>::error(error);
        (status, envelope).into_response()
    }
}

/// Bridge from our domain `Error` type to `AppError`.
///
/// Extracts the error message string first, then matches on variant
/// to pick the right HTTP status code. Internal errors are logged.
impl From<timekeep_core::Error> for AppError {
    fn from(e: timekeep_core::Error) -> Self {
        use timekeep_core::Error;
        // Extract the message once before matching (avoids partial move issues)
        let msg = e.to_string();
        match &e {
            Error::NotFound(_) => Self::NotFound(msg),
            Error::Validation(_) => Self::Validation(ApiError::validation(msg)),
            Error::Duplicate(_) => Self::Duplicate(msg),
            Error::Authentication(_) => Self::Unauthorized,
            Error::Storage(_)
            | Error::DeviceCommunication(_)
            | Error::Network(_)
            | Error::Configuration(_)
            | Error::Internal(_) => {
                tracing::error!(error = %e, "domain error mapped to 500");
                Self::Internal(msg)
            },
        }
    }
}

// ─── Integration Endpoints ─────────────────────────────────────────

/// Response DTO for a single integration endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct EndpointResponse {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub enabled: bool,
    /// Type-specific configuration as a JSON object.
    pub config: serde_json::Value,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<&timekeep_core::IntegrationEndpoint> for EndpointResponse {
    fn from(ep: &timekeep_core::IntegrationEndpoint) -> Self {
        Self {
            id: ep.id.clone(),
            name: ep.name.clone(),
            kind: ep.kind.to_string(),
            enabled: ep.enabled,
            config: ep.config.clone(),
            created_at: ep.created_at,
            updated_at: ep.updated_at,
        }
    }
}

// ─── System Settings ────────────────────────────────────────────────

/// Response DTO for system-wide settings.
#[derive(Debug, Serialize, ToSchema)]
pub struct SystemSettingsResponse {
    pub poll_interval_secs: u32,
    pub auto_discover: bool,
    pub work_policy: WorkPolicyResponse,
}

/// Work policy settings exposed to the frontend.
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkPolicyResponse {
    /// Work start time in "HH:MM" format.
    pub work_start: String,
    /// Work end time in "HH:MM" format.
    pub work_end: String,
    /// Grace period in minutes before late flag.
    pub late_threshold_minutes: i64,
    /// Minimum hours for a "full day" (vs half day).
    pub min_hours_for_full_day: f64,
    /// Hours after which overtime starts counting.
    pub daily_overtime_after_hours: f64,
    /// Working days (Mon=0, Sun=6).
    pub working_days: [bool; 7],
}

impl From<&timekeep_core::model::WorkPolicy> for WorkPolicyResponse {
    fn from(p: &timekeep_core::model::WorkPolicy) -> Self {
        Self {
            work_start: format!("{:02}:{:02}", p.work_start.hour(), p.work_start.minute()),
            work_end: format!("{:02}:{:02}", p.work_end.hour(), p.work_end.minute()),
            late_threshold_minutes: p.late_threshold_secs / 60,
            min_hours_for_full_day: p.min_seconds_for_present as f64 / 3600.0,
            daily_overtime_after_hours: p.daily_overtime_after_secs as f64 / 3600.0,
            working_days: p.working_days,
        }
    }
}

impl From<&timekeep_core::SystemSettings> for SystemSettingsResponse {
    fn from(s: &timekeep_core::SystemSettings) -> Self {
        Self {
            poll_interval_secs: s.poll_interval_secs,
            auto_discover: s.auto_discover,
            work_policy: WorkPolicyResponse::from(&s.work_policy),
        }
    }
}

// ─── Reports ─────────────────────────────────────────────────────────

/// One day's aggregated punch counts.
#[derive(Debug, Serialize, ToSchema)]
pub struct DailyBreakdown {
    /// Unix timestamp (seconds) of the day start (midnight UTC).
    pub date: i64,
    /// Total punches for this day.
    pub count: u64,
}

/// Per-day hours breakdown with regular and overtime split.
#[derive(Debug, Serialize, ToSchema)]
pub struct DailyHoursBreakdown {
    /// Unix timestamp (seconds) of the day start (midnight UTC).
    pub date: i64,
    /// Total regular hours worked (in seconds).
    pub regular_seconds: i64,
    /// Total overtime hours worked (in seconds).
    pub overtime_seconds: i64,
}

/// Per-week total hours for trend comparison.
#[derive(Debug, Serialize, ToSchema)]
pub struct WeeklyHours {
    /// ISO week number.
    pub week: i8,
    /// ISO year.
    pub year: i16,
    /// Total hours worked in this week (in seconds).
    pub total_seconds: i64,
}

/// Attendance status distribution (full day / half day / absent).
#[derive(Debug, Serialize, ToSchema)]
pub struct AttendanceDistribution {
    /// "full", "half", or "absent"
    pub status: String,
    /// Number of employee-days with this status.
    pub count: u64,
    /// Percentage of total employee-days.
    pub percentage: f64,
}

/// Per-employee attendance KPI for the report period.
#[derive(Debug, Serialize, ToSchema)]
pub struct EmployeeReportKpi {
    pub user_pin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    /// Number of days present (full or half day).
    pub days_present: u32,
    /// Number of days absent (no check-in on a working day).
    pub days_absent: u32,
    /// Number of days with a late arrival.
    pub days_late: u32,
    /// Average hours per working day (in seconds).
    pub avg_seconds_per_day: i64,
    /// Total overtime in the period (in seconds).
    pub overtime_seconds: i64,
    /// Count of anomalies in the period.
    pub anomaly_count: u32,
}

/// Aggregated punch summary for a date range.
#[derive(Debug, Serialize, ToSchema)]
pub struct ReportSummaryResponse {
    pub date_from: i64,
    pub date_to: i64,
    pub total_punches: u64,
    pub check_ins: u64,
    pub check_outs: u64,
    pub break_outs: u64,
    pub break_ins: u64,
    pub overtime_ins: u64,
    pub overtime_outs: u64,
    pub unique_users: u64,

    // ── Business KPIs ──
    /// Number of working days in the period.
    pub work_days: u32,
    /// Average regular hours per employee per working day (in seconds).
    pub avg_seconds_per_day: i64,
    /// Total overtime hours in the period (in seconds).
    pub overtime_seconds: i64,
    /// Absence rate: absent employee-days / total employee-working-days.
    pub absence_rate: f64,

    // ── Chart data ──
    /// Per-day regular + overtime breakdown.
    pub daily_hours: Vec<DailyHoursBreakdown>,
    /// Per-week total hours for trend comparison.
    pub weekly_hours: Vec<WeeklyHours>,
    /// Full day / half day / absent distribution.
    pub status_distribution: Vec<AttendanceDistribution>,
    /// Per-employee KPIs for the period.
    pub employees: Vec<EmployeeReportKpi>,

    // Legacy — keep for backward compatibility
    pub daily_breakdown: Vec<DailyBreakdown>,
}

// Domain -> Response DTO mappings

impl From<&timekeep_core::DailyHours> for DailyHoursBreakdown {
    fn from(dh: &timekeep_core::DailyHours) -> Self {
        let ts =
            jiff::civil::DateTime::from_parts(dh.date, jiff::civil::Time::new(0, 0, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        Self {
            date: ts,
            regular_seconds: dh.regular_seconds,
            overtime_seconds: dh.overtime_seconds,
        }
    }
}

impl From<&timekeep_core::WeeklyHours> for WeeklyHours {
    fn from(wh: &timekeep_core::WeeklyHours) -> Self {
        Self { week: wh.week, year: wh.year, total_seconds: wh.total_seconds }
    }
}

pub(crate) fn status_distribution_to_response(
    sd: &timekeep_core::StatusDistribution,
) -> Vec<AttendanceDistribution> {
    vec![
        AttendanceDistribution {
            status: "full".into(),
            count: sd.full_days,
            percentage: sd.full_pct(),
        },
        AttendanceDistribution {
            status: "half".into(),
            count: sd.half_days,
            percentage: sd.half_pct(),
        },
        AttendanceDistribution {
            status: "absent".into(),
            count: sd.absent_days,
            percentage: sd.absence_rate_pct(),
        },
    ]
}

impl From<&timekeep_core::EmployeeKpi> for EmployeeReportKpi {
    fn from(ek: &timekeep_core::EmployeeKpi) -> Self {
        Self {
            user_pin: ek.user_pin.clone(),
            employee_name: None,
            days_present: ek.days_present,
            days_absent: ek.days_absent,
            days_late: ek.days_late,
            avg_seconds_per_day: ek.avg_seconds_per_day,
            overtime_seconds: ek.total_overtime_seconds,
            anomaly_count: 0,
        }
    }
}

// Audit

/// Response DTO for an audit log entry.
#[derive(Debug, Serialize, ToSchema)]
pub struct AuditEventResponse {
    pub id: String,
    pub timestamp: i64,
    pub actor: String,
    pub action: String,
    pub resource: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

impl From<&timekeep_core::AuditEvent> for AuditEventResponse {
    fn from(e: &timekeep_core::AuditEvent) -> Self {
        Self {
            id: e.id.clone(),
            timestamp: e.timestamp,
            actor: e.actor.clone(),
            action: e.action.clone(),
            resource: e.resource.clone(),
            detail: e.detail.clone(),
            ip_address: e.ip_address.clone(),
            status: e.status.clone(),
            error_message: e.error_message.clone(),
        }
    }
}

// ─── Export Format ─────────────────────────────────────────────────

/// Export format for punch data download.
#[derive(Debug, Clone, Copy, serde::Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    /// Comma-separated values (text/csv)
    Csv,
    /// Excel Open XML spreadsheet (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
    Xlsx,
}

impl std::fmt::Display for ExportFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Csv => f.write_str("csv"),
            Self::Xlsx => f.write_str("xlsx"),
        }
    }
}

// ─── Export Response (file download, not JSON) ─────────────────────

/// Raw file download response for export endpoints.
///
/// Not wrapped in `ApiEnvelope` — the body is the raw file bytes
/// with appropriate Content-Type and Content-Disposition headers.
pub struct ExportResponse {
    /// Raw file bytes.
    pub data: Vec<u8>,
    /// Suggested filename for download.
    pub filename: String,
    /// MIME content type.
    pub content_type: &'static str,
}

impl axum::response::IntoResponse for ExportResponse {
    fn into_response(self) -> axum::response::Response {
        use axum::http::header;

        let encoded_filename = urlencoding(&self.filename);
        let disposition = format!(
            "attachment; filename=\"{}\"; filename*=UTF-8''{}",
            encoded_filename, encoded_filename
        );

        axum::response::Response::builder()
            .header(header::CONTENT_TYPE, self.content_type)
            .header(header::CONTENT_DISPOSITION, disposition)
            .header(header::CONTENT_LENGTH, self.data.len().to_string())
            .body(axum::body::Body::from(self.data))
            .expect("ExportResponse: valid headers")
    }
}

/// Simple percent-encoding for filename characters that need it.
fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c.to_string()
            } else {
                format!("%{:02X}", c as u8)
            }
        })
        .collect()
}
