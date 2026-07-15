//! Global full-text search endpoint.
//!
//! Provides a unified search across all indexable entities (employees,
//! punches, devices) via the Tantivy search index. Clients can optionally
//! filter by `entity_type` or search across everything.

use axum::Json;
use axum::extract::{Query, State};

use crate::app_state::AppState;
use crate::response::{ApiEnvelope, AppError, PageMeta};

/// Search across all indexable entities.
///
/// Supports `?q=term` for full-text search with typo tolerance, and
/// optional `?entity_type=employee|punch|device` to scope results.
#[utoipa::path(
    get,
    path = "/api/search",
    tag = "Search",
    security(("bearer_auth" = [])),
    params(timekeep_core::SearchQuery),
    responses(
        (status = 200, description = "Search results across entities", body = timekeep_core::SearchResults),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn global_search(
    State(state): State<AppState>,
    Query(mut query): Query<timekeep_core::SearchQuery>,
) -> Result<Json<ApiEnvelope<timekeep_core::SearchResults>>, AppError> {
    if query.q.trim().is_empty() {
        return Ok(Json(ApiEnvelope::success(timekeep_core::SearchResults::empty())));
    }

    // Clamp limit
    query.limit = query.limit.clamp(1, 100);

    let results = match &state.search {
        Some(search) => search
            .search(&query)
            .await
            .map_err(|e| AppError::Internal(format!("search failed: {e}")))?,
        None => {
            // No search backend configured — return empty results
            return Ok(Json(ApiEnvelope::success(timekeep_core::SearchResults::empty())));
        },
    };

    let meta =
        if results.has_more { PageMeta::has_more(String::new()) } else { PageMeta::single() };

    Ok(Json(ApiEnvelope::paginated(results, meta)))
}
