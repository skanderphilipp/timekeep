//! Sparse field sets and relationship includes for REST responses.
//!
//! Adds GraphQL-style field selection and eager-loading to REST endpoints
//! without the overhead of a full GraphQL engine. Clients pass `?fields=`
//! and `?include=` query parameters to control response shape.
//!
//! ## Usage
//!
//! ```text
//! GET /api/employees?fields=id,name,department&include=punchSummary
//! ```
//!
//! - `fields` — comma-separated list of field names to include in the response.
//!   Unknown fields are silently ignored (forward-compatible). Omit to get all.
//! - `include` — comma-separated list of relationship names to eagerly resolve.
//!   Each name maps to a handler-defined resolver. Unknown names are silently
//!   ignored.
//!
//! ## Security
//!
//! Field selectors are never used to restrict SQL columns (that's the schema's
//! job). They filter the *serialized JSON* after the full domain object is
//! assembled — safe by construction.

use std::collections::HashSet;

/// Parsed `?fields=` query parameter.
///
/// When `None`, all fields are returned (no filtering).
/// When `Some(inner)`, only fields whose JSON keys match the set are included.
///
/// Unknown field names are silently discarded — the client may request
/// fields that don't exist on this entity without error. This is
/// forward-compatible: adding a field to the API doesn't break old clients
/// that don't know about it yet.
#[derive(Debug, Clone, Default)]
pub struct FieldSelector(Option<HashSet<String>>);

impl FieldSelector {
    /// Parse from a raw query string value.
    ///
    /// Empty or whitespace-only strings produce `FieldSelector(None)`
    /// (no filtering). Duplicate field names are deduplicated.
    /// Individual field names are trimmed and lowercased for
    /// case-insensitive matching against JSON keys.
    pub fn parse(raw: Option<&str>) -> Self {
        let raw = match raw {
            Some(s) if !s.trim().is_empty() => s,
            _ => return Self(None),
        };

        let fields: HashSet<String> = raw
            .split(',')
            .map(str::trim)
            .filter(|f| !f.is_empty())
            .map(|f| f.to_lowercase())
            .collect();

        if fields.is_empty() { Self(None) } else { Self(Some(fields)) }
    }

    /// Returns `true` when no field restriction is active (return all fields).
    pub fn is_wildcard(&self) -> bool {
        self.0.is_none()
    }

    /// Check whether a JSON key is allowed by this selector.
    ///
    /// Matching is case-insensitive: the selector lowercases input at parse
    /// time, and the key is lowercased at check time.
    pub fn allows(&self, json_key: &str) -> bool {
        match &self.0 {
            None => true,
            Some(allowed) => allowed.contains(&json_key.to_lowercase()),
        }
    }

    /// Return the number of fields in this selector.
    /// Returns 0 when wildcard (no restriction).
    pub fn len(&self) -> usize {
        self.0.as_ref().map_or(0, |s| s.len())
    }
}

/// Convenience: parse from `Option<String>` (the shape coming off `ListParams.fields`).
impl From<&Option<String>> for FieldSelector {
    fn from(fields: &Option<String>) -> Self {
        Self::parse(fields.as_deref())
    }
}

impl From<Option<String>> for FieldSelector {
    fn from(fields: Option<String>) -> Self {
        Self::parse(fields.as_deref())
    }
}

/// Pass-through: when you already have a FieldSelector, just clone it.
impl From<&FieldSelector> for FieldSelector {
    fn from(fs: &FieldSelector) -> Self {
        fs.clone()
    }
}

/// Parsed `?include=` query parameter.
///
/// Each value names a relationship that the handler should eagerly resolve
/// and inject into the response under a key matching the include name.
///
/// Unknown include names are silently ignored — handlers resolve only the
/// relationships they know about.
#[derive(Debug, Clone, Default)]
pub struct IncludeDirective(HashSet<String>);

impl IncludeDirective {
    /// Parse from a raw query string value.
    pub fn parse(raw: Option<&str>) -> Self {
        let raw = match raw {
            Some(s) if !s.trim().is_empty() => s,
            _ => return Self(HashSet::new()),
        };

        let includes: HashSet<String> = raw
            .split(',')
            .map(str::trim)
            .filter(|f| !f.is_empty())
            .map(|f| f.to_lowercase())
            .collect();

        Self(includes)
    }

    /// Check whether a named relationship was requested.
    pub fn wants(&self, name: &str) -> bool {
        self.0.contains(&name.to_lowercase())
    }

    /// Whether any includes were requested.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Number of requested includes.
    pub fn len(&self) -> usize {
        self.0.len()
    }
}

impl From<&Option<String>> for IncludeDirective {
    fn from(include: &Option<String>) -> Self {
        Self::parse(include.as_deref())
    }
}

impl From<Option<String>> for IncludeDirective {
    fn from(include: Option<String>) -> Self {
        Self::parse(include.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── FieldSelector ──────────────────────────────────────────────

    #[test]
    fn empty_is_wildcard() {
        let fs = FieldSelector::parse(None);
        assert!(fs.is_wildcard());
        assert!(fs.allows("anything"));
    }

    #[test]
    fn whitespace_only_is_wildcard() {
        let fs = FieldSelector::parse(Some("  "));
        assert!(fs.is_wildcard());
    }

    #[test]
    fn parses_simple_list() {
        let fs = FieldSelector::parse(Some("id,name,status"));
        assert!(!fs.is_wildcard());
        assert!(fs.allows("id"));
        assert!(fs.allows("name"));
        assert!(fs.allows("STATUS")); // case-insensitive
        assert!(!fs.allows("device_sn"));
    }

    #[test]
    fn deduplicates() {
        let fs = FieldSelector::parse(Some("id,id,name"));
        assert_eq!(fs.len(), 2);
    }

    #[test]
    fn strips_whitespace() {
        let fs = FieldSelector::parse(Some(" id , name , status "));
        assert!(fs.allows("id"));
        assert!(fs.allows("name"));
        assert_eq!(fs.len(), 3);
    }

    #[test]
    fn empty_trailing_comma_ignored() {
        let fs = FieldSelector::parse(Some("id,name,"));
        assert_eq!(fs.len(), 2);
    }

    // ── IncludeDirective ──────────────────────────────────────────

    #[test]
    fn empty_include_is_empty() {
        let inc = IncludeDirective::parse(None);
        assert!(inc.is_empty());
        assert!(!inc.wants("anything"));
    }

    #[test]
    fn parses_includes() {
        let inc = IncludeDirective::parse(Some("department,recentPunches"));
        assert!(inc.wants("department"));
        assert!(inc.wants("recentpunches")); // case-insensitive
        assert!(!inc.wants("devices"));
        assert_eq!(inc.len(), 2);
    }
}
