//! Entity schema metadata — column definitions, sort whitelists, and cursor config.
//!
//! Every listable entity (punches, devices, users, etc.) has a static [`EntitySchema`]
//! that describes its columns, which ones are sortable/filterable, the default sort,
//! and the tiebreaker column for stable keyset pagination.
//!
//! ## Usage
//!
//! 1. Storage layers use `schema.sort_column()` instead of inline match statements
//! 2. The schema endpoint (`GET /api/{entity}/schema`) serializes `EntitySchema` to JSON
//! 3. Cursor encoding/decoding uses the column types defined here
//!
//! ## Adding a new entity
//!
//! 1. Define a `const SCHEMA: EntitySchema` below
//! 2. Add it to the `entity_schema()` lookup function
//! 3. Export via `lib.rs`

use crate::facet::FacetKind;
use crate::query::SortOrder;

// ── Column value types ───────────────────────────────────────────────────

/// Type of a column value for cursor encoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum CursorValueType {
    /// 64-bit signed integer (timestamps, numeric IDs, counters).
    Int,
    /// UTF-8 string (PINs, serial numbers, names).
    Text,
}

// ── Column metadata ──────────────────────────────────────────────────────

/// Metadata for one column in an entity's list view.
#[derive(Debug, Clone, serde::Serialize, utoipa::ToSchema)]
pub struct ColumnMeta {
    /// API field name (e.g. "timestamp", "user_pin").
    pub field: &'static str,

    /// Human-readable label (e.g. "Time", "Employee PIN").
    pub label: &'static str,

    /// SQL column expression used in queries (e.g. "p.timestamp").
    /// For computed columns, this may be a SQL expression (e.g. "COALESCE(e.name, u.name)").
    #[serde(skip)]
    pub sql_column: &'static str,

    /// Value type for cursor encoding and filter comparison.
    pub value_type: CursorValueType,

    /// Whether this column supports server-side sorting.
    pub sortable: bool,

    /// Whether this column supports server-side filtering.
    pub filterable: bool,

    /// Facet dimension kind, if this column is usable as a filter facet.
    /// `None` means this column cannot be used as a facet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub facet_kind: Option<FacetKind>,
}

// ── Entity schema ────────────────────────────────────────────────────────

/// Schema metadata for a listable entity.
///
/// This is the single source of truth for column definitions, sort whitelists,
/// and keyset pagination configuration. The frontend data container consumes
/// this via `GET /api/{entity}/schema`.
#[derive(Debug, Clone, serde::Serialize, utoipa::ToSchema)]
pub struct EntitySchema {
    /// Entity name (e.g. "punch", "device", "audit").
    pub entity: &'static str,

    /// All columns in display order.
    pub columns: &'static [ColumnMeta],

    /// Default sort column field name.
    pub default_sort: &'static str,

    /// Default sort direction.
    pub default_sort_order: SortOrder,

    /// Tiebreaker column field name — must be unique per row.
    /// Used to guarantee stable keyset pagination boundaries.
    /// This column is always appended to the ORDER BY clause after the sort column.
    pub tiebreaker: &'static str,
}

impl EntitySchema {
    /// Look up a column by field name.
    pub fn find_column(&self, field: &str) -> Option<&ColumnMeta> {
        self.columns.iter().find(|c| c.field == field)
    }

    /// Get the SQL column expression for a field, falling back to the field name.
    pub fn sql_column(&self, field: &str) -> String {
        self.find_column(field).map(|c| c.sql_column).unwrap_or(field).to_string()
    }

    /// Resolve the sort column: use the provided field or fall back to the default.
    /// Validates against the schema's sortable columns. Returns the validated SQL-safe
    /// column expression and its sort order.
    pub fn sort_column(&self, sort_by: Option<&str>, sort_order: SortOrder) -> (String, SortOrder) {
        let field = sort_by
            .and_then(|f| self.find_column(f))
            .filter(|c| c.sortable)
            .map(|c| c.field)
            .unwrap_or(self.default_sort);

        let sql = self.sql_column(field);
        (sql, sort_order)
    }

    /// Get the sortable column field names (for the frontend column options).
    pub fn sortable_fields(&self) -> Vec<&str> {
        self.columns.iter().filter(|c| c.sortable).map(|c| c.field).collect()
    }

    /// Get cursor column definitions: `[(field_name, sql_expr, value_type)]` in the order
    /// they should appear in the cursor (sort column first, then tiebreaker).
    ///
    /// The field name is used by the API route handler to extract values from domain
    /// objects. The SQL expression is used by the storage layer for WHERE clause generation.
    pub fn cursor_columns(&self, sort_by: Option<&str>) -> Vec<(&str, &str, CursorValueType)> {
        let sort_field = sort_by
            .and_then(|f| self.find_column(f))
            .filter(|c| c.sortable)
            .map(|c| c.field)
            .unwrap_or(self.default_sort);

        let sort_col = self.find_column(sort_field);
        let tie_col = self.find_column(self.tiebreaker);

        let mut cols = Vec::with_capacity(2);
        if let Some(c) = sort_col {
            cols.push((c.field, c.sql_column, c.value_type));
        }
        // Only add tiebreaker if it's different from the sort column
        if let Some(c) = tie_col
            && c.field != sort_field
        {
            cols.push((c.field, c.sql_column, c.value_type));
        }
        cols
    }
}

