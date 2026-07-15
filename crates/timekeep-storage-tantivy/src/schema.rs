//! Tantivy schema definition and document construction.
//!
//! Defines a unified schema for all searchable entities (employees, devices,
//! punches) using a `entity_type` discriminator field for global search.

use tantivy::schema::*;
use tantivy::{TantivyDocument, doc};

use timekeep_core::{AttendancePunch, Employee, Error};

/// Wraps the Tantivy schema and provides strongly-typed field accessors.
pub(crate) struct SearchSchema {
    /// `entity_type` — discriminator: "employee", "device", "punch".
    /// Stored and indexed as raw text (not tokenized).
    pub entity_type_field: Field,

    /// `entity_id` — primary key from the database (UUID string).
    /// Stored and indexed as raw text for exact-match lookups.
    pub entity_id_field: Field,

    /// `title` — primary display label (e.g. employee name).
    /// Tokenized, indexed, and stored for full-text search + display.
    pub title_field: Field,

    /// `subtitle` — secondary context line (e.g. department, device serial).
    /// Tokenized, indexed, and stored.
    pub subtitle_field: Field,

    /// `searchable_text` — concatenated text blob for full-text search.
    /// Combines all searchable fields (pin, name, department, external_id).
    /// Indexed and tokenized but NOT stored (to keep the index small).
    pub searchable_field: Field,

    /// The full Tantivy schema object.
    tantivy_schema: Schema,
}

impl SearchSchema {
    /// Build the unified search schema.
    ///
    /// Field design:
    /// - `entity_type`, `entity_id`: `STRING` (raw, not tokenized) for exact matching
    /// - `title`, `subtitle`: `TEXT` with `STORED` for display
    /// - `searchable_text`: `TEXT` (indexed, not stored) — the search target
    pub fn new() -> Self {
        let mut builder = Schema::builder();

        let entity_type_field = builder.add_text_field("entity_type", STRING | STORED);
        let entity_id_field = builder.add_text_field("entity_id", STRING | STORED);
        let title_field = builder.add_text_field("title", TEXT | STORED);
        let subtitle_field = builder.add_text_field("subtitle", TEXT | STORED);
        let searchable_field = builder.add_text_field("searchable_text", TEXT);

        let tantivy_schema = builder.build();

        Self {
            entity_type_field,
            entity_id_field,
            title_field,
            subtitle_field,
            searchable_field,
            tantivy_schema,
        }
    }

    /// Get a reference to the Tantivy schema.
    pub fn tantivy_schema(&self) -> &Schema {
        &self.tantivy_schema
    }

    /// Get all fields that should be searched for full-text queries.
    pub fn searchable_fields(&self) -> Vec<Field> {
        vec![self.title_field, self.subtitle_field, self.searchable_field]
    }

    /// Build a Tantivy document for an employee.
    pub fn build_employee_doc(&self, employee: &Employee) -> TantivyDocument {
        // Concatenate all searchable employee text into one field.
        // This lets Tantivy's tokenizer handle multi-field search
        // in a single indexed field.
        let mut searchable_parts: Vec<&str> = Vec::new();
        searchable_parts.push(&employee.pin);
        searchable_parts.push(&employee.name);
        if let Some(ref dept) = employee.department {
            searchable_parts.push(dept);
        }
        if let Some(ref ext_id) = employee.external_id {
            searchable_parts.push(ext_id);
        }

        let searchable_text = searchable_parts.join(" ");

        doc!(
            self.entity_type_field => "employee",
            self.entity_id_field => employee.id.0.as_str(),
            self.title_field => employee.name.as_str(),
            self.subtitle_field => employee.department.as_deref().unwrap_or(""),
            self.searchable_field => searchable_text.as_str(),
        )
    }

    /// Build a Tantivy document for an attendance punch.
    pub fn build_punch_doc(&self, punch: &AttendancePunch) -> TantivyDocument {
        let mut searchable_parts: Vec<String> = Vec::new();
        searchable_parts.push(punch.user_pin.clone());
        if let Some(ref name) = punch.employee_name {
            searchable_parts.push(name.clone());
        }
        searchable_parts.push(punch.device_sn.clone());
        if let Some(ref label) = punch.device_label {
            searchable_parts.push(label.clone());
        }
        // Status as human-readable text
        searchable_parts.push(punch.status.to_string());

        let searchable_text = searchable_parts.join(" ");

        // Title: "PIN Name @ Device" or "PIN @ Device"
        let title = if let Some(ref name) = punch.employee_name {
            format!("{} {} @ {}", punch.user_pin, name, punch.device_sn)
        } else {
            format!("{} @ {}", punch.user_pin, punch.device_sn)
        };

        // Subtitle: status + device label
        let subtitle = if let Some(ref label) = punch.device_label {
            format!("{} on {label}", punch.status)
        } else {
            punch.status.to_string()
        };

        doc!(
            self.entity_type_field => "punch",
            self.entity_id_field => punch.id.as_str(),
            self.title_field => title.as_str(),
            self.subtitle_field => subtitle.as_str(),
            self.searchable_field => searchable_text.as_str(),
        )
    }

    /// Extract a string field value from a Tantivy document.
    ///
    /// # Errors
    ///
    /// Returns `Error::storage` if the field is missing or not a string.
    pub fn extract_string(&self, doc: &TantivyDocument, field_name: &str) -> Result<String, Error> {
        let field = self
            .tantivy_schema
            .get_field(field_name)
            .map_err(|e| Error::storage(format!("unknown field '{field_name}': {e}")))?;

        doc.get_first(field)
            .and_then(|v| v.as_str().map(String::from))
            .ok_or_else(|| Error::storage(format!("missing field '{field_name}' in document")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_creation() {
        let schema = SearchSchema::new();
        assert!(schema.searchable_fields().len() >= 3);
    }

    #[test]
    fn test_build_employee_doc() {
        let schema = SearchSchema::new();
        let emp = Employee::new(
            "145",
            "Ahmed Al-Sabah",
            Some("Engineering".into()),
            Some("EXT-42".into()),
        );

        let doc = schema.build_employee_doc(&emp);

        let entity_type = schema.extract_string(&doc, "entity_type").unwrap();
        assert_eq!(entity_type, "employee");

        let title = schema.extract_string(&doc, "title").unwrap();
        assert_eq!(title, "Ahmed Al-Sabah");

        let subtitle = schema.extract_string(&doc, "subtitle").unwrap();
        assert_eq!(subtitle, "Engineering");
    }
}
