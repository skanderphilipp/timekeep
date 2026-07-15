use super::PostgresStorage;
use timekeep_core::Error;

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
}
