//! Tantivy-backed full-text search for Timekeep.
//!
//! This crate implements [`timekeep_core::SearchStore`] using an embedded
//! Tantivy index. The index is stored on disk alongside the primary database.
//!
//! ## Schema
//!
//! Every indexable entity (employee, device, …) shares a common schema
//! with a `entity_type` discriminator field. This enables global search
//! across all entities in a single query.
//!
//! ## Tokenization
//!
//! - **Text fields** (name, department, pin): lowercased, n-gram tokenized
//!   (3-4 grams) for typo-tolerant substring matching across languages
//!   including Arabic.
//! - **Identifier fields** (entity_id, entity_type): raw (not tokenized)
//!   for exact matching.
//!
//! ## Concurrency
//!
//! The [`TantivySearchStore`] uses an `Arc<RwLock<IndexWriter>>` so that
//! indexing (write) and searching (read) can happen concurrently. Tantivy's
//! reader is internally `Send + Sync`; the writer requires exclusive access
//! during `commit()` but not during `add_document()`.

pub mod indexer;
mod schema;

use std::path::Path;
use std::sync::Arc;

use async_trait::async_trait;
use tantivy::collector::TopDocs;
use tantivy::query::{BooleanQuery, FuzzyTermQuery, Occur, QueryParser};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use timekeep_core::query::search::{SearchHit, SearchQuery, SearchResults};
use timekeep_core::{AttendancePunch, Employee, EmployeeId, Error, SearchStore};

use schema::SearchSchema;

/// Tantivy-backed search store.
///
/// # Lifecycle
///
/// 1. `TantivySearchStore::open(path)` — opens or creates the index
/// 2. Application calls `rebuild_employees()` on startup to populate
/// 3. Event-driven updates keep the index in sync with the DB
pub struct TantivySearchStore {
    index: Index,
    reader: IndexReader,
    writer: Arc<RwLock<Option<IndexWriter>>>,
    schema: SearchSchema,
}

impl TantivySearchStore {
    /// Open an existing index or create a new one at `index_path`.
    ///
    /// # Errors
    ///
    /// Returns `Error::storage` if the index directory cannot be created
    /// or is corrupted.
    pub fn open(index_path: &Path) -> Result<Self, Error> {
        let search_schema = SearchSchema::new();
        let tantivy_schema = search_schema.tantivy_schema();

        let index = if index_path.exists() && index_path.join("meta.json").exists() {
            info!(
                path = %index_path.display(),
                "Opening existing Tantivy search index"
            );
            Index::open_in_dir(index_path)
                .map_err(|e| Error::storage(format!("failed to open Tantivy index: {e}")))?
        } else {
            info!(
                path = %index_path.display(),
                "Creating new Tantivy search index"
            );
            std::fs::create_dir_all(index_path).map_err(|e| {
                Error::storage(format!("failed to create Tantivy index directory: {e}"))
            })?;
            Index::create_in_dir(index_path, tantivy_schema.clone())
                .map_err(|e| Error::storage(format!("failed to create Tantivy index: {e}")))?
        };

        let writer = index
            .writer(50_000_000)
            .map_err(|e| Error::storage(format!("failed to create Tantivy writer: {e}")))?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .map_err(|e| Error::storage(format!("failed to create Tantivy reader: {e}")))?;

        Ok(Self {
            index,
            reader,
            writer: Arc::new(RwLock::new(Some(writer))),
            schema: search_schema,
        })
    }

    /// Get a fresh searcher (snapshot of the latest committed index).
    fn searcher(&self) -> Result<tantivy::Searcher, Error> {
        self.reader
            .reload()
            .map_err(|e| Error::storage(format!("failed to reload index reader: {e}")))?;
        Ok(self.reader.searcher())
    }

    /// Build a Tantivy query from a user search string.
    ///
    /// Strategy: combine fuzzy term queries on all text fields with
    /// a phrase query for multi-word searches. This gives us both
    /// typo tolerance and relevance ranking.
    fn build_query(&self, q: &str) -> Result<Box<dyn tantivy::query::Query>, Error> {
        let trimmed = q.trim();
        if trimmed.is_empty() {
            // Return a query that matches nothing
            return Ok(Box::new(tantivy::query::EmptyQuery));
        }

        let text_fields = self.schema.searchable_fields();
        // Lowercase the search term to match Tantivy's default tokenizer
        let search_term = trimmed.to_lowercase();

        // For single terms, use a disjunction of fuzzy queries on each field
        // For multiple terms, parse with the query parser for phrase matching
        let query: Box<dyn tantivy::query::Query> = if search_term.split_whitespace().count() == 1 {
            // Single term: fuzzy matching on each searchable field
            let mut subqueries: Vec<(Occur, Box<dyn tantivy::query::Query>)> = Vec::new();

            for field in &text_fields {
                let term = tantivy::Term::from_field_text(*field, &search_term);
                let fuzzy = FuzzyTermQuery::new(term, 1, true);
                subqueries.push((Occur::Should, Box::new(fuzzy)));
            }

            Box::new(BooleanQuery::new(subqueries))
        } else {
            // Multiple terms: use the query parser for phrase + term matching
            let query_parser = QueryParser::for_index(&self.index, text_fields.to_vec());
            query_parser
                .parse_query(&search_term)
                .map_err(|e| Error::storage(format!("failed to parse search query: {e}")))?
        };

        Ok(query)
    }

