//! Typed request DTOs for every API endpoint.
//!
//! Replaces the previous `Json<Value>` pattern with proper serde deserialization.
//! Missing or malformed fields produce clear 422 validation errors automatically.
//!
//! All types derive `utoipa::ToSchema` for automatic OpenAPI 3.1 spec generation.

use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

// ─── Auth ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    /// Admin username
    pub username: String,
    /// Admin password
    pub password: String,
}

// ─── Setup (First-Run Onboarding) ────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct SetupRequest {
    /// Admin username for the initial account.
    pub username: String,
    /// Admin password (min 6 characters).
    pub password: String,
    /// Optional display name. Defaults to username.
    #[serde(default)]
    pub display_name: Option<String>,
    /// Workspace / company name shown on the login screen.
    #[serde(default)]
    pub workspace_name: Option<String>,
}

// ─── Devices ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddDeviceRequest {
    /// Device serial number (from the scanner label)
    pub serial_number: String,
    /// IP address or hostname of the scanner
    pub host: String,

    /// TCP port (default: 4370 for ZKTeco SDK)
    #[serde(default = "default_port")]
    pub port: u16,

    /// Human-readable label (e.g. "Office Entrance")
    #[serde(default)]
    pub label: Option<String>,

    /// Communication key / password for the device
    #[serde(default)]
    pub comm_key: u32,

    /// Whether to enable ADMS push (real-time) mode
    #[serde(default = "default_true")]
    pub push_enabled: bool,

    /// IANA timezone name (e.g. "Asia/Riyadh")
    pub timezone: Option<String>,

    /// Vendor key for provider routing (e.g. "zkteco", "suprema").
    /// Defaults to "zkteco".
    #[serde(default)]
    pub vendor: Option<String>,

    /// Physical location of the device (e.g. "HQ Floor 1").
    #[serde(default)]
    pub location: Option<String>,

    /// Per-device poll interval override in seconds.
    #[serde(default)]
    pub poll_interval_secs: Option<u32>,

    /// Device group ID for organizational grouping.
    #[serde(default)]
    pub group_id: Option<String>,
}

fn default_port() -> u16 {
    4370
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateDeviceRequest {
    /// New IP address or hostname
    pub host: Option<String>,
    /// New TCP port
    pub port: Option<u16>,
    /// New human-readable label
    pub label: Option<String>,
    /// New communication key
    pub comm_key: Option<u32>,
    /// Enable/disable ADMS push mode
    pub push_enabled: Option<bool>,
    /// New timezone
    pub timezone: Option<String>,

    /// New vendor key
    pub vendor: Option<String>,

    /// New physical location
    pub location: Option<String>,

    /// Per-device poll interval override
    pub poll_interval_secs: Option<u32>,

    /// Device group ID for organizational grouping.
    pub group_id: Option<String>,
}

/// Request to scan a subnet for biometric devices.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ScanNetworkRequest {
    /// Subnet to scan (e.g. "192.168.100" or "192.168.100.0/24").
    /// If omitted, auto-detects from the server's network interfaces.
    #[serde(default)]
    pub subnet: Option<String>,
    /// Port to scan (default: 4370).
    #[serde(default = "default_port")]
    pub port: u16,
}

// ─── Device Discovery & Provisioning ────────────────────────────────

/// Request to probe a device at a given IP:port.
#[derive(Debug, Deserialize, ToSchema)]
pub struct DiscoverDeviceRequest {
    /// IP address or hostname to probe.
    pub host: String,
    /// Port (default: auto-detect based on provider).
    #[serde(default = "default_port")]
    pub port: u16,
}

/// Request to finalize device provisioning after discovery.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProvisionDeviceRequest {
    /// Device serial number (from discovery step).
    pub serial_number: String,
    /// Human-readable label.
    pub label: String,
    /// IANA timezone name (e.g. "Asia/Riyadh").
    pub timezone: Option<String>,
    /// Whether to enable ADMS push.
    #[serde(default = "default_true")]
    pub push_enabled: bool,
    /// Communication key.
    #[serde(default)]
    pub comm_key: u32,
    /// Physical location.
    #[serde(default)]
    pub location: Option<String>,
    /// Per-device poll interval override.
    #[serde(default)]
    pub poll_interval_secs: Option<u32>,
    /// IP address or hostname (from discovery).
    pub host: String,
    /// Port (from discovery).
    #[serde(default = "default_port")]
    pub port: u16,
    /// Vendor key (from discovery).
    pub vendor: String,
}

