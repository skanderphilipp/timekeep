//! Generic faceted filter metadata — reusable across all entities.
//!
//! Every entity that supports faceted search uses the same types
//! ([`FacetGroup`], [`FacetOption`], [`FacetQuery`]) and the same
//! API contract (`GET /api/{entity}/filters`).
//!
//! ## Adding facets to a new entity
//!
//! 1. Add a method to the `Storage` trait (e.g. `device_facets`)
//! 2. Implement it in both storage backends
//! 3. Add a handler in `timekeep-api` that calls the method
//! 4. Reuse these exact types — zero new DTOs needed
//!
//! ## Facet kinds
//!
//! | Kind | Cardinality | UI behavior | Example |
//! |------|------------|-------------|---------|
//! | `Enum` | ≤ 20 values | Show all, grouped by count | Punch status (6 values) |
//! | `Reference` | 1 – 50,000 | Search-as-you-type, top-N by default | Employees, Devices |

use serde::Serialize;

// ── Facet dimension descriptors ────────────────────────────────────────

/// How a facet dimension behaves in the UI.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum FacetKind {
    /// Small fixed set — always returned in full (e.g. punch statuses).
    /// Counts respect contextual filters so zero-count values are
    /// included for completeness.
    Enum,
    /// Reference to another entity — searchable, paginated.
    /// Default: top-N by frequency. On `?search=X`: filtered by name match.
    Reference,
}

/// Metadata about one filterable dimension.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct FacetDimension {
    /// Query parameter name (e.g. "device_sn", "status", "employee").
    pub key: String,
    /// Human-readable label (e.g. "Device", "Status", "Employee").
    pub label: String,
    /// UI behavior hint.
    pub kind: FacetKind,
}

// ── Facet values ───────────────────────────────────────────────────────

/// One selectable value in a facet dimension.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct FacetOption {
    /// The value to send as a query parameter (e.g. "DEV-001", "check_in").
    pub value: String,
    /// Human-readable label (e.g. "Office Entrance", "Check In").
    pub label: String,
    /// Number of records matching this value within the current context.
    /// `None` when counts were not requested (e.g. `?counts=false`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<u64>,
}

/// One facet group — a dimension plus its available values.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct FacetGroup {
    /// Machine key matching `FacetDimension.key`.
    pub key: String,
    /// Human-readable label.
    pub label: String,
    /// UI behavior hint.
    pub kind: FacetKind,
    /// Available values (ordered by count descending for Enum/Reference).
    pub options: Vec<FacetOption>,
    /// Whether more options exist (for Reference facets with pagination).
    pub has_more: bool,
    /// Total number of options (for Reference facets).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

// ── Query parameters ───────────────────────────────────────────────────

/// Filters that constrain facet counts to a subset of records.
///
/// When the user has date range, device, or status filters active,
/// facet counts reflect only the matching records — not the full
/// dataset. This is what makes the facet bar "contextual."
#[derive(Debug, Clone, Default)]
pub struct FacetContext {
    /// Device serial numbers (multi-select).
    pub device_sns: Option<Vec<String>>,
    /// Punches after this timestamp (inclusive).
    pub since: Option<jiff::Timestamp>,
    /// Punches before this timestamp (inclusive).
    pub until: Option<jiff::Timestamp>,
    /// Punch status (check_in, check_out, …).
    pub status: Option<crate::model::punch::PunchStatus>,
    /// Verification method (fingerprint, face, …).
    pub verify_mode: Option<crate::model::punch::VerifyMode>,
    /// Only anomalous punches.
    pub anomalies_only: Option<bool>,
}

/// Query parameters for the facet metadata endpoint.
#[derive(Debug, Clone)]
pub struct FacetQuery {
    /// Specific dimension to query (omit for all dimensions).
    /// When `None`, returns all available dimensions.
    pub dimension: Option<String>,
    /// Search term for Reference-type facets (e.g. employee name).
    /// Ignored for Enum facets.
    pub search: Option<String>,
    /// Max options to return per dimension (default: 20, capped at 100).
    pub limit: u32,
    /// Contextual filters — counts are restricted to matching records.
    /// When `Default::default()`, counts are global (all records).
    pub context: FacetContext,
}

