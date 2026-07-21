//! Integration endpoint domain model.
//!
//! Each integration endpoint represents one destination where attendance
//! events are delivered. Tenants configure endpoints from the dashboard
//! — no code changes needed when a new integration partner is added.
//!
//! ## Design
//!
//! ```text
//! integration_endpoints table:
//!   id           UUID v7
//!   name         "Odoo Production"
//!   kind         "odoo" | "webhook" | "sap" | "zapier"
//!   enabled      bool
//!   config       JSONB — type-specific (url, api_key, database, secret, …)
//!   created_at   Unix timestamp
//!   updated_at   Unix timestamp
//! ```
//!
//! Adding a new integration type:
//! 1. Add variant to `IntegrationKind`
//! 2. Build distributor crate (e.g. `timekeep-dist-sap`)
//! 3. Register in the engine's distributor factory
//! 4. Add UI form component in the dashboard
//!
//! No schema migration needed — `config` is a JSON blob that carries
//! whatever fields the specific integration type requires.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Default field on Odoo's `hr.employee` model used to map device PINs.
///
/// Odoo's native field is `barcode`. Custom addons (e.g. `alsabah_hr_attendance`)
/// may provide `device_id_num`. The tenant configures this per-endpoint.
pub const ODOO_DEFAULT_EMPLOYEE_FIELD: &str = "barcode";

/// Supported integration types.
///
/// Each variant corresponds to a distributor crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum IntegrationKind {
    /// Outbound HTTP webhook — POSTs JSON payloads to any URL.
    /// Config: `{ "url": "...", "secret": "..." }`
    Webhook,

    /// Odoo ERP via JSON-2 API — creates/updates hr.attendance records.
    /// Config: `{ "url": "...", "api_key": "...", "database": "...", "employee_field": "barcode" }`
    Odoo,

    /// Future: SAP BAPI / RFC integration.
    #[serde(rename = "sap")]
    Sap,

    /// Future: Zapier webhook (reuses Webhook distributor).
    #[serde(rename = "zapier")]
    Zapier,
}

impl IntegrationKind {
    /// Human-readable label for the UI.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Webhook => "Webhook",
            Self::Odoo => "Odoo",
            Self::Sap => "SAP",
            Self::Zapier => "Zapier",
        }
    }

    /// All supported kinds.
    pub fn all() -> &'static [Self] {
        &[Self::Webhook, Self::Odoo, Self::Sap, Self::Zapier]
    }

    /// Parse from a string (case-insensitive).
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "webhook" => Some(Self::Webhook),
            "odoo" => Some(Self::Odoo),
            "sap" => Some(Self::Sap),
            "zapier" => Some(Self::Zapier),
            _ => None,
        }
    }
}

impl std::fmt::Display for IntegrationKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Webhook => "webhook",
            Self::Odoo => "odoo",
            Self::Sap => "sap",
            Self::Zapier => "zapier",
        };
        f.write_str(s)
    }
}

/// Extracted Odoo connection parameters from an endpoint's config blob.
///
/// Produced by [`IntegrationEndpoint::odoo_connection`] — eliminates
/// repeated JSON-key fishing across the composition layer.
#[derive(Debug, Clone)]
pub struct OdooConnectionConfig {
    pub url: String,
    pub api_key: String,
    pub database: String,
    pub employee_field: String,
}

/// A single integration endpoint — where attendance events are delivered.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationEndpoint {
    /// Unique identifier (UUID v7).
    pub id: String,

    /// Human-readable name (e.g. "Odoo Production", "Slack #attendance").
    pub name: String,

    /// The type of integration — determines which distributor handles it.
    pub kind: IntegrationKind,

    /// Whether this endpoint is actively receiving events.
    pub enabled: bool,

    /// Type-specific configuration as a JSON object.
    pub config: serde_json::Value,

    /// Unix timestamp of creation.
    pub created_at: i64,

    /// Unix timestamp of last modification.
    pub updated_at: i64,
}

impl IntegrationEndpoint {
    /// Create a new endpoint with default config for the given kind.
    pub fn new(name: String, kind: IntegrationKind) -> Self {
        let now = jiff::Timestamp::now().as_second();
        let default_config = Self::default_config(kind);

        Self {
            id: uuid::Uuid::now_v7().to_string(),
            name,
            kind,
            enabled: false,
            config: default_config,
            created_at: now,
            updated_at: now,
        }
    }