// ─── Device Events ──────────────────────────────────────────────────

/// Query parameters for device event listing.
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct DeviceEventListQuery {
    /// Filter by event type keys (comma-separated, e.g. "came_online,went_offline").
    #[serde(default)]
    pub event_types: Option<String>,
    /// Unix timestamp (seconds) — events after this time.
    pub since: Option<i64>,
    /// Unix timestamp (seconds) — events before this time.
    pub until: Option<i64>,
    /// Sort field. Default: "timestamp".
    #[serde(default = "default_event_sort")]
    pub sort_by: String,
    /// Sort direction. Default: desc (newest first).
    #[serde(default)]
    pub sort_order: timekeep_core::SortOrder,
    /// Items per page (default 50, max 200).
    #[serde(default = "default_event_limit")]
    pub limit: u32,
    /// Cursor for pagination.
    pub cursor: Option<String>,
}

fn default_event_sort() -> String {
    "timestamp".into()
}
fn default_event_limit() -> u32 {
    50
}

// ─── Device Search ──────────────────────────────────────────────────

/// Query parameters for device search.
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct DeviceSearchQuery {
    /// Full-text search across serial, label, model, MAC.
    pub q: Option<String>,
    /// Filter by vendor key (e.g. "zkteco").
    pub vendor: Option<String>,
    /// Filter by connection status.
    pub status: Option<String>,
    /// Filter by location.
    pub location: Option<String>,
    /// Sort field. Default: "label".
    #[serde(default = "default_device_sort")]
    pub sort_by: String,
    /// Sort direction.
    #[serde(default)]
    pub sort_order: timekeep_core::SortOrder,
    /// Items per page (default 50, max 200).
    #[serde(default = "default_device_limit")]
    pub limit: u32,
    /// Cursor for pagination.
    pub cursor: Option<String>,
}

fn default_device_sort() -> String {
    "label".into()
}
fn default_device_limit() -> u32 {
    50
}

// ─── Device Batch Actions ───────────────────────────────────────────

/// Request to execute a batch action on multiple devices.
#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchActionRequest {
    /// Action to execute: "sync_now", "sync_clock", "enable", "disable", "restart".
    pub action: String,
    /// List of device serial numbers to act on.
    pub device_sns: Vec<String>,
}

// ─── Punch Query ────────────────────────────────────────────────────

/// Query parameters for punch listing — composes ListParams with domain extras.
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct PunchListQuery {
    /// Shared search/sort/page params.
    #[serde(flatten)]
    pub params: timekeep_core::ListParams,

    /// Full-text search across user_pin, employee_name, device_sn, device_label, and status.
    /// Uses Tantivy for fuzzy, ranked search. Takes priority over `params.search`.
    pub q: Option<String>,

    /// Filter by device serial number (single, backward compat).
    pub device_sn: Option<String>,
    /// Filter by multiple device serial numbers (OR logic).
    /// Accepts repeated query params: `?device_sn[]=DEV-001&device_sn[]=DEV-002`
    #[serde(default, alias = "device_sn[]")]
    pub device_sns: Option<Vec<String>>,
    /// Filter by user PIN (exact match).
    pub user_pin: Option<String>,
    /// Unix timestamp (seconds) — return punches after this time.
    pub since: Option<i64>,
    /// Unix timestamp (seconds) — return punches before this time.
    pub until: Option<i64>,
    /// Filter by punch status: check_in, check_out, break_out, break_in, overtime_in, overtime_out.
    pub status: Option<String>,
    /// Filter by verification method: fingerprint, face, card, password, palm.
    pub verify_mode: Option<String>,
    /// When "true", return only punches flagged as anomalous.
    pub anomalies_only: Option<String>,
}

// ─── Reports ──────────────────────────────────────────────────────────

/// Query parameters for report summaries.
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ReportSummaryQuery {
    /// Unix timestamp (seconds) — start of date range (inclusive).
    /// Defaults to start of today.
    pub date_from: Option<i64>,

    /// Unix timestamp (seconds) — end of date range (inclusive).
    /// Defaults to end of today.
    pub date_to: Option<i64>,
}