impl Default for FacetQuery {
    fn default() -> Self {
        Self { dimension: None, search: None, limit: 20, context: FacetContext::default() }
    }
}

impl FacetQuery {
    /// Clamp limit to the allowed range.
    pub fn clamped_limit(&self) -> u32 {
        self.limit.clamp(1, 100)
    }
}

// ── Punch-specific facet dimensions (const definitions) ────────────────

/// Available facet dimensions for punches.
/// Returns a freshly allocated Vec — call once and reuse if needed.
pub fn punch_facet_dimensions() -> Vec<FacetDimension> {
    vec![
        FacetDimension {
            key: FacetDimension::DEVICE_SN.into(),
            label: FacetDimension::DEVICE_LABEL.into(),
            kind: FacetKind::Reference,
        },
        FacetDimension {
            key: FacetDimension::STATUS.into(),
            label: FacetDimension::STATUS_LABEL.into(),
            kind: FacetKind::Enum,
        },
        FacetDimension {
            key: FacetDimension::VERIFY_MODE.into(),
            label: FacetDimension::VERIFY_MODE_LABEL.into(),
            kind: FacetKind::Enum,
        },
        FacetDimension {
            key: FacetDimension::EMPLOYEE.into(),
            label: FacetDimension::EMPLOYEE_LABEL.into(),
            kind: FacetKind::Reference,
        },
    ]
}

impl FacetDimension {
    // Dimension keys (used in `?dimension=` query param)
    pub const DEVICE_SN: &'static str = "device_sn";
    pub const STATUS: &'static str = "status";
    pub const VERIFY_MODE: &'static str = "verify_mode";
    pub const EMPLOYEE: &'static str = "employee";

    // Human-readable labels
    pub const DEVICE_LABEL: &'static str = "Device";
    pub const STATUS_LABEL: &'static str = "Status";
    pub const VERIFY_MODE_LABEL: &'static str = "Method";
    pub const EMPLOYEE_LABEL: &'static str = "Employee";

    /// All valid dimension keys for punch facets.
    pub fn is_valid_punch_dimension(key: &str) -> bool {
        matches!(key, Self::DEVICE_SN | Self::STATUS | Self::VERIFY_MODE | Self::EMPLOYEE)
    }
}

// ── Enum facet value mappings (used for zero-fill in Enum facets) ─────

/// All punch status values with their labels.
pub const STATUS_VALUES: &[(&str, &str)] = &[
    ("check_in", "Check In"),
    ("check_out", "Check Out"),
    ("break_out", "Break Out"),
    ("break_in", "Break In"),
    ("overtime_in", "Overtime In"),
    ("overtime_out", "Overtime Out"),
];

/// All verify mode values with their labels.
pub const VERIFY_MODE_VALUES: &[(&str, &str)] = &[
    ("password", "Password"),
    ("fingerprint", "Fingerprint"),
    ("card", "RF Card"),
    ("face", "Face Recognition"),
    ("palm", "Palm Vein"),
];

/// Map a status string to its numeric code (for SQL WHERE clauses).
pub fn status_code(name: &str) -> Option<i32> {
    match name {
        "check_in" => Some(0),
        "check_out" => Some(1),
        "break_out" => Some(2),
        "break_in" => Some(3),
        "overtime_in" => Some(4),
        "overtime_out" => Some(5),
        _ => None,
    }
}

/// Map a verify_mode string to its numeric code.
pub fn verify_mode_code(name: &str) -> Option<i32> {
    match name {
        "password" => Some(0),
        "fingerprint" => Some(1),
        "card" => Some(4),
        "face" => Some(15),
        "palm" => Some(25),
        _ => None,
    }
}