    /// Convert a Tantivy document into a SearchHit.
    fn doc_to_hit(&self, doc: TantivyDocument, score: f32) -> Result<SearchHit, Error> {
        let entity_type = self.schema.extract_string(&doc, "entity_type")?;
        let entity_id = self.schema.extract_string(&doc, "entity_id")?;
        let title = self.schema.extract_string(&doc, "title")?;
        let subtitle = self.schema.extract_string(&doc, "subtitle").unwrap_or_default();

        Ok(SearchHit {
            entity_type,
            entity_id,
            score,
            title,
            subtitle,
            highlighted: None, // TODO(ENTERPRISE): Add snippet highlighting via SnippetGenerator
        })
    }
}

#[async_trait]
impl SearchStore for TantivySearchStore {
    async fn search(&self, query: &SearchQuery) -> Result<SearchResults, Error> {
        let searcher =
            self.searcher().map_err(|e| Error::storage(format!("search reader error: {e}")))?;

        let tantivy_query = self.build_query(&query.q)?;

        // If entity_type is specified, wrap in a BooleanQuery with a filter
        let final_query: Box<dyn tantivy::query::Query> =
            if let Some(ref entity_type) = query.entity_type {
                let entity_type_term =
                    tantivy::Term::from_field_text(self.schema.entity_type_field, entity_type);
                let type_query = Box::new(tantivy::query::TermQuery::new(
                    entity_type_term,
                    tantivy::schema::IndexRecordOption::Basic,
                ));
                Box::new(BooleanQuery::new(vec![
                    (Occur::Must, tantivy_query),
                    (Occur::Must, type_query),
                ]))
            } else {
                tantivy_query
            };

        debug!(
            q = %query.q,
            entity_type = ?query.entity_type,
            limit = query.clamped_limit(),
            "Executing search query"
        );

        let limit = query.clamped_limit() as usize;
        let offset = query.offset as usize;

        let top_docs = searcher
            .search(&final_query, &TopDocs::with_limit(limit + offset).order_by_score())
            .map_err(|e| Error::storage(format!("search execution error: {e}")))?;

        let total = top_docs.len() as u64;
        let has_more = top_docs.len() > limit + offset;

        let hits: Vec<SearchHit> = top_docs
            .into_iter()
            .skip(offset)
            .take(limit)
            .filter_map(|(score, doc_addr)| match searcher.doc::<TantivyDocument>(doc_addr) {
                Ok(doc) => self.doc_to_hit(doc, score).ok(),
                Err(e) => {
                    warn!(%e, "Failed to retrieve search document");
                    None
                },
            })
            .collect();

        Ok(SearchResults { hits, total, has_more })
    }

    async fn index_employee(&self, employee: &Employee) -> Result<(), Error> {
        let id_term = tantivy::Term::from_field_text(self.schema.entity_id_field, &employee.id.0);
        let doc = self.schema.build_employee_doc(employee);

        let mut guard = self.writer.write().await;

        if let Some(ref mut writer) = *guard {
            // Delete any existing document with this ID (idempotent upsert)
            writer.delete_term(id_term);
            writer
                .add_document(doc)
                .map_err(|e| Error::storage(format!("failed to index employee: {e}")))?;
            writer
                .commit()
                .map_err(|e| Error::storage(format!("failed to commit employee index: {e}")))?;
        } else {
            warn!("IndexWriter not available — skipping employee index update");
        }

        debug!(pin = %employee.pin, name = %employee.name, "Employee indexed");
        Ok(())
    }

    async fn delete_employee(&self, id: &EmployeeId) -> Result<(), Error> {
        let id_term = tantivy::Term::from_field_text(self.schema.entity_id_field, &id.0);

        let mut guard = self.writer.write().await;
        if let Some(ref mut writer) = *guard {
            writer.delete_term(id_term);
            writer
                .commit()
                .map_err(|e| Error::storage(format!("failed to commit employee deletion: {e}")))?;
        }

        debug!(employee_id = %id.0, "Employee removed from search index");
        Ok(())
    }