/// Query parameters for audit log listing.
#[derive(Debug, Deserialize, IntoParams)]
pub struct AuditListQuery {
    /// Filter by actor username.
    pub actor: Option<String>,
    /// Filter by action prefix (e.g. "device.").
    pub action: Option<String>,
    /// Filter by resource path.
    pub resource: Option<String>,
    /// Unix timestamp — events after this time.
    pub since: Option<i64>,
    /// Unix timestamp — events before this time.
    pub until: Option<i64>,
    /// Full-text search across actor, action, and resource.
    pub search: Option<String>,
    /// Sort field. Default: "timestamp".
    #[serde(default = "default_audit_sort")]
    pub sort_by: String,
    /// Sort direction.
    #[serde(default)]
    pub sort_order: timekeep_core::SortOrder,
    /// Items per page (default 50, max 200).
    #[serde(default = "default_audit_limit")]
    pub limit: u32,
    /// Cursor for pagination.
    pub cursor: Option<String>,
}

fn default_audit_sort() -> String {
    "timestamp".into()
}
fn default_audit_limit() -> u32 {
    50
}

/// Manual punch correction (HR override).
#[derive(Debug, Deserialize, ToSchema)]
pub struct CorrectPunchRequest {
    /// Employee PIN as registered on the device
    pub user_pin: String,
    /// Device serial number
    pub device_sn: String,

    /// One of: `check_in`, `check_out`, `break_out`, `break_in`, `overtime_in`, `overtime_out`
    pub status: String,

    /// Unix timestamp (seconds). Defaults to now if omitted.
    pub timestamp: Option<i64>,
}

// ─── Users (on device) ──────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct SetUserRequest {
    /// Employee PIN (numeric ID on the device)
    pub pin: String,
    /// Display name
    pub name: String,

    /// Internal user serial number on the device
    #[serde(default)]
    pub internal_sn: u16,

    /// User privilege level (0 = normal, 14 = admin)
    #[serde(default)]
    pub privilege: u8,

    /// RFID card number (if applicable)
    pub card_number: Option<String>,

    /// Whether the user has a password set
    #[serde(default)]
    pub has_password: bool,
}

// ─── Device Commands ────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct EnqueueCommandRequest {
    /// Command to send to the device (e.g. "REBOOT", "CLEAR_ATTENDANCE", "ENABLE", "DISABLE")
    pub command: String,
}

// ─── API Keys ────────────────────────────────────────────────────────

/// Create a new API key for an integration partner.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateApiKeyRequest {
    /// Human-readable name (e.g. "Odoo Production Integration")
    pub name: String,

    /// Space-separated permissions (e.g. "read:punches write:punches")
    pub permissions: String,

    /// Number of days until the key expires. Omit for no expiration.
    #[serde(default)]
    pub expires_in_days: Option<u32>,
}

// ─── Integration Endpoints ──────────────────────────────────────────

/// Create a new integration endpoint.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateEndpointRequest {
    /// Human-readable name (e.g. "Odoo Production")
    pub name: String,

    /// Integration kind: "webhook", "odoo", "sap", "zapier"
    pub kind: String,

    /// Optional initial config. If omitted, the default for this kind is used.
    #[serde(default)]
    pub config: Option<serde_json::Value>,
}

/// Update an existing integration endpoint. All fields optional.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateEndpointRequest {
    /// New display name
    pub name: Option<String>,

    /// Enable or disable this endpoint
    pub enabled: Option<bool>,

    /// New type-specific config (replaces existing)
    pub config: Option<serde_json::Value>,
}

// ─── System Settings ────────────────────────────────────────────────

/// Partial update for system-wide settings. All fields optional.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSystemSettingsRequest {
    /// How often (in seconds) the engine polls connected scanners.
    /// Minimum: 5. Default: 30.
    pub poll_interval_secs: Option<u32>,

    /// Whether to periodically scan for new ZKTeco scanners.
    pub auto_discover: Option<bool>,

    /// Work schedule update (partial).
    pub work_policy: Option<UpdateWorkPolicyRequest>,

    /// Support email shown in the dashboard footer. Empty string clears it.
    pub support_email: Option<String>,
    /// Workspace / company name shown on the login screen.
    pub workspace_name: Option<String>,
}

