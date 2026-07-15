//! Persistence for system-wide settings, provider registry, and health checks.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Combines three small concerns that didn't warrant separate traits:
//! system settings (2 methods), provider registry (2 methods), health check (1 method).

use async_trait::async_trait;

use crate::Error;
use crate::model::ProviderInfo;
use crate::model::settings::SystemSettings;

/// Persists system settings, provider registrations, and database health checks.
#[async_trait]
pub trait SettingsStore: Send + Sync {
    // ── System Settings ──────────────────────────────────────────────

    /// Load system settings. Returns defaults if none persisted.
    async fn get_system_settings(&self) -> Result<SystemSettings, Error> {
        Ok(SystemSettings::default())
    }

    /// Persist system settings.
    async fn upsert_system_settings(&self, _settings: &SystemSettings) -> Result<(), Error> {
        Err(Error::storage("system settings storage not implemented for this backend"))
    }

    // ── Provider Registry ─────────────────────────────────────────────

    /// Persist a provider registration (so it survives restarts).
    async fn register_provider(&self, _provider: &ProviderInfo) -> Result<(), Error> {
        Err(Error::storage("provider storage not implemented for this backend"))
    }

    /// List all persisted providers.
    async fn list_providers(&self) -> Result<Vec<ProviderInfo>, Error> {
        Ok(vec![])
    }

    // ── Health Check ──────────────────────────────────────────────────

    /// Health check — ping the database to verify connectivity.
    ///
    /// Implementations should run a lightweight query (e.g. `SELECT 1`)
    /// and return `Ok(())` if the database responds.
    async fn health_check(&self) -> Result<(), Error> {
        Ok(())
    }
}
