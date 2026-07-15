//! Cursor encoding/decoding for keyset pagination tokens.
//!
//! Cursors are opaque, URL-safe base64 tokens that encode the values of sort
//! columns at a page boundary. Unlike offset-based pagination, keyset cursors
//! produce stable, deterministic page boundaries even when rows share values
//! in the sort column (via a tiebreaker).
//!
//! ## Format
//!
//! The raw payload is a JSON array of `[type, value]` tuples:
//! ```json
//! [["int", 1700000000], ["text", "abc123def456"]]
//! ```
//! This is encoded as URL-safe base64 (no padding).
//!
//! ## Usage in storage layers
//!
//! ```ignore
//! if let Some(cursor) = &filter.cursor_after {
//!     let (where_clause, bind_values) = cursor.keyset_where(&["p.timestamp", "p.id"], &[Desc, Desc]);
//!     builder.push(" AND ").push(&where_clause);
//!     // bind values in order
//! }
//! ```
//!
//! ## Legacy cursors
//!
//! The old `encode_cursor` / `decode_cursor` functions (format: `base64("{ts}:{id}")`)
//! are kept for reference but deprecated. New code should use `Cursor::encode()` /
//! `Cursor::decode()`.

use crate::query::SortOrder;

// ── Cursor value types ───────────────────────────────────────────────────

/// A single typed value in a keyset cursor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CursorValue {
    /// 64-bit signed integer.
    Int(i64),
    /// UTF-8 string.
    Text(String),
}

impl CursorValue {
    /// Convert to a JSON value for encoding.
    fn to_json(&self) -> serde_json::Value {
        match self {
            Self::Int(i) => serde_json::Value::Array(vec![
                serde_json::Value::String("int".into()),
                serde_json::Value::Number((*i).into()),
            ]),
            Self::Text(s) => serde_json::Value::Array(vec![
                serde_json::Value::String("text".into()),
                serde_json::Value::String(s.clone()),
            ]),
        }
    }

    /// Parse from a JSON value.
    fn from_json(v: &serde_json::Value) -> Option<Self> {
        let arr = v.as_array()?;
        if arr.len() != 2 {
            return None;
        }
        match arr[0].as_str()? {
            "int" => arr[1].as_i64().map(Self::Int),
            "text" => arr[1].as_str().map(|s| Self::Text(s.to_string())),
            _ => None,
        }
    }

    /// Return the value formatted for SQL binding.
    /// Int values return their string representation (for sqlx binding).
    /// Text values return the string as-is.
    pub fn as_bind_value(&self) -> String {
        match self {
            Self::Int(i) => i.to_string(),
            Self::Text(s) => s.clone(),
        }
    }
}

// ── Keyset WHERE clause generation ───────────────────────────────────────

/// A fragment in a keyset WHERE clause — either raw SQL or a bind value.
#[derive(Debug, Clone)]
pub enum KeysetFragment {
    /// Raw SQL text (push directly).
    Sql(String),
    /// A value to bind (push_bind).
    Bind(CursorValue),
}

/// The result of [`Cursor::keyset_where_parts`] — a sequence of SQL fragments
/// and bind values to interleave via `QueryBuilder::push()` / `push_bind()`.
#[derive(Debug, Clone)]
pub struct KeysetParts {
    pub fragments: Vec<KeysetFragment>,
}

// ── Cursor ───────────────────────────────────────────────────────────────

/// A decoded keyset cursor carrying the values of sort columns at a page boundary.
///
/// The values are ordered: first the sort column(s), then the tiebreaker column.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cursor {
    /// Decoded values in order of the sort columns + tiebreaker.
    pub values: Vec<CursorValue>,
}

impl Cursor {
    /// Create a cursor from the last row's sort column values.
    pub fn from_values(values: Vec<CursorValue>) -> Self {
        Self { values }
    }