/// Partial update for work policy settings.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateWorkPolicyRequest {
    /// Work start time in "HH:MM" format (e.g., "08:00").
    pub work_start: Option<String>,
    /// Work end time in "HH:MM" format (e.g., "17:00").
    pub work_end: Option<String>,
    /// Grace period in minutes before late flag.
    pub late_threshold_minutes: Option<i64>,
    /// Minimum hours for a full day.
    pub min_hours_for_full_day: Option<f64>,
    /// Hours after which overtime starts.
    pub daily_overtime_after_hours: Option<f64>,
    /// Working days (Mon=0, Sun=6).
    pub working_days: Option<[bool; 7]>,
}

// ─── Export ───────────────────────────────────────────────────────────

/// Query parameters for punch data export.
#[derive(Debug, Deserialize, IntoParams)]
pub struct ExportQueryParams {
    /// Filter by device serial number
    pub device_sn: Option<String>,

    /// Filter by user PIN
    pub user_pin: Option<String>,

    /// Unix timestamp (seconds) — return punches after this time
    pub since: Option<i64>,

    /// Unix timestamp (seconds) — return punches before this time
    pub until: Option<i64>,

    /// Maximum records to export (default: 10000, max: 50000)
    #[serde(default)]
    pub limit: Option<u32>,

    /// Sort direction. Default: desc (newest first).
    #[serde(default)]
    pub sort_order: Option<timekeep_core::SortOrder>,

    /// Export format: "csv" or "xlsx" (default: "csv")
    #[serde(default)]
    pub format: Option<crate::response::ExportFormat>,
}

// ─── Dashboard User Management ──────────────────────────────────────

/// Create a new dashboard user (admin only).
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateDashboardUserRequest {
    /// Login username (must be unique).
    pub username: String,
    /// Plaintext password (will be hashed before storage).
    pub password: String,
    /// Role: "admin", "operator", or "viewer".
    #[serde(default = "default_user_role")]
    pub role: String,
    /// Human-readable display name.
    #[serde(default)]
    pub display_name: Option<String>,
    /// Workspace / company name shown on the login screen.
    #[serde(default)]
    pub workspace_name: Option<String>,
    /// Custom permission tokens. If omitted, the role's defaults are used.
    /// Accepts a JSON array of space-separated permission strings.
    #[serde(default)]
    pub permissions: Option<Vec<String>>,
}

fn default_user_role() -> String {
    "viewer".into()
}

/// Update an existing dashboard user (admin only). All fields optional.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateDashboardUserRequest {
    /// New role.
    pub role: Option<String>,
    /// New display name.
    pub display_name: Option<String>,
    /// Workspace / company name shown on the login screen.
    #[serde(default)]
    pub workspace_name: Option<String>,
    /// Enable or disable the user.
    pub active: Option<bool>,
    /// Custom permission tokens. If set, replaces all existing permissions.
    /// Accepts a JSON array of permission strings.
    pub permissions: Option<Vec<String>>,
}

/// Change password for a dashboard user.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ChangePasswordRequest {
    /// Plaintext new password.
    pub password: String,
}

// ─── Employees ────────────────────────────────────────────────────────

/// Create a new tracked employee.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateEmployeeRequest {
    /// Device PIN / user identifier on the scanner.
    pub pin: String,
    /// Display name (e.g. "Ahmed Al-Sabah").
    pub name: String,
    /// Department UUID for cross-entity navigation.
    ///
    /// When provided, the department name is resolved and returned as the
    /// denormalized `department` display field on the response.
    #[serde(default)]
    pub department_id: Option<String>,
    /// External ERP reference (Odoo/SAP employee ID).
    #[serde(default)]
    pub external_id: Option<String>,
}

/// Create a new department with optional work policy.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateDepartmentRequest {
    /// Unique department name (e.g. "Engineering", "Warehouse").
    pub name: String,
    /// FK to a work policy template. Takes precedence over inline `work_policy`.
    pub work_policy_id: Option<String>,
    /// Optional department-specific work policy (legacy inline JSON).
    /// Null = inherit org default.
    pub work_policy: Option<WorkPolicyInput>,
}

