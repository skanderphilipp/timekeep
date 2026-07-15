use super::SqliteStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct ApiKeyRow {
    id: String,
    name: String,
    key_hash: String,
    prefix: String,
    permissions: String, // JSON array
    created_by: String,
    created_at: String,
    last_used_at: Option<String>,
    expires_at: Option<String>,
    revoked: i32,
}

impl ApiKeyRow {
    fn into_api_key(self) -> Result<timekeep_core::ApiKey, Error> {
        let created_at = {
            let ts = self
                .created_at
                .parse::<i64>()
                .map_err(|e| Error::storage(format!("parse created_at: {e}")))?;
            jiff::Timestamp::from_second(ts)
                .map_err(|e| Error::storage(format!("timestamp: {e}")))?
        };

        let last_used_at = self
            .last_used_at
            .map(|s| {
                let ts = s
                    .parse::<i64>()
                    .map_err(|e| Error::storage(format!("parse last_used_at: {e}")))?;
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;

        let expires_at = self
            .expires_at
            .map(|s| {
                let ts = s
                    .parse::<i64>()
                    .map_err(|e| Error::storage(format!("parse expires_at: {e}")))?;
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;

        let permissions = timekeep_core::PermissionSet::from_json_array(&self.permissions)
            .map_err(|e| Error::storage(format!("parse permissions: {e}")))?;

        Ok(timekeep_core::ApiKey {
            id: self.id,
            name: self.name,
            key_hash: self.key_hash,
            prefix: self.prefix,
            permissions,
            created_by: self.created_by,
            created_at,
            last_used_at,
            expires_at,
            revoked: self.revoked != 0,
        })
    }
}

impl SqliteStorage {
    pub(super) async fn create_api_key(&self, key: &timekeep_core::ApiKey) -> Result<(), Error> {
        let perms_json = key.permissions.to_json_array();
        let created_at = key.created_at.as_second().to_string();
        let last_used = key.last_used_at.map(|t| t.as_second().to_string());
        let expires = key.expires_at.map(|t| t.as_second().to_string());

        sqlx::query(
            "INSERT INTO api_keys (id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&key.id)
        .bind(&key.name)
        .bind(&key.key_hash)
        .bind(&key.prefix)
        .bind(&perms_json)
        .bind(&key.created_by)
        .bind(&created_at)
        .bind(&last_used)
        .bind(&expires)
        .bind(key.revoked as i32)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create api key: {e}")))?;

        Ok(())
    }

    pub(super) async fn find_api_key_by_hash(
        &self,
        key_hash: &str,
    ) -> Result<Option<timekeep_core::ApiKey>, Error> {
        let row = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked
             FROM api_keys WHERE key_hash = ? AND revoked = 0",
        )
        .bind(key_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find api key: {e}")))?;

        row.map(|r| r.into_api_key()).transpose()
    }

    pub(super) async fn list_api_keys(&self) -> Result<Vec<timekeep_core::ApiKey>, Error> {
        let rows = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked
             FROM api_keys ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list api keys: {e}")))?;

        rows.into_iter().map(|r| r.into_api_key()).collect()
    }

    pub(super) async fn revoke_api_key(&self, key_id: &str) -> Result<(), Error> {
        let affected = sqlx::query("UPDATE api_keys SET revoked = 1 WHERE id = ?")
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("revoke api key: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("api key '{key_id}' not found")));
        }
        Ok(())
    }

    pub(super) async fn touch_api_key(&self, key_id: &str) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second().to_string();
        sqlx::query("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
            .bind(&now)
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("touch api key: {e}")))?;
        Ok(())
    }
}
