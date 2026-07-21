//! Sync provider trait — generic interface for ERP/HRMS connectors.
//!
//! Each external system that syncs master data into Timekeep
//! (Odoo, SAP, custom ERP) implements this trait and registers
//! itself at startup. The dashboard and integration API query
//! providers generically — no provider-specific code in the API layer.

use async_trait::async_trait;

/// Read-only snapshot of a sync provider's health.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncProviderStatus {
    /// When the last sync cycle completed (Unix millis). None = never synced.
    pub last_sync_at: Option<i64>,

    /// Error from the last failed sync, if any.
    pub last_error: Option<String>,

    /// Total employees pulled from the external system.
    pub employees_synced: u32,

    /// Employees created during the last sync.
    pub created: u32,

    /// Employees updated during the last sync.
    pub updated: u32,

    /// Employees skipped (no PIN / not set up for biometric).
    pub skipped: u32,

    /// Departments created during the last sync.
    pub departments_created: u32,

    /// Departments updated during the last sync.
    pub departments_updated: u32,

    /// Human-readable health: "healthy", "degraded", "error", "inactive".
    pub health: String,

    /// Provider-specific display name (e.g. "Odoo", "SAP HCM").
    pub provider_name: String,

    /// Unique provider key used in URLs (e.g. "odoo", "sap").
    pub provider_key: String,
}

impl SyncProviderStatus {
    /// Build a status from per-provider stats.
    pub fn new(key: &str, name: &str, stats: ProviderSyncStats) -> Self {
        let health = if stats.last_error.is_some() {
            "error"
        } else if stats.last_sync_at.is_some() {
            "healthy"
        } else {
            "inactive"
        };

        Self {
            last_sync_at: stats.last_sync_at,
            last_error: stats.last_error,
            employees_synced: stats.employees_synced,
            created: stats.created,
            updated: stats.updated,
            skipped: stats.skipped,
            departments_created: stats.departments_created,
            departments_updated: stats.departments_updated,
            health: health.into(),
            provider_name: name.into(),
            provider_key: key.into(),
        }
    }

    /// Return a synthetic "not configured" status.
    pub fn inactive(key: &str, name: &str) -> Self {
        Self {
            last_sync_at: None,
            last_error: None,
            employees_synced: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            departments_created: 0,
            departments_updated: 0,
            health: "inactive".into(),
            provider_name: name.into(),
            provider_key: key.into(),
        }
    }
}

/// Stats bundle produced by a sync provider after each cycle.
#[derive(Debug, Clone, Default)]
pub struct ProviderSyncStats {
    pub last_sync_at: Option<i64>,
    pub last_error: Option<String>,
    pub employees_synced: u32,
    pub created: u32,
    pub updated: u32,
    pub skipped: u32,
    pub departments_created: u32,
    pub departments_updated: u32,
}

/// A sync provider pulls master data from an external system.
///
/// Each ERP/HRMS connector implements this trait. The API layer
/// queries providers generically — it never imports Odoo, SAP,
/// or any vendor-specific crate.
#[async_trait]
pub trait SyncProvider: Send + Sync {
    /// Stable, URL-safe provider key (e.g. "odoo", "sap_hcm").
    fn provider_key(&self) -> &str;

    /// Human-readable display name (e.g. "Odoo", "SAP HCM").
    fn provider_name(&self) -> &str;

    /// Current sync health snapshot.
    async fn status(&self) -> SyncProviderStatus;

    /// Trigger an immediate sync cycle.
    fn trigger_sync(&self);
}