    async fn rebuild_employees(&self, employees: &[Employee]) -> Result<(), Error> {
        info!(count = employees.len(), "Rebuilding employee search index");

        let mut guard = self.writer.write().await;
        let writer = guard
            .as_mut()
            .ok_or_else(|| Error::storage("IndexWriter not available for rebuild"))?;

        // Delete all employee documents
        let employee_type_term =
            tantivy::Term::from_field_text(self.schema.entity_type_field, "employee");
        writer.delete_term(employee_type_term);

        // Re-index all employees
        for employee in employees {
            let doc = self.schema.build_employee_doc(employee);
            writer.add_document(doc).map_err(|e| {
                Error::storage(format!("failed to index employee during rebuild: {e}"))
            })?;
        }

        writer.commit().map_err(|e| Error::storage(format!("failed to commit rebuild: {e}")))?;

        info!(count = employees.len(), "Employee search index rebuilt");
        Ok(())
    }

    async fn health_check(&self) -> Result<(), Error> {
        // Try to get a searcher — if it works, the index is healthy
        let _searcher = self
            .searcher()
            .map_err(|e| Error::storage(format!("search index health check failed: {e}")))?;
        Ok(())
    }

    // ── Punch indexing ────────────────────────────────────────────

    async fn index_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        let doc = self.schema.build_punch_doc(punch);

        let mut guard = self.writer.write().await;
        if let Some(ref mut writer) = *guard {
            writer
                .add_document(doc)
                .map_err(|e| Error::storage(format!("failed to index punch: {e}")))?;
            // Commit periodically to keep punch search near-real-time
            // without committing on every single punch (batched by the event loop)
            writer
                .commit()
                .map_err(|e| Error::storage(format!("failed to commit punch index: {e}")))?;
        }