/// Create a new device group.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateDeviceGroupRequest {
    /// Unique group name (e.g. "onboarding", "staff").
    pub name: String,
    /// Optional human-readable description.
    pub description: Option<String>,
    /// Department IDs to assign. Empty = all departments.
    #[serde(default)]
    pub department_ids: Vec<String>,
}

/// Update an existing device group.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateDeviceGroupRequest {
    /// New group name.
    pub name: Option<String>,
    /// New description.
    pub description: Option<String>,
    /// New department IDs. Omitted = keep existing.
    pub department_ids: Option<Vec<String>>,
}

/// Set a device's group membership.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SetDeviceGroupRequest {
    /// Group ID to assign, or null/absent to remove.
    pub group_id: Option<String>,
}

/// Update an existing department.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateDepartmentRequest {
    /// New department name.
    pub name: Option<String>,
    /// FK to a work policy template. Takes precedence over inline `work_policy`.
    /// Set to `null` to clear template assignment.
    #[serde(default, deserialize_with = "deserialize_optional_string")]
    pub work_policy_id: Option<Option<String>>,
    /// New work policy. Null = clear custom policy and inherit org default.
    #[serde(default, deserialize_with = "deserialize_optional_work_policy")]
    pub work_policy: Option<Option<WorkPolicyInput>>,
}

/// Work policy input from JSON (mirrors WorkPolicy but uses human-friendly units).
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct WorkPolicyInput {
    /// Work start time in HH:MM format (e.g. "09:00", "22:00").
    pub work_start: String,
    /// Work end time in HH:MM format (e.g. "17:00", "06:00").
    pub work_end: String,
    /// Late threshold in minutes (default: 15).
    #[serde(default = "default_late_threshold")]
    pub late_threshold_minutes: u32,
    /// Minimum hours for a full work day (default: 4.0).
    #[serde(default = "default_min_hours")]
    pub min_hours_for_full_day: f64,
    /// Hours after which overtime starts (default: 8.0).
    #[serde(default = "default_overtime_after")]
    pub daily_overtime_after_hours: f64,
    /// Working days: [Mon, Tue, Wed, Thu, Fri, Sat, Sun] — true = working day.
    #[serde(default = "default_working_days")]
    pub working_days: [bool; 7],
}

fn default_late_threshold() -> u32 {
    15
}
fn default_min_hours() -> f64 {
    4.0
}
fn default_overtime_after() -> f64 {
    8.0
}
fn default_working_days() -> [bool; 7] {
    [true, true, true, true, true, false, false]
}

/// Custom deserializer for `Option<Option<WorkPolicyInput>>` —
/// distinguishes "field absent" from "field set to null".
fn deserialize_optional_work_policy<'de, D>(
    deserializer: D,
) -> Result<Option<Option<WorkPolicyInput>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<Option<WorkPolicyInput>>::deserialize(deserializer)
}

/// Custom deserializer for `Option<Option<String>>` —
/// distinguishes "field absent" from "field set to null".
fn deserialize_optional_string<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<Option<String>>::deserialize(deserializer)
}

// ─── Work Policy Template Requests ────────────────────────────────────

/// Create a new work policy template.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWorkPolicyTemplateRequest {
    /// Human-readable title (e.g. "Night Shift").
    pub title: String,
    /// Optional description shown in the UI.
    pub description: Option<String>,
    /// Work start time in HH:MM format.
    pub work_start: String,
    /// Work end time in HH:MM format.
    pub work_end: String,
    /// Late threshold in minutes (default: 15).
    #[serde(default = "default_late_threshold")]
    pub late_threshold_minutes: u32,
    /// Minimum hours for a full work day (default: 4.0).
    #[serde(default = "default_min_hours")]
    pub min_hours_for_full_day: f64,
    /// Hours after which overtime starts (default: 8.0).
    #[serde(default = "default_overtime_after")]
    pub daily_overtime_after_hours: f64,
    /// Working days: [Mon, Tue, Wed, Thu, Fri, Sat, Sun].
    #[serde(default = "default_working_days")]
    pub working_days: [bool; 7],
}