    /// Encode into an opaque, URL-safe base64 token.
    ///
    /// The payload is a JSON array of `[type, value]` tuples.
    pub fn encode(&self) -> String {
        use base64::Engine;
        let json: Vec<serde_json::Value> = self.values.iter().map(CursorValue::to_json).collect();
        let payload = serde_json::to_string(&json).unwrap_or_default();
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload)
    }

    /// Decode from an opaque token.
    ///
    /// Returns `None` if the token is malformed (invalid base64, invalid JSON,
    /// wrong structure, or legacy format).
    pub fn decode(token: &str) -> Option<Self> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(token).ok()?;
        let payload = String::from_utf8(bytes).ok()?;

        // Try new JSON format first
        if let Ok(json) = serde_json::from_str::<Vec<serde_json::Value>>(&payload) {
            let values: Vec<CursorValue> =
                json.iter().map(CursorValue::from_json).collect::<Option<Vec<_>>>()?;
            if values.is_empty() {
                return None;
            }
            return Some(Self { values });
        }

        // Fall back to legacy format: "timestamp:id"
        // This ensures backward compatibility during deployment.
        if let Some((ts_str, id)) = payload.split_once(':') {
            if let Ok(ts) = ts_str.parse::<i64>() {
                return Some(Self {
                    values: vec![CursorValue::Int(ts), CursorValue::Text(id.to_string())],
                });
            }
        }

        None
    }

    /// Generate a keyset WHERE clause for the given sort columns and directions.
    ///
    /// Returns a list of `(sql_fragment, bind_value)` pairs. The caller should
    /// interleave these with `QueryBuilder::push()` / `QueryBuilder::push_bind()`:
    ///
    /// ```ignore
    /// for (fragment, value) in cursor.keyset_where_parts(&cols, &dirs) {
    ///     builder.push(fragment);
    ///     builder.push_bind(value.as_bind_value());
    /// }
    /// ```
    ///
    /// ## Example
    ///
    /// For `ORDER BY timestamp DESC, id DESC` with cursor `(1700000000, "abc123")`:
    /// ```text
    /// [("((p.timestamp < ", Int(1700000000)),
    ///  (") OR (p.timestamp = ", Int(1700000000)),
    ///  (" AND p.id < ", Text("abc123")),
    ///  ("))", ← no bind needed, use push() only]
    /// ```
    ///
    /// ## Panics
    ///
    /// Panics if `columns.len() != directions.len()` or if `columns.len() > self.values.len()`.
    pub fn keyset_where_parts(&self, columns: &[&str], directions: &[SortOrder]) -> KeysetParts {
        assert_eq!(
            columns.len(),
            directions.len(),
            "keyset_where_parts: columns and directions must have the same length"
        );
        assert!(
            columns.len() <= self.values.len(),
            "keyset_where_parts: cursor has {} values but {} columns requested",
            self.values.len(),
            columns.len()
        );

        let n = columns.len();
        let mut parts: Vec<KeysetFragment> = Vec::new();

        for i in 0..n {
            let cmp_op = match directions[i] {
                SortOrder::Asc => ">",
                SortOrder::Desc => "<",
            };

            // Opening for this prefix
            if i == 0 {
                parts.push(KeysetFragment::Sql(format!("(({} {} ", columns[i], cmp_op)));
            } else {
                parts.push(KeysetFragment::Sql(format!(") OR (")));
                // Equality conditions for all columns before i
                for j in 0..i {
                    if j > 0 {
                        parts.push(KeysetFragment::Sql(" AND ".into()));
                    }
                    parts.push(KeysetFragment::Sql(format!("{} = ", columns[j])));
                    parts.push(KeysetFragment::Bind(self.values[j].clone()));
                }
                parts.push(KeysetFragment::Sql(format!(" AND {} {} ", columns[i], cmp_op)));
            }
            parts.push(KeysetFragment::Bind(self.values[i].clone()));
        }

        // Closing parenthesis for the whole expression
        parts.push(KeysetFragment::Sql("))".into()));

        KeysetParts { fragments: parts }
    }
}

// ── Legacy functions (deprecated, kept for backward compat) ──────────────

