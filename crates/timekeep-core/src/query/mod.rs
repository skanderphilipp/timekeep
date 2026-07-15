//! Generic query infrastructure for list endpoints.
//!
//! Every list endpoint uses `ListParams` for consistent search, sort,
//! and pagination. Domain-specific filters (device_sn, date range, …)
//! are added as extra fields in endpoint-specific query structs that
//! compose `ListParams` via `#[serde(flatten)]`.
//!
//! ## Data Flow
//!
//! ```text
//! HTTP Query String
//!   ?search=office&sort_by=label&sort_order=asc&limit=20
//!        │
//!        ▼
//!   ListParams (deserialized by serde)
//!        │
//!        ▼
//!   DomainFilter { params: ListParams, …domain extras… }
//!        │
//!        ▼
//!   Storage::list_*_filtered(&filter) → ListResult<T>
//!        │
//!        ▼
//!   ApiEnvelope<T> + PageMeta
//! ```
//!
//! ## Adding a new list endpoint
//!
//! 1. If no domain-specific filters: handler takes `Query<ListParams>`
//! 2. If domain-specific filters: define a query struct with
//!    `#[serde(flatten)] params: ListParams` + your extra fields
//! 3. Define a domain filter struct in the storage trait
//! 4. Implement the storage method

pub mod cursor;
pub mod filters;
pub mod schema;

use serde::Deserialize;
use serde::de::{self, Deserializer, Visitor};
use std::fmt;

/// Sort direction for list queries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

impl SortOrder {
    pub fn is_desc(&self) -> bool {
        matches!(self, Self::Desc)
    }

    pub fn as_sql(&self) -> &'static str {
        match self {
            Self::Asc => "ASC",
            Self::Desc => "DESC",
        }
    }

    /// Convenience: sort column + direction as SQL fragment.
    /// The column is validated against the whitelist by the caller.
    pub fn order_clause(&self, column: &str) -> String {
        format!("{column} {}", self.as_sql())
    }
}

/// Reusable query parameters for ANY list endpoint.
///
/// Compose this into endpoint-specific query structs via `#[serde(flatten)]`:
///
/// ```ignore
/// #[derive(Deserialize)]
/// struct PunchListQuery {
///     #[serde(flatten)]
///     params: ListParams,
///     device_sn: Option<String>,
/// }
/// ```
///
/// If no extra fields are needed, use `Query<ListParams>` directly.
#[derive(Debug, Clone, Deserialize, utoipa::ToSchema, utoipa::IntoParams)]
pub struct ListParams {
    /// Full-text search. Meaning is endpoint-specific
    /// (devices: label+serial, punches: user_pin, endpoints: name+kind).
    pub search: Option<String>,

    /// Field to sort by. Validated against a whitelist per endpoint.
    pub sort_by: Option<String>,

    /// Sort direction. Default: desc.
    #[serde(default)]
    pub sort_order: SortOrder,

    /// Items per page. Default: 50. Max: 200.
    ///
    /// Custom deserializer: Axum 0.8's query parser passes all values
    /// through `visit_str` when used with `#[serde(flatten)]`, but the
    /// default `u32` deserializer rejects strings. This accepts both
    /// `visit_str` (query params) and `visit_u64`/`visit_i64` (JSON).
    #[serde(default = "default_limit", deserialize_with = "deserialize_limit")]
    pub limit: u32,

    /// Opaque cursor for cursor-based pagination.
    pub cursor: Option<String>,
}

