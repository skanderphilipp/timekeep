//! Persistence for integration API keys.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! API keys authenticate integration partners (webhook consumers, Odoo instances).
//! Keys are stored as SHA-256 hashes — the raw key is only shown once at creation.

use async_trait::async_trait;

use crate::Error;
use crate::model::iam::ApiKey;

/// Persists and queries integration API keys.
#[async_trait]
pub trait ApiKeyStore: Send + Sync {
    /// Create a new API key for integration partners.
    async fn create_api_key(&self, _key: &ApiKey) -> Result<(), Error> {
        Err(Error::storage("API key storage not implemented for this backend"))
    }

    /// Look up an API key by its SHA-256 hash.
    /// Returns `None` if the key doesn't exist or has been revoked.
    async fn find_api_key_by_hash(&self, _key_hash: &str) -> Result<Option<ApiKey>, Error> {
        Ok(None)
    }

    /// List all API keys (metadata only — no key hashes returned).
    async fn list_api_keys(&self) -> Result<Vec<ApiKey>, Error> {
        Ok(vec![])
    }

    /// Revoke an API key by its ID.
    async fn revoke_api_key(&self, _key_id: &str) -> Result<(), Error> {
        Err(Error::storage("API key storage not implemented for this backend"))
    }

    /// Update the `last_used_at` timestamp on an API key.
    async fn touch_api_key(&self, _key_id: &str) -> Result<(), Error> {
        Ok(())
    }
}