        debug!(punch_id = %punch.id, user_pin = %punch.user_pin, "Punch indexed");
        Ok(())
    }

    async fn rebuild_punches(&self, punches: &[AttendancePunch]) -> Result<(), Error> {
        info!(count = punches.len(), "Rebuilding punch search index");

        let mut guard = self.writer.write().await;
        let writer = guard
            .as_mut()
            .ok_or_else(|| Error::storage("IndexWriter not available for rebuild"))?;

        // Delete all punch documents
        let punch_type_term =
            tantivy::Term::from_field_text(self.schema.entity_type_field, "punch");
        writer.delete_term(punch_type_term);

        // Re-index punches in batches to avoid memory pressure
        for chunk in punches.chunks(500) {
            for punch in chunk {
                let doc = self.schema.build_punch_doc(punch);
                writer.add_document(doc).map_err(|e| {
                    Error::storage(format!("failed to index punch during rebuild: {e}"))
                })?;
            }
            writer.commit().map_err(|e| {
                Error::storage(format!("failed to commit punch rebuild chunk: {e}"))
            })?;
        }

        info!(count = punches.len(), "Punch search index rebuilt");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a test employee with the given attributes.
    fn test_employee(pin: &str, name: &str, department: Option<&str>) -> Employee {
        Employee::new(pin, name, department.map(String::from), None)
    }

    #[tokio::test]
    async fn test_open_creates_index() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();
        assert!(store.health_check().await.is_ok());
    }

    #[tokio::test]
    async fn test_index_and_search_employee() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let emp = test_employee("145", "Ahmed Al-Sabah", Some("Engineering"));
        store.index_employee(&emp).await.unwrap();

        // Search by exact name
        let results = store
            .search(&SearchQuery { q: "Ahmed".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
        assert_eq!(results.hits[0].title, "Ahmed Al-Sabah");
        assert_eq!(results.hits[0].subtitle, "Engineering");
        assert_eq!(results.hits[0].entity_type, "employee");
    }

    #[tokio::test]
    async fn test_fuzzy_search_finds_typo() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let emp = test_employee("145", "Ahmed Al-Sabah", None);
        store.index_employee(&emp).await.unwrap();

        // Search with typo: "Ahmet" should match "Ahmed" (edit distance 1 — 'd'→'t')
        let results = store
            .search(&SearchQuery { q: "Ahmet".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert!(!results.hits.is_empty(), "Fuzzy search should match 'Ahmet' to 'Ahmed'");
    }

    #[tokio::test]
    async fn test_delete_employee() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let emp = test_employee("145", "Ahmed", None);
        store.index_employee(&emp).await.unwrap();
        store.delete_employee(&emp.id).await.unwrap();

        let results = store
            .search(&SearchQuery { q: "Ahmed".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert!(results.hits.is_empty());
    }

    #[tokio::test]
    async fn test_rebuild_employees() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let employees = vec![
            test_employee("145", "Ahmed", Some("Engineering")),
            test_employee("146", "Fatima", Some("HR")),
        ];

        store.rebuild_employees(&employees).await.unwrap();

        let results = store
            .search(&SearchQuery { q: "Fatima".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);

        // Search without entity_type should find employees
        let all = store
            .search(&SearchQuery { q: "Engineering".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert_eq!(all.hits.len(), 1);
    }

    #[tokio::test]
    async fn test_entity_type_filter() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let emp = test_employee("145", "Ahmed", None);
        store.index_employee(&emp).await.unwrap();

        // Filter by employee type — should find
        let results = store
            .search(&SearchQuery {
                q: "Ahmed".to_string(),
                entity_type: Some("employee".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);

        // Filter by wrong type — should not find
        let results = store
            .search(&SearchQuery {
                q: "Ahmed".to_string(),
                entity_type: Some("device".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert!(results.hits.is_empty());
    }

    // ── Punch search tests ──────────────────────────────────────

    /// Build a minimal test punch.
    fn test_punch(
        user_pin: &str,
        device_sn: &str,
        name: Option<&str>,
        status: timekeep_core::PunchStatus,
    ) -> AttendancePunch {
        let mut punch = AttendancePunch {
            id: String::new(),
            device_sn: device_sn.to_string(),
            user_pin: user_pin.to_string(),
            timestamp: jiff::Timestamp::from_second(1_752_129_600).unwrap(),
            status,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: name.map(String::from),
            device_label: Some("Front Gate".to_string()),
            is_anomaly: false,
            anomaly_type: None,
            raw_data: None,
        };
        punch.id = punch.generate_deduplication_id();
        punch
    }

    #[tokio::test]
    async fn test_index_and_search_punch() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let punch =
            test_punch("145", "DEV-001", Some("Ahmed"), timekeep_core::PunchStatus::CheckIn);
        store.index_punch(&punch).await.unwrap();

        // Search by user PIN
        let results = store
            .search(&SearchQuery {
                q: "145".to_string(),
                entity_type: Some("punch".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
        assert_eq!(results.hits[0].entity_type, "punch");
        assert!(results.hits[0].title.contains("145"));
    }

    #[tokio::test]
    async fn test_search_punch_by_employee_name() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let punch = test_punch(
            "145",
            "DEV-001",
            Some("Ahmed Al-Sabah"),
            timekeep_core::PunchStatus::CheckIn,
        );
        store.index_punch(&punch).await.unwrap();

        let results = store
            .search(&SearchQuery {
                q: "Ahmed".to_string(),
                entity_type: Some("punch".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
        assert!(results.hits[0].title.contains("Ahmed"));
    }

    #[tokio::test]
    async fn test_search_punch_by_status() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let punch = test_punch("145", "DEV-001", None, timekeep_core::PunchStatus::CheckIn);
        store.index_punch(&punch).await.unwrap();

        // "check_in" is tokenized as ["check", "in"] by the default tokenizer.
        // Searching for "check" should match.
        let results = store
            .search(&SearchQuery {
                q: "check".to_string(),
                entity_type: Some("punch".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
    }

    #[tokio::test]
    async fn test_search_punch_by_device() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let punch = test_punch("145", "DEV-001", None, timekeep_core::PunchStatus::CheckIn);
        store.index_punch(&punch).await.unwrap();

        let results = store
            .search(&SearchQuery {
                q: "Front Gate".to_string(),
                entity_type: Some("punch".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
        assert!(results.hits[0].subtitle.contains("Front Gate"));
    }

    #[tokio::test]
    async fn test_rebuild_punches() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        let punches = vec![
            test_punch("145", "DEV-001", Some("Ahmed"), timekeep_core::PunchStatus::CheckIn),
            test_punch("146", "DEV-001", Some("Fatima"), timekeep_core::PunchStatus::CheckOut),
        ];

        store.rebuild_punches(&punches).await.unwrap();

        let results = store
            .search(&SearchQuery {
                q: "Fatima".to_string(),
                entity_type: Some("punch".to_string()),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 1);
    }

    #[tokio::test]
    async fn test_global_search_across_entities() {
        let dir = tempfile::tempdir().unwrap();
        let store = TantivySearchStore::open(dir.path()).unwrap();

        // Index an employee and a punch
        let emp = test_employee("145", "Ahmed Al-Sabah", Some("Engineering"));
        store.index_employee(&emp).await.unwrap();

        let punch =
            test_punch("145", "DEV-001", Some("Ahmed"), timekeep_core::PunchStatus::CheckIn);
        store.index_punch(&punch).await.unwrap();

        // Global search without entity_type filter should find both
        let results = store
            .search(&SearchQuery { q: "Ahmed".to_string(), ..Default::default() })
            .await
            .unwrap();

        assert_eq!(results.hits.len(), 2, "Global search should find both employee and punch");

        let types: Vec<&str> = results.hits.iter().map(|h| h.entity_type.as_str()).collect();
        assert!(types.contains(&"employee"));
        assert!(types.contains(&"punch"));
    }
}