/// Encode a punch list cursor from a timestamp (seconds) and dedup ID.
///
/// **Deprecated:** Use `Cursor::encode()` instead.
/// Format: `base64("{timestamp_sec}:{dedup_id}")`
pub fn encode_cursor(timestamp_sec: i64, dedup_id: &str) -> String {
    let cursor = Cursor {
        values: vec![CursorValue::Int(timestamp_sec), CursorValue::Text(dedup_id.to_string())],
    };
    cursor.encode()
}

/// Decode a punch list cursor into `(timestamp_sec, dedup_id)`.
///
/// **Deprecated:** Use `Cursor::decode()` instead.
/// Returns `None` if the cursor is malformed.
pub fn decode_cursor(cursor: &str) -> Option<(i64, String)> {
    let cursor = Cursor::decode(cursor)?;
    if cursor.values.len() < 2 {
        return None;
    }
    let ts = match &cursor.values[0] {
        CursorValue::Int(i) => *i,
        _ => return None,
    };
    let id = match &cursor.values[1] {
        CursorValue::Text(s) => s.clone(),
        _ => return None,
    };
    Some((ts, id))
}

/// Encode an integer offset as a URL-safe base64 cursor.
///
/// Used for simple offset-based pagination (employee lists, audit logs).
pub fn encode_offset_cursor(offset: i64) -> String {
    let cursor = Cursor { values: vec![CursorValue::Int(offset)] };
    cursor.encode()
}

// ── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Cursor encode/decode ──────────────────────────────────────────

    #[test]
    fn test_cursor_encode_decode_roundtrip() {
        let cursor = Cursor {
            values: vec![CursorValue::Int(1700000000), CursorValue::Text("abc123".into())],
        };
        let token = cursor.encode();
        let decoded = Cursor::decode(&token).unwrap();
        assert_eq!(decoded, cursor);
    }

    #[test]
    fn test_cursor_single_value() {
        let cursor = Cursor { values: vec![CursorValue::Int(42)] };
        let token = cursor.encode();
        let decoded = Cursor::decode(&token).unwrap();
        assert_eq!(decoded, cursor);
    }

    #[test]
    fn test_cursor_decode_empty_string() {
        assert!(Cursor::decode("").is_none());
    }

    #[test]
    fn test_cursor_decode_invalid_base64() {
        assert!(Cursor::decode("not-valid-base64!!!").is_none());
    }

    #[test]
    fn test_cursor_decode_legacy_format() {
        // Legacy format: base64("1700000000:abc123")
        use base64::Engine;
        let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode("1700000000:abc123");
        let cursor = Cursor::decode(&token).unwrap();
        assert_eq!(cursor.values.len(), 2);
        assert_eq!(cursor.values[0], CursorValue::Int(1700000000));
        assert_eq!(cursor.values[1], CursorValue::Text("abc123".into()));
    }

    #[test]
    fn test_cursor_decode_legacy_malformed() {
        use base64::Engine;
        let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode("not_a_number:id");
        // "not_a_number:id" doesn't match legacy format (ts not numeric), and JSON fails too
        assert!(Cursor::decode(&token).is_none());
    }

    // ── Keyset WHERE clause generation ─────────────────────────────────

    #[test]
    fn test_keyset_where_single_column_desc() {
        let cursor = Cursor { values: vec![CursorValue::Int(100)] };
        let parts = cursor.keyset_where_parts(&["p.timestamp"], &[SortOrder::Desc]);
        // Should produce: ((p.timestamp < ?))
        assert_eq!(parts.fragments.len(), 3); // Sql, Bind, Sql
        match &parts.fragments[0] {
            KeysetFragment::Sql(s) => assert_eq!(s, "((p.timestamp < "),
            _ => panic!("expected Sql"),
        }
        match &parts.fragments[1] {
            KeysetFragment::Bind(v) => assert_eq!(*v, CursorValue::Int(100)),
            _ => panic!("expected Bind"),
        }
        match &parts.fragments[2] {
            KeysetFragment::Sql(s) => assert_eq!(s, "))"),
            _ => panic!("expected Sql"),
        }
    }

    #[test]
    fn test_keyset_where_single_column_asc() {
        let cursor = Cursor { values: vec![CursorValue::Int(100)] };
        let parts = cursor.keyset_where_parts(&["p.timestamp"], &[SortOrder::Asc]);
        assert_eq!(parts.fragments.len(), 3);
        match &parts.fragments[0] {
            KeysetFragment::Sql(s) => assert_eq!(s, "((p.timestamp > "),
            _ => panic!("expected Sql"),
        }
    }

    #[test]
    fn test_keyset_where_two_columns_desc() {
        let cursor =
            Cursor { values: vec![CursorValue::Int(1700000000), CursorValue::Text("abc".into())] };
        let parts = cursor
            .keyset_where_parts(&["p.timestamp", "p.id"], &[SortOrder::Desc, SortOrder::Desc]);
        // Should produce: ((p.timestamp < ?) OR (p.timestamp = ? AND p.id < ?))
        // Fragments: Sql, Bind, Sql, Sql, Bind, Sql, Bind, Sql = 8
        assert_eq!(parts.fragments.len(), 8);
        // Verify bind values are correct (3 binds: ts, ts, id)
        let binds: Vec<&CursorValue> = parts
            .fragments
            .iter()
            .filter_map(|f| match f {
                KeysetFragment::Bind(v) => Some(v),
                _ => None,
            })
            .collect();
        assert_eq!(binds.len(), 3);
        assert_eq!(binds[0], &CursorValue::Int(1700000000));
        assert_eq!(binds[1], &CursorValue::Int(1700000000));
        assert_eq!(binds[2], &CursorValue::Text("abc".into()));
    }

    #[test]
    fn test_keyset_where_two_columns_asc() {
        let cursor =
            Cursor { values: vec![CursorValue::Int(100), CursorValue::Text("xyz".into())] };
        let parts =
            cursor.keyset_where_parts(&["p.timestamp", "p.id"], &[SortOrder::Asc, SortOrder::Asc]);
        // Verify the first comparison uses > (ASC)
        match &parts.fragments[0] {
            KeysetFragment::Sql(s) => assert!(s.contains(">"), "ASC should use >"),
            _ => panic!("expected Sql"),
        }
    }

    #[test]
    fn test_keyset_where_mixed_directions() {
        let cursor =
            Cursor { values: vec![CursorValue::Int(100), CursorValue::Text("xyz".into())] };
        let parts =
            cursor.keyset_where_parts(&["p.timestamp", "p.id"], &[SortOrder::Asc, SortOrder::Desc]);
        // First comparison: > (ASC), second: < (DESC)
        match &parts.fragments[0] {
            KeysetFragment::Sql(s) => assert!(s.contains(">"), "First column ASC should use >"),
            _ => panic!("expected Sql"),
        }
        // Find the second comparison operator
        let sql_parts: Vec<&str> = parts
            .fragments
            .iter()
            .filter_map(|f| match f {
                KeysetFragment::Sql(s) => Some(s.as_str()),
                _ => None,
            })
            .collect();
        let combined: String = sql_parts.join("");
        assert!(combined.contains("p.id <"), "Second column DESC should use <: {combined}");
    }

    // ── Legacy function tests ─────────────────────────────────────────

    #[test]
    fn test_legacy_encode_decode_roundtrip() {
        let cursor = encode_cursor(1700000000, "abc123");
        let (ts, id) = decode_cursor(&cursor).unwrap();
        assert_eq!(ts, 1700000000);
        assert_eq!(id, "abc123");
    }

    #[test]
    fn test_legacy_decode_malformed_returns_none() {
        assert!(decode_cursor("not-base64!!").is_none());
        assert!(decode_cursor("").is_none());
    }

    #[test]
    fn test_offset_cursor_roundtrip() {
        let cursor = encode_offset_cursor(42);
        let decoded = Cursor::decode(&cursor).unwrap();
        assert_eq!(decoded.values.len(), 1);
        assert_eq!(decoded.values[0], CursorValue::Int(42));
    }
}
