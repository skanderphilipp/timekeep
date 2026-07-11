//! Integration API authentication middleware.
//!
//! ## Bounded Context: Integration Auth
//!
//! The integration API (port 3001) is designed for machine-to-machine
//! communication — Odoo, Zapier, SAP, custom ERPs. It uses API keys
//! instead of JWT tokens.
//!
//! ## Auth flow
//!
//! ```text
//! Client → X-API-Key: ak_prod_abc123... → require_api_key
//!                                            │
//!                                            ├─ 1. SHA-256 hash the key
//!                                            ├─ 2. Look up in api_keys table
//!                                            ├─ 3. Check is_active (not revoked, not expired)
//!                                            ├─ 4. Verify permission: READ_PUNCHES required
//!                                            ├─ 5. Touch last_used_at
//!                                            └─ 6. Attach ApiKey Extension → handler
//! ```

use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use timekeep_core::{ApiKey, PermissionSet};

use crate::AppState;

/// Integration auth middleware: validates X-API-Key header against stored API keys.
///
/// Attaches [`ApiKey`] to the request via [`axum::Extension`] so handlers
/// can access the key's metadata (name, permissions, created_by, etc.).
pub async fn require_api_key(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = headers.get("X-API-Key").and_then(|v| v.to_str().ok()).unwrap_or("");

    if key.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Look up the key by its SHA-256 hash
    let key_hash = ApiKey::hash_key(key);
    let api_key = match state.storage.find_api_key_by_hash(&key_hash).await {
        Ok(Some(k)) => k,
        Ok(None) => {
            tracing::warn!("API key not found in storage");
            return Err(StatusCode::UNAUTHORIZED);
        },
        Err(e) => {
            tracing::error!(error = %e, "failed to look up API key in storage");
            return Err(StatusCode::UNAUTHORIZED);
        },
    };

    // Verify the key is active
    if !api_key.is_active() {
        tracing::warn!(key_id = %api_key.id, prefix = %api_key.prefix, "API key rejected: inactive");
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Verify the key has the required permission
    if !api_key.has_permission(PermissionSet::READ_PUNCHES) {
        tracing::warn!(
            key_id = %api_key.id,
            prefix = %api_key.prefix,
            permissions = %api_key.permissions.to_space_separated(),
            "API key rejected: insufficient permissions"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Touch last_used_at (fire-and-forget — don't block the request)
    let storage = Arc::clone(&state.storage);
    let key_id = api_key.id.clone();
    tokio::spawn(async move {
        if let Err(e) = storage.touch_api_key(&key_id).await {
            tracing::warn!(key_id = %key_id, error = %e, "failed to touch API key last_used_at");
        }
    });

    // Attach the API key to the request for handlers
    request.extensions_mut().insert(api_key);

    Ok(next.run(request).await)
}