// ── Per-entity schema definitions ────────────────────────────────────────

/// Schema for attendance punches.
pub const PUNCH_SCHEMA: EntitySchema = EntitySchema {
    entity: "punch",
    columns: &[
        ColumnMeta {
            field: "timestamp",
            label: "Time",
            sql_column: "p.timestamp",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "user_pin",
            label: "Employee PIN",
            sql_column: "p.user_pin",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "employee_name",
            label: "Employee",
            sql_column: "COALESCE(e.name, u.name)",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "device_sn",
            label: "Device",
            sql_column: "p.device_sn",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "device_label",
            label: "Device Name",
            sql_column: "d.label",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "status",
            label: "Status",
            sql_column: "p.status",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "verify_mode",
            label: "Method",
            sql_column: "p.verify_mode",
            value_type: CursorValueType::Int,
            sortable: false,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        // Internal tiebreaker column — not exposed to the frontend
        ColumnMeta {
            field: "id",
            label: "ID",
            sql_column: "p.id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "timestamp",
    default_sort_order: SortOrder::Desc,
    tiebreaker: "id",
};

/// Schema for devices (list view — DeviceConfig + enriched fields).
pub const DEVICE_SCHEMA: EntitySchema = EntitySchema {
    entity: "device",
    columns: &[
        ColumnMeta {
            field: "label",
            label: "Label",
            sql_column: "d.label",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "serial_number",
            label: "Serial Number",
            sql_column: "d.serial_number",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "host",
            label: "Host",
            sql_column: "d.host",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "vendor",
            label: "Vendor",
            sql_column: "d.vendor",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "push_enabled",
            label: "Push Enabled",
            sql_column: "d.push_enabled",
            value_type: CursorValueType::Int,
            sortable: false,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "status",
            label: "Status",
            sql_column: "COALESCE(di.status, 'offline')",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "location",
            label: "Location",
            sql_column: "d.location",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "last_seen_at",
            label: "Last Seen",
            sql_column: "di.last_seen",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "user_count",
            label: "Users",
            sql_column: "di.user_count",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "record_count",
            label: "Records",
            sql_column: "di.record_count",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "label",
    default_sort_order: SortOrder::Asc,
    tiebreaker: "serial_number",
};

/// Schema for audit log entries.
pub const AUDIT_SCHEMA: EntitySchema = EntitySchema {
    entity: "audit",
    columns: &[
        ColumnMeta {
            field: "timestamp",
            label: "Time",
            sql_column: "a.timestamp",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "actor",
            label: "Actor",
            sql_column: "a.actor",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "action",
            label: "Action",
            sql_column: "a.action",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "resource",
            label: "Resource",
            sql_column: "a.resource",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "status",
            label: "Status",
            sql_column: "a.status",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "ip_address",
            label: "IP Address",
            sql_column: "a.ip_address",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
        // Tiebreaker — internal id
        ColumnMeta {
            field: "id",
            label: "ID",
            sql_column: "a.id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "timestamp",
    default_sort_order: SortOrder::Desc,
    tiebreaker: "id",
};

/// Schema for employees (directory list view).
pub const DEPARTMENT_SCHEMA: EntitySchema = EntitySchema {
    entity: "department",
    columns: &[
        ColumnMeta {
            field: "name",
            label: "Name",
            sql_column: "d.name",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "employee_count",
            label: "Employees",
            sql_column: "d.employee_count",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "work_policy_id",
            label: "Work Policy",
            sql_column: "d.work_policy_id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "has_custom_policy",
            label: "Custom Policy",
            sql_column: "d.work_policy_json",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "created_at",
            label: "Created",
            sql_column: "d.created_at",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        // Tiebreaker
        ColumnMeta {
            field: "id",
            label: "ID",
            sql_column: "d.id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "name",
    default_sort_order: SortOrder::Asc,
    tiebreaker: "id",
};

pub const EMPLOYEE_SCHEMA: EntitySchema = EntitySchema {
    entity: "employee",
    columns: &[
        ColumnMeta {
            field: "pin",
            label: "PIN",
            sql_column: "e.pin",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "name",
            label: "Name",
            sql_column: "e.name",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "department",
            label: "Department",
            sql_column: "e.department_id",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Reference),
        },
        ColumnMeta {
            field: "external_id",
            label: "External ID",
            sql_column: "e.external_id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "active",
            label: "Status",
            sql_column: "e.active",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: true,
            facet_kind: Some(FacetKind::Enum),
        },
        ColumnMeta {
            field: "created_at",
            label: "Created",
            sql_column: "e.created_at",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        // Tiebreaker — internal id
        ColumnMeta {
            field: "id",
            label: "ID",
            sql_column: "e.id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "name",
    default_sort_order: SortOrder::Asc,
    tiebreaker: "id",
};

pub const WORK_POLICY_TEMPLATE_SCHEMA: EntitySchema = EntitySchema {
    entity: "work_policy",
    columns: &[
        ColumnMeta {
            field: "title",
            label: "Title",
            sql_column: "wpt.title",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: true,
            facet_kind: None,
        },
        ColumnMeta {
            field: "description",
            label: "Description",
            sql_column: "wpt.description",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "work_start",
            label: "Start Time",
            sql_column: "wpt.work_start",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "work_end",
            label: "End Time",
            sql_column: "wpt.work_end",
            value_type: CursorValueType::Text,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        ColumnMeta {
            field: "created_at",
            label: "Created",
            sql_column: "wpt.created_at",
            value_type: CursorValueType::Int,
            sortable: true,
            filterable: false,
            facet_kind: None,
        },
        // Tiebreaker
        ColumnMeta {
            field: "id",
            label: "ID",
            sql_column: "wpt.id",
            value_type: CursorValueType::Text,
            sortable: false,
            filterable: false,
            facet_kind: None,
        },
    ],
    default_sort: "title",
    default_sort_order: SortOrder::Asc,
    tiebreaker: "id",
};

/// Look up an entity schema by name.
pub fn entity_schema(entity: &str) -> Option<&'static EntitySchema> {
    match entity {
        "punch" => Some(&PUNCH_SCHEMA),
        "device" => Some(&DEVICE_SCHEMA),
        "audit" => Some(&AUDIT_SCHEMA),
        "employee" => Some(&EMPLOYEE_SCHEMA),
        "department" => Some(&DEPARTMENT_SCHEMA),
        "work_policy" => Some(&WORK_POLICY_TEMPLATE_SCHEMA),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_punch_schema_default_sort() {
        let (col, order) = PUNCH_SCHEMA.sort_column(None, SortOrder::Desc);
        assert_eq!(col, "p.timestamp");
        assert_eq!(order, SortOrder::Desc);
    }

    #[test]
    fn test_punch_schema_valid_sort() {
        let (col, _) = PUNCH_SCHEMA.sort_column(Some("user_pin"), SortOrder::Asc);
        assert_eq!(col, "p.user_pin");
    }

    #[test]
    fn test_punch_schema_invalid_sort_falls_back() {
        let (col, _) = PUNCH_SCHEMA.sort_column(Some("malicious; DROP"), SortOrder::Desc);
        assert_eq!(col, "p.timestamp"); // fallback to default
    }

    #[test]
    fn test_punch_schema_unsortable_falls_back() {
        let (col, _) = PUNCH_SCHEMA.sort_column(Some("verify_mode"), SortOrder::Asc);
        assert_eq!(col, "p.timestamp"); // verify_mode is not sortable, fallback
    }

    #[test]
    fn test_punch_cursor_columns_default() {
        let cols = PUNCH_SCHEMA.cursor_columns(None);
        assert_eq!(cols.len(), 2);
        // (field, sql_expr, type)
        assert_eq!(cols[0].0, "timestamp");
        assert_eq!(cols[0].1, "p.timestamp");
        assert_eq!(cols[0].2, CursorValueType::Int);
        assert_eq!(cols[1].0, "id");
        assert_eq!(cols[1].1, "p.id");
        assert_eq!(cols[1].2, CursorValueType::Text);
    }

    #[test]
    fn test_punch_cursor_columns_sort_by_non_sortable_falls_back() {
        // When sorting by a non-sortable column, it falls back to default sort.
        // The tiebreaker is still added (since default != tiebreaker).
        let cols = PUNCH_SCHEMA.cursor_columns(Some("id"));
        assert_eq!(cols.len(), 2);
        assert_eq!(cols[0].0, "timestamp"); // fallback to default
        assert_eq!(cols[1].0, "id");
    }

    #[test]
    fn test_sortable_fields() {
        let fields = PUNCH_SCHEMA.sortable_fields();
        assert!(fields.contains(&"timestamp"));
        assert!(fields.contains(&"user_pin"));
        assert!(fields.contains(&"device_sn"));
        assert!(fields.contains(&"status"));
        assert!(!fields.contains(&"verify_mode")); // not sortable
    }

    #[test]
    fn test_entity_schema_lookup() {
        assert!(entity_schema("punch").is_some());
        assert!(entity_schema("nonexistent").is_none());
    }
}