    fn default_config(kind: IntegrationKind) -> serde_json::Value {
        match kind {
            IntegrationKind::Webhook => serde_json::json!({
                "url": "",
                "secret": ""
            }),
            IntegrationKind::Odoo => serde_json::json!({
                "url": "",
                "api_key": "",
                "database": "",
                "employee_field": ODOO_DEFAULT_EMPLOYEE_FIELD
            }),
            IntegrationKind::Sap => serde_json::json!({}),
            IntegrationKind::Zapier => serde_json::json!({
                "url": "",
                "secret": ""
            }),
        }
    }

    /// Extract Odoo connection parameters from this endpoint's config.
    ///
    /// Returns `None` when any required field (`url`, `api_key`, `database`)
    /// is empty, or when this endpoint is not of kind `Odoo`.
    pub fn odoo_connection(&self) -> Option<OdooConnectionConfig> {
        if self.kind != IntegrationKind::Odoo {
            return None;
        }

        let url = self.config["url"].as_str().unwrap_or_default().to_string();
        let api_key = self.config["api_key"].as_str().unwrap_or_default().to_string();
        let database = self.config["database"].as_str().unwrap_or_default().to_string();
        let employee_field = self.config["employee_field"]
            .as_str()
            .unwrap_or(ODOO_DEFAULT_EMPLOYEE_FIELD)
            .to_string();

        if url.is_empty() || api_key.is_empty() || database.is_empty() {
            return None;
        }

        Some(OdooConnectionConfig { url, api_key, database, employee_field })
    }
}

/// System-wide settings that control engine behavior.
///
/// Persisted in the `settings` table under the `"system"` key.
/// These are NOT per-integration — they affect the core engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSettings {
    /// How often (in seconds) the engine SDK-polls each connected
    /// scanner for new attendance records.
    ///
    /// SDK pull runs in parallel with ADMS push (real-time events).
    /// Together they ensure no data is lost during network blips
    /// or device reboots.
    ///
    /// Default: 60s. Min: 5s. Max: 3600s.
    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u32,

    /// Whether to periodically scan the local network for new
    /// ZKTeco scanners via UDP broadcast discovery.
    /// When a new scanner is found, it's added to the device
    /// registry and appears in the dashboard for configuration.
    #[serde(default)]
    pub auto_discover: bool,

    /// Work schedule rules: start/end times, late threshold,
    /// overtime threshold, and working days.
    /// Controls how attendance is evaluated across the entire app.
    #[serde(default)]
    pub work_policy: crate::model::WorkPolicy,

    /// Support email shown in the dashboard footer and error pages.
    /// Set by the admin during initial configuration. When empty,
    /// no support contact is displayed.
    #[serde(default)]
    pub support_email: String,

    /// Workspace / company name shown on the login and setup screens.
    /// Set during initial setup. When empty, the app name is used as fallback.
    #[serde(default)]
    pub workspace_name: String,
}

fn default_poll_interval() -> u32 {
    60
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            poll_interval_secs: 60,
            auto_discover: false,
            work_policy: crate::model::WorkPolicy::standard_9to5(),
            support_email: String::new(),
            workspace_name: String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kind_roundtrip() {
        for kind in IntegrationKind::all() {
            let s = kind.to_string();
            let parsed = IntegrationKind::from_str(&s).unwrap();
            assert_eq!(*kind, parsed);
        }
    }

    #[test]
    fn test_kind_from_str_case_insensitive() {
        assert_eq!(IntegrationKind::from_str("WEBHOOK"), Some(IntegrationKind::Webhook));
        assert_eq!(IntegrationKind::from_str("Odoo"), Some(IntegrationKind::Odoo));
    }

    #[test]
    fn test_kind_from_str_unknown() {
        assert_eq!(IntegrationKind::from_str("slack"), None);
    }

    #[test]
    fn test_all_kinds() {
        assert_eq!(IntegrationKind::all().len(), 4);
    }

    #[test]
    fn test_endpoint_default_configs() {
        let webhook = IntegrationEndpoint::new("w".into(), IntegrationKind::Webhook);
        assert!(webhook.config.get("url").is_some());

        let odoo = IntegrationEndpoint::new("o".into(), IntegrationKind::Odoo);
        assert!(odoo.config.get("database").is_some());
    }
}
