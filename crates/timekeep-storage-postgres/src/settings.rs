use super::PostgresStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
struct EndpointRow {
    id: String,
    name: String,
    kind: String,
    enabled: bool,
    config_json: serde_json::Value,
    created_at: i64,
    updated_at: i64,
}

#[derive(sqlx::FromRow)]
pub(super) struct ProviderRowPg {
    key: String,
    display_name: String,
    default_port: i32,
    supports_adms: bool,
    supports_sdk: bool,
    capabilities_json: serde_json::Value,
    enabled: bool,
}

impl ProviderRowPg {
    fn into_provider_info(self) -> timekeep_core::ProviderInfo {
        let capabilities: timekeep_core::ProviderCapabilities =
            serde_json::from_value(self.capabilities_json).unwrap_or_default();
        timekeep_core::ProviderInfo {
            key: self.key,
            display_name: self.display_name,
            default_port: self.default_port as u16,
            supports_adms: self.supports_adms,
            supports_sdk: self.supports_sdk,
            capabilities,
            enabled: self.enabled,
        }
    }
}

impl PostgresStorage {
    pub(super) async fn health_check(&self) -> Result<(), Error> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("health check: {e}")))?;
        Ok(())
    }

    pub(super) async fn register_provider(
        &self,
        provider: &timekeep_core::ProviderInfo,
    ) -> Result<(), Error> {
        let caps = serde_json::to_value(&provider.capabilities).unwrap_or_default();

        sqlx::query(
            "INSERT INTO providers (key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(key) DO UPDATE SET
                display_name=EXCLUDED.display_name,
                default_port=EXCLUDED.default_port,
                supports_adms=EXCLUDED.supports_adms,
                supports_sdk=EXCLUDED.supports_sdk,
                capabilities_json=EXCLUDED.capabilities_json,
                enabled=EXCLUDED.enabled",
        )
        .bind(&provider.key)
        .bind(&provider.display_name)
        .bind(provider.default_port as i32)
        .bind(provider.supports_adms)
        .bind(provider.supports_sdk)
        .bind(&caps)
        .bind(provider.enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("register provider: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_providers(&self) -> Result<Vec<timekeep_core::ProviderInfo>, Error> {
        let rows = sqlx::query_as::<_, ProviderRowPg>(
            "SELECT key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled
             FROM providers ORDER BY key",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list providers: {e}")))?;

        Ok(rows.into_iter().map(|r| r.into_provider_info()).collect())
    }

    // ── System settings ────────────────────────────────────────────

    pub(super) async fn get_system_settings(&self) -> Result<timekeep_core::SystemSettings, Error> {
        let row = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT value_json FROM settings WHERE key = 'system'",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get system settings: {e}")))?;

        match row {
            Some(json) => match serde_json::from_value::<timekeep_core::SystemSettings>(json) {
                Ok(settings) => Ok(settings),
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        "failed to deserialize system settings — falling back to defaults. \
                         This usually means the stored settings use an older schema. \
                         Saving current defaults will overwrite the stale data on next upsert."
                    );
                    Ok(timekeep_core::SystemSettings::default())
                },
            },
            None => Ok(timekeep_core::SystemSettings::default()),
        }
    }

    pub(super) async fn upsert_system_settings(
        &self,
        settings: &timekeep_core::SystemSettings,
    ) -> Result<(), Error> {
        let json = serde_json::to_value(settings)
            .map_err(|e| Error::storage(format!("serialize system settings: {e}")))?;

        sqlx::query(
            "INSERT INTO settings (key, value_json) VALUES ('system', $1)
             ON CONFLICT(key) DO UPDATE SET value_json = EXCLUDED.value_json",
        )
        .bind(&json)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert system settings: {e}")))?;

        Ok(())
    }

    // ── Integration endpoints ──────────────────────────────────────

    pub(super) async fn list_endpoints(
        &self,
    ) -> Result<Vec<timekeep_core::IntegrationEndpoint>, Error> {
        let rows = sqlx::query_as::<_, EndpointRow>(
            "SELECT id, name, kind, enabled, config_json, created_at, updated_at
             FROM integration_endpoints ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list endpoints: {e}")))?;

        Ok(rows
            .into_iter()
            .map(|r| timekeep_core::IntegrationEndpoint {
                id: r.id,
                name: r.name,
                kind: timekeep_core::IntegrationKind::from_str(&r.kind)
                    .unwrap_or(timekeep_core::IntegrationKind::Webhook),
                enabled: r.enabled,
                config: r.config_json,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub(super) async fn list_endpoints_filtered(
        &self,
        filter: &timekeep_core::EndpointFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::IntegrationEndpoint>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = match filter.params.sort_by.as_deref().unwrap_or("name") {
            "name" => "name",
            "kind" => "kind",
            "created_at" => "created_at",
            _ => "name",
        };
        let sort_dir = filter.params.sort_order.as_sql();
        let limit = filter.params.clamped_limit() as i64;

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref search) = filter.params.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            let n = where_values.len() + 1;
            where_clauses.push(format!(
                "(name LIKE ${n} ESCAPE '\\' OR kind LIKE ${n2} ESCAPE '\\')",
                n2 = n + 1
            ));
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // Count total
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
             FROM integration_endpoints {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT {limit}"
        );
        let mut query = sqlx::query_as::<_, EndpointRow>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }

        let rows: Vec<EndpointRow> = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("list endpoints filtered: {e}")))?;

        let items: Vec<timekeep_core::IntegrationEndpoint> = rows
            .into_iter()
            .map(|r| timekeep_core::IntegrationEndpoint {
                id: r.id,
                name: r.name,
                kind: timekeep_core::IntegrationKind::from_str(&r.kind)
                    .unwrap_or(timekeep_core::IntegrationKind::Webhook),
                enabled: r.enabled,
                config: r.config_json,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect();

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    pub(super) async fn create_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO integration_endpoints (id, name, kind, enabled, config_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(&endpoint.id)
        .bind(&endpoint.name)
        .bind(endpoint.kind.to_string())
        .bind(endpoint.enabled)
        .bind(&endpoint.config)
        .bind(endpoint.created_at)
        .bind(endpoint.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create endpoint: {e}")))?;
        Ok(())
    }

    pub(super) async fn update_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        sqlx::query(
            "UPDATE integration_endpoints SET name = $1, kind = $2, enabled = $3, config_json = $4, updated_at = $5
             WHERE id = $6",
        )
        .bind(&endpoint.name)
        .bind(endpoint.kind.to_string())
        .bind(endpoint.enabled)
        .bind(&endpoint.config)
        .bind(endpoint.updated_at)
        .bind(&endpoint.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update endpoint: {e}")))?;
        Ok(())
    }

    pub(super) async fn delete_endpoint(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM integration_endpoints WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete endpoint: {e}")))?;
        Ok(())
    }
}
