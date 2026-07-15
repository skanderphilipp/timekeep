use super::SqliteStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct ProviderRow {
    key: String,
    display_name: String,
    default_port: i64,
    supports_adms: i64,
    supports_sdk: i64,
    capabilities_json: String,
    enabled: i64,
}

impl ProviderRow {
    fn into_provider_info(self) -> timekeep_core::ProviderInfo {
        let capabilities: timekeep_core::ProviderCapabilities =
            serde_json::from_str(&self.capabilities_json).unwrap_or_default();
        timekeep_core::ProviderInfo {
            key: self.key,
            display_name: self.display_name,
            default_port: self.default_port as u16,
            supports_adms: self.supports_adms != 0,
            supports_sdk: self.supports_sdk != 0,
            capabilities,
            enabled: self.enabled != 0,
        }
    }
}

impl SqliteStorage {
    pub(super) async fn health_check(&self) -> Result<(), Error> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("health check: {e}")))?;
        Ok(())
    }

    pub(super) async fn get_system_settings(&self) -> Result<timekeep_core::SystemSettings, Error> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value_json FROM settings WHERE key = 'system'")
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("get system settings: {e}")))?;

        match row {
            Some((json,)) => serde_json::from_str(&json)
                .map_err(|e| Error::storage(format!("deserialize system settings: {e}"))),
            None => Ok(timekeep_core::SystemSettings::default()),
        }
    }

    pub(super) async fn upsert_system_settings(
        &self,
        settings: &timekeep_core::SystemSettings,
    ) -> Result<(), Error> {
        let json = serde_json::to_string(settings)
            .map_err(|e| Error::storage(format!("serialize system settings: {e}")))?;

        sqlx::query(
            "INSERT INTO settings (key, value_json) VALUES ('system', ?)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        )
        .bind(&json)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert system settings: {e}")))?;

        tracing::info!("system settings updated");
        Ok(())
    }

    pub(super) async fn register_provider(
        &self,
        provider: &timekeep_core::ProviderInfo,
    ) -> Result<(), Error> {
        let caps =
            serde_json::to_string(&provider.capabilities).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO providers (key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET
                display_name=excluded.display_name,
                default_port=excluded.default_port,
                supports_adms=excluded.supports_adms,
                supports_sdk=excluded.supports_sdk,
                capabilities_json=excluded.capabilities_json,
                enabled=excluded.enabled",
        )
        .bind(&provider.key)
        .bind(&provider.display_name)
        .bind(provider.default_port as i64)
        .bind(provider.supports_adms as i64)
        .bind(provider.supports_sdk as i64)
        .bind(&caps)
        .bind(provider.enabled as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("register provider: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_providers(&self) -> Result<Vec<timekeep_core::ProviderInfo>, Error> {
        let rows = sqlx::query_as::<_, ProviderRow>(
            "SELECT key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled
             FROM providers ORDER BY key",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list providers: {e}")))?;

        Ok(rows.into_iter().map(|r| r.into_provider_info()).collect())
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_register_and_list_providers() {
        let storage = crate::test_storage().await;

        let provider = timekeep_core::ProviderInfo {
            key: "zkteco".into(),
            display_name: "ZKTeco".into(),
            default_port: 4370,
            supports_adms: true,
            supports_sdk: true,
            capabilities: timekeep_core::ProviderCapabilities {
                attendance_read: true,
                user_read: true,
                ..Default::default()
            },
            enabled: true,
        };

        storage.register_provider(&provider).await.expect("register");

        let providers = storage.list_providers().await.expect("list");
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].key, "zkteco");
        assert_eq!(providers[0].display_name, "ZKTeco");
        assert_eq!(providers[0].default_port, 4370);
        assert!(providers[0].enabled);
        assert!(providers[0].capabilities.attendance_read);
    }
}
