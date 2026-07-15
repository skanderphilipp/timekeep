use super::SqliteStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct EndpointRow {
    id: String,
    name: String,
    kind: String,
    enabled: i32,
    config_json: String,
    created_at: i64,
    updated_at: i64,
}

impl EndpointRow {
    fn into_endpoint(self) -> Result<timekeep_core::IntegrationEndpoint, Error> {
        let kind = timekeep_core::IntegrationKind::from_str(&self.kind)
            .unwrap_or(timekeep_core::IntegrationKind::Webhook);
        let config: serde_json::Value = serde_json::from_str(&self.config_json)
            .map_err(|e| Error::storage(format!("parse endpoint config: {e}")))?;

        Ok(timekeep_core::IntegrationEndpoint {
            id: self.id,
            name: self.name,
            kind,
            enabled: self.enabled != 0,
            config,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

impl SqliteStorage {
    pub(super) async fn list_endpoints(
        &self,
    ) -> Result<Vec<timekeep_core::IntegrationEndpoint>, Error> {
        let rows: Vec<EndpointRow> = sqlx::query_as(
            "SELECT id, name, kind, enabled, config_json, created_at, updated_at
             FROM integration_endpoints ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list endpoints: {e}")))?;

        rows.into_iter().map(|r| r.into_endpoint()).collect()
    }

    pub(super) async fn list_endpoints_filtered(
        &self,
        filter: &timekeep_core::EndpointFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::IntegrationEndpoint>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = match filter.params.sort_by.as_deref().unwrap_or("created_at") {
            "name" => "name",
            "kind" => "kind",
            "created_at" => "created_at",
            "updated_at" => "updated_at",
            _ => "created_at",
        };
        let sort_dir = filter.params.sort_order.as_sql();
        let limit = filter.params.clamped_limit();

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref search) = filter.params.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            where_clauses.push("(name LIKE ? ESCAPE '\\' OR kind LIKE ? ESCAPE '\\')".into());
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM integration_endpoints {where_sql}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        for val in &where_values {
            count_query = count_query.bind(val);
        }
        let total: i64 = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count endpoints: {e}")))?;

        let query_sql = format!(
            "SELECT id, name, kind, enabled, config_json, created_at, updated_at
             FROM integration_endpoints {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );
        let mut query = sqlx::query_as::<_, EndpointRow>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }
        let rows = query
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("list endpoints filtered: {e}")))?;

        let items: Vec<timekeep_core::IntegrationEndpoint> =
            rows.into_iter().map(|r| r.into_endpoint()).collect::<Result<_, _>>()?;

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    pub(super) async fn create_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        let config = serde_json::to_string(&endpoint.config)
            .map_err(|e| Error::storage(format!("serialize endpoint config: {e}")))?;
        let kind = endpoint.kind.to_string();

        sqlx::query(
            "INSERT INTO integration_endpoints (id, name, kind, enabled, config_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&endpoint.id)
        .bind(&endpoint.name)
        .bind(&kind)
        .bind(endpoint.enabled as i32)
        .bind(&config)
        .bind(endpoint.created_at)
        .bind(endpoint.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create endpoint: {e}")))?;

        tracing::info!(name = %endpoint.name, kind = %kind, "integration endpoint created");
        Ok(())
    }

    pub(super) async fn update_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        let config = serde_json::to_string(&endpoint.config)
            .map_err(|e| Error::storage(format!("serialize endpoint config: {e}")))?;
        let kind = endpoint.kind.to_string();

        let affected = sqlx::query(
            "UPDATE integration_endpoints
             SET name = ?, kind = ?, enabled = ?, config_json = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&endpoint.name)
        .bind(&kind)
        .bind(endpoint.enabled as i32)
        .bind(&config)
        .bind(endpoint.updated_at)
        .bind(&endpoint.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update endpoint: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("endpoint '{}' not found", endpoint.id)));
        }

        tracing::info!(name = %endpoint.name, "integration endpoint updated");
        Ok(())
    }

    pub(super) async fn delete_endpoint(&self, id: &str) -> Result<(), Error> {
        let affected = sqlx::query("DELETE FROM integration_endpoints WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete endpoint: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("endpoint '{id}' not found")));
        }

        tracing::info!(id = %id, "integration endpoint deleted");
        Ok(())
    }
}
