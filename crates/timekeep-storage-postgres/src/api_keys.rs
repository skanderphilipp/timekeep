use super::PostgresStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct ApiKeyRow {
    id: String,
    name: String,
    key_hash: String,
    prefix: String,
    permissions: String,
    created_by: String,
    created_at: i64,
    last_used_at: Option<i64>,
    expires_at: Option<i64>,
    revoked: bool,
}

impl ApiKeyRow {
    fn into_api_key(self) -> Result<timekeep_core::ApiKey, Error> {
        let created_at = jiff::Timestamp::from_second(self.created_at)
            .map_err(|e| Error::storage(format!("parse created_at: {e}")))?;
        let last_used_at = self
            .last_used_at
            .map(|ts| {
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;
        let expires_at = self
            .expires_at
            .map(|ts| {
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
            revoked: self.revoked,
        })
    }
}

impl PostgresStorage {
    pub(super) async fn create_api_key(&self, key: &timekeep_core::ApiKey) -> Result<(), Error> {
        let perms_json = key.permissions.to_json_array();

        sqlx::query(
            "INSERT INTO api_keys (id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(&key.id)
        .bind(&key.name)
        .bind(&key.key_hash)
        .bind(&key.prefix)
        .bind(&perms_json)
        .bind(&key.created_by)
        .bind(key.created_at.as_second())
        .bind(key.last_used_at.map(|t| t.as_second()))
        .bind(key.expires_at.map(|t| t.as_second()))
        .bind(key.revoked)
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
             FROM api_keys WHERE key_hash = $1 AND revoked = FALSE",
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
        let affected = sqlx::query("UPDATE api_keys SET revoked = TRUE WHERE id = $1")
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
        let now = jiff::Timestamp::now().as_second();
        sqlx::query("UPDATE api_keys SET last_used_at = $1 WHERE id = $2")
            .bind(now)
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("touch api key: {e}")))?;
        Ok(())
    }
}
