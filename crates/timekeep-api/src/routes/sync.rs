//! Sync provider routes — generic interface for ERP/HRMS connectors.
//!
//! These routes are provider-agnostic. They work with any connector
//! (Odoo, SAP, custom ERP) that implements the `SyncProvider` trait.
//! No provider-specific code lives in the API layer.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use serde::Serialize;
use timekeep_core::traits::sync_provider::SyncProviderStatus;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::response::ApiEnvelope;

// ─── API-layer DTOs (with ToSchema, kept separate from core types) ───

/// Response for listing all sync providers.
#[derive(Debug, Serialize, ToSchema)]
pub struct ProviderListResponse {
    pub providers: Vec<ProviderStatusDto>,
}

/// API-safe snapshot of a sync provider's health.
/// Mirrors `timekeep_core::SyncProviderStatus` but adds `ToSchema`.
#[derive(Debug, Serialize, ToSchema)]
pub struct ProviderStatusDto {
    pub last_sync_at: Option<i64>,
    pub last_error: Option<String>,
    pub employees_synced: u32,
    pub created: u32,
    pub updated: u32,
    pub skipped: u32,
    pub departments_created: u32,
    pub departments_updated: u32,
    pub health: String,
    pub provider_name: String,
    pub provider_key: String,
}

impl From<SyncProviderStatus> for ProviderStatusDto {
    fn from(s: SyncProviderStatus) -> Self {
        Self {
            last_sync_at: s.last_sync_at,
            last_error: s.last_error,
            employees_synced: s.employees_synced,
            created: s.created,
            updated: s.updated,
            skipped: s.skipped,
            departments_created: s.departments_created,
            departments_updated: s.departments_updated,
            health: s.health,
            provider_name: s.provider_name,
            provider_key: s.provider_key,
        }
    }
}

/// Response after triggering a sync.
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncTriggerResponse {
    pub status: String,
    pub provider: String,
}

// ─── Route Handlers ──────────────────────────────────────────────────

/// List all registered sync providers and their health.
pub async fn list_providers(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<ProviderListResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let guard = state.sync_providers.lock().await;
    let mut providers: Vec<ProviderStatusDto> = Vec::with_capacity(guard.len());

    for provider in guard.values() {
        let status = provider.status().await;
        providers.push(ProviderStatusDto::from(status));
    }

    providers.sort_by(|a, b| a.provider_key.cmp(&b.provider_key));
    Ok(Json(ApiEnvelope::success(ProviderListResponse { providers })))
}

/// Get status for a specific sync provider.
///
/// Returns 404 if the provider is not registered.
pub async fn provider_status(
    State(state): State<AppState>,
    Path(provider_key): Path<String>,
) -> Result<Json<ApiEnvelope<ProviderStatusDto>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let guard = state.sync_providers.lock().await;

    let provider = guard.get(&provider_key).ok_or_else(|| {
        let err = crate::response::ApiError::not_found(format!(
            "sync provider '{provider_key}' not found"
        ));
        (StatusCode::NOT_FOUND, Json(ApiEnvelope::error(err)))
    })?;

    let status = provider.status().await;
    Ok(Json(ApiEnvelope::success(ProviderStatusDto::from(status))))
}

/// Trigger an immediate sync for a specific provider.
pub async fn trigger_provider(
    State(state): State<AppState>,
    Path(provider_key): Path<String>,
) -> Result<Json<ApiEnvelope<SyncTriggerResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let guard = state.sync_providers.lock().await;

    let provider = guard.get(&provider_key).ok_or_else(|| {
        let err = crate::response::ApiError::not_found(format!(
            "sync provider '{provider_key}' not found"
        ));
        (StatusCode::NOT_FOUND, Json(ApiEnvelope::error(err)))
    })?;

    provider.trigger_sync();
    let name = provider.provider_name().to_string();
    tracing::info!(provider = %provider_key, "sync triggered via API");

    Ok(Json(ApiEnvelope::success(SyncTriggerResponse {
        status: "triggered".into(),
        provider: name,
    })))
}
