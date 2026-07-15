//! Full-text search types for the Tantivy-powered search layer.
//!
//! These types define the contract between the API layer and the search
//! backend. They are intentionally generic — the same types work whether
//! the backend is Tantivy, Meilisearch, or a simple SQL LIKE fallback.

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// A search query submitted by the client.
///
/// Every search-capable endpoint uses this struct (or a subset of its
/// fields via `#[serde(flatten)]`).
#[derive(Debug, Clone, Deserialize, IntoParams, ToSchema)]
pub struct SearchQuery {
    /// Free-text search string. Supports:
    /// - Single terms: `ahmed`
    /// - Multiple terms (AND): `ahmed engineering`
    /// - Fuzzy matching (typo tolerance, Levenshtein distance 1)
    pub q: String,

    /// Limit results to a specific entity type.
    ///
    /// Valid values: `"employee"`, `"device"`, `"punch"`.
    /// When `None`, searches across ALL indexable entities (global search).
    #[serde(default)]
    pub entity_type: Option<String>,

    /// Maximum number of hits to return (default: 20, max: 100).
    #[serde(default = "default_search_limit")]
    pub limit: u32,

    /// Offset for pagination (0-based).
    #[serde(default)]
    pub offset: u32,
}

fn default_search_limit() -> u32 {
    20
}

impl Default for SearchQuery {
    fn default() -> Self {
        Self { q: String::new(), entity_type: None, limit: default_search_limit(), offset: 0 }
    }
}

impl SearchQuery {
    /// Clamp limit to the allowed range.
    #[must_use]
    pub fn clamped_limit(&self) -> u32 {
        self.limit.clamp(1, 100)
    }
}

/// A single search result hit.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SearchHit {
    /// Entity type discriminator: `"employee"`, `"device"`, etc.
    pub entity_type: String,

    /// Unique identifier of the entity (maps to the DB primary key).
    pub entity_id: String,

    /// BM25 relevance score (higher = more relevant).
    pub score: f32,

    /// Primary display label (e.g. employee name, device label).
    pub title: String,

    /// Secondary context line (e.g. department, device serial).
    pub subtitle: String,

    /// HTML-escaped snippet with `<mark>` tags around matching terms.
    /// `None` when highlighting is not available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted: Option<String>,
}

/// Paginated search results.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SearchResults {
    /// Matching hits, ordered by relevance (score descending).
    pub hits: Vec<SearchHit>,

    /// Total number of matching documents (across all pages).
    pub total: u64,

    /// Whether more results exist beyond this page.
    pub has_more: bool,
}

impl SearchResults {
    /// Create an empty result set.
    #[must_use]
    pub fn empty() -> Self {
        Self { hits: Vec::new(), total: 0, has_more: false }
    }

    /// Create results from a (possibly truncated) list of hits.
    #[must_use]
    pub fn new(hits: Vec<SearchHit>, total: u64, has_more: bool) -> Self {
        Self { hits, total, has_more }
    }
}