/// Update an existing work policy template.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateWorkPolicyTemplateRequest {
    /// New title.
    pub title: Option<String>,
    /// New description.
    #[serde(default, deserialize_with = "deserialize_optional_string")]
    pub description: Option<Option<String>>,
    /// New work start time.
    pub work_start: Option<String>,
    /// New work end time.
    pub work_end: Option<String>,
    /// New late threshold in minutes.
    pub late_threshold_minutes: Option<u32>,
    /// New minimum hours for a full day.
    pub min_hours_for_full_day: Option<f64>,
    /// New hours after which overtime starts.
    pub daily_overtime_after_hours: Option<f64>,
    /// New working days.
    pub working_days: Option<[bool; 7]>,
}

/// Update an existing employee.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateEmployeeRequest {
    /// New display name.
    pub name: Option<String>,
    /// New department UUID for cross-entity navigation.
    ///
    /// When provided, the department name is resolved and stored as the
    /// denormalized `department` display field on the response.
    pub department_id: Option<String>,
    /// New external ERP reference.
    pub external_id: Option<String>,
}

/// Query parameters for listing employees with optional filtering.
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct EmployeeListQuery {
    #[serde(flatten)]
    pub params: timekeep_core::ListParams,
    /// Full-text search query (uses Tantivy for smart search:
    /// typo-tolerant, ranked, across name/pin/external_id).
    /// Takes priority over `params.search` when both are present.
    pub q: Option<String>,
    /// Filter by department UUID (exact match).
    pub department_id: Option<String>,
    /// Filter by active status ("true" or "false").
    pub active: Option<String>,
}

/// Enroll an employee on a device.
#[derive(Debug, Deserialize, ToSchema)]
pub struct EnrollEmployeeRequest {
    /// Employee PIN on this device (may differ from primary PIN).
    pub pin: String,
    /// Biometric types to enroll (fingerprint, face, card, password).
    #[serde(default)]
    pub biometric_types: Vec<String>,
}

/// Request to transfer fingerprint templates from one device to another.
#[derive(Debug, Deserialize, ToSchema)]
pub struct TransferTemplatesRequest {
    /// Optional employee ID to filter templates. If omitted, transfers all.
    #[serde(default)]
    pub employee_id: Option<String>,
}

// ─── Work Day Queries ─────────────────────────────────────────────────

/// Query parameters for employee work-day listing.
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct WorkDayQuery {
    /// Unix timestamp (seconds) — start of date range (inclusive).
    pub from: Option<i64>,
    /// Unix timestamp (seconds) — end of date range (inclusive).
    pub to: Option<i64>,
}

// Facet metadata params
#[derive(Debug, Deserialize, IntoParams)]
pub struct FacetFilterParams {
    pub dimension: Option<String>,
    pub search: Option<String>,
    #[serde(default = "default_facet_limit")]
    pub limit: u32,
    pub device_sn: Option<String>,
    #[serde(default, alias = "device_sn[]")]
    pub device_sns: Option<Vec<String>>,
    pub user_pin: Option<String>,
    pub since: Option<i64>,
    pub until: Option<i64>,
    pub status: Option<String>,
    pub verify_mode: Option<String>,
    pub anomalies_only: Option<String>,
}

fn default_facet_limit() -> u32 {
    20
}

/// Generic facet filter params used by device, audit, and employee facet endpoints.
///
/// Filter fields (vendor, status, actor, etc.) are mapped into
/// `FacetContext.filters` as key-value pairs for contextual counting.
#[derive(Debug, Deserialize, IntoParams)]
pub struct GenericFacetParams {
    /// Specific dimension to query (omit for all dimensions).
    pub dimension: Option<String>,
    /// Search term for Reference-type facets.
    pub search: Option<String>,
    /// Max options to return per dimension.
    #[serde(default = "default_facet_limit")]
    pub limit: u32,
    /// Context filter: device vendor (e.g. "zkteco").
    pub vendor: Option<String>,
    /// Context filter: device status (e.g. "online").
    pub status: Option<String>,
    /// Context filter: device push_enabled ("true" or "false").
    pub push_enabled: Option<String>,
    /// Context filter: audit actor username.
    pub actor: Option<String>,
    /// Context filter: audit action prefix (e.g. "device.").
    pub action: Option<String>,
    /// Context filter: employee department.
    pub department: Option<String>,
    /// Context filter: employee active status ("true" or "false").
    pub active: Option<String>,
}