/// Custom deserializer for the `limit` field.
///
/// Axum 0.8 (and other query-string deserializers) pass values as
/// strings through `visit_str` when the field is inside a
/// `#[serde(flatten)]` struct. The default `u32` deserializer
/// rejects strings — this accepts them and parses the integer.
fn deserialize_limit<'de, D: Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    struct LimitVisitor;

    impl<'de> Visitor<'de> for LimitVisitor {
        type Value = u32;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a positive integer (string or number)")
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<u32, E> {
            v.parse::<u32>().map_err(|_| E::custom(format!("invalid limit: {v}")))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<u32, E> {
            Ok(v as u32)
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<u32, E> {
            u32::try_from(v).map_err(|_| E::custom(format!("negative limit: {v}")))
        }
    }

    d.deserialize_any(LimitVisitor)
}

fn default_limit() -> u32 {
    50
}

impl Default for ListParams {
    fn default() -> Self {
        Self {
            search: None,
            sort_by: None,
            sort_order: SortOrder::default(),
            limit: default_limit(),
            cursor: None,
        }
    }
}

impl ListParams {
    /// Clamp limit to the allowed range.
    pub fn clamped_limit(&self) -> u32 {
        self.limit.clamp(1, 200)
    }

    /// Resolve sort column: use the provided value or fall back to default.
    /// Validates against a whitelist. Returns the validated, SQL-safe column name.
    pub fn sort_column(&self, default: &str, allowed: &[&str]) -> String {
        let col = self.sort_by.as_deref().unwrap_or(default);
        if allowed.contains(&col) { col.to_string() } else { default.to_string() }
    }
}

/// Result of a filtered list query with pagination metadata.
#[derive(Debug, Clone)]
pub struct ListResult<T> {
    pub items: Vec<T>,
    /// Total matching items (None when counting is too expensive).
    pub total: Option<u64>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

impl<T> ListResult<T> {
    pub fn single_page(items: Vec<T>) -> Self {
        let total = items.len() as u64;
        Self { items, total: Some(total), has_more: false, next_cursor: None }
    }

    pub fn paginated(
        items: Vec<T>,
        total: u64,
        has_more: bool,
        next_cursor: Option<String>,
    ) -> Self {
        Self { items, total: Some(total), has_more, next_cursor }
    }
}

/// Escape special SQL LIKE characters and wrap for substring search.
pub fn sanitize_search(raw: &str) -> String {
    let escaped = raw.replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

// Re-export filter types from the sub-module
pub use filters::{DeviceEventFilter, DeviceFilter, EndpointFilter, PunchFilter};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sort_order_default() {
        assert_eq!(SortOrder::default(), SortOrder::Desc);
    }

    #[test]
    fn test_sort_order_sql() {
        assert_eq!(SortOrder::Asc.as_sql(), "ASC");
        assert_eq!(SortOrder::Desc.as_sql(), "DESC");
    }

    #[test]
    fn test_list_params_clamped_limit() {
        assert_eq!(ListParams::default().clamped_limit(), 50);
        assert_eq!(ListParams { limit: 500, ..Default::default() }.clamped_limit(), 200);
    }

    #[test]
    fn test_sort_column_whitelist() {
        let params = ListParams { sort_by: Some("name".into()), ..Default::default() };
        assert_eq!(params.sort_column("label", &["label", "name"]), "name");
    }

    #[test]
    fn test_sort_column_rejects_unknown() {
        let params = ListParams { sort_by: Some("malicious; DROP".into()), ..Default::default() };
        assert_eq!(params.sort_column("label", &["label"]), "label");
    }

    #[test]
    fn test_sanitize_search() {
        let result = sanitize_search("test_%");
        assert!(result.contains("\\_"));
        assert!(result.contains("\\%"));
    }

    #[test]
    fn test_list_params_flatten_deser() {
        // Simulate what serde(flatten) does with query string
        let json = r#"{"search":"office","sort_by":"label","sort_order":"asc","limit":20,"device_sn":"SN001"}"#;
        #[derive(Deserialize)]
        struct TestQuery {
            #[serde(flatten)]
            params: ListParams,
            device_sn: Option<String>,
        }
        let q: TestQuery = serde_json::from_str(json).unwrap();
        assert_eq!(q.params.search.as_deref(), Some("office"));
        assert_eq!(q.params.limit, 20);
        assert_eq!(q.device_sn.as_deref(), Some("SN001"));
    }
}
