use super::PostgresStorage;
use timekeep_core::Error;

/// Minimal row for listing device users (pin, name, privilege).
#[derive(sqlx::FromRow)]
pub(super) struct UserListRowPg {
    pin: String,
    name: String,
    privilege: Option<i32>,
}

impl PostgresStorage {
    pub(super) async fn upsert_user(
        &self,
        device_sn: &str,
        pin: &str,
        name: &str,
        privilege: Option<i32>,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO users (pin, device_sn, name, privilege, synced_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT(pin, device_sn) DO UPDATE SET
                name = EXCLUDED.name,
                privilege = EXCLUDED.privilege,
                synced_at = NOW()",
        )
        .bind(pin)
        .bind(device_sn)
        .bind(name)
        .bind(privilege)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert user: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let result =
            sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE pin = $1 LIMIT 1")
                .bind(pin)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("get user name: {e}")))?;

        Ok(result)
    }

    pub(super) async fn count_device_users(&self, device_sn: &str) -> Result<u32, Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE device_sn = $1")
            .bind(device_sn)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count device users: {e}")))?;
        Ok(count as u32)
    }

    pub(super) async fn list_device_users(
        &self,
        device_sn: &str,
    ) -> Result<Vec<(String, String, Option<i32>)>, Error> {
        let rows = sqlx::query_as::<_, UserListRowPg>(
            "SELECT pin, name, privilege FROM users WHERE device_sn = $1 ORDER BY pin",
        )
        .bind(device_sn)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list device users: {e}")))?;

        Ok(rows.into_iter().map(|r| (r.pin, r.name, r.privilege)).collect())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    async fn get_storage() -> Option<PostgresStorage> {
        crate::test_storage().await
    }

    // ─── User Sync ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_user() {
        let Some(storage) = get_storage().await else {
            return;
        };

        storage
            .upsert_user("DEV001", "145", "Ahmed Al-Farsi", Some(0))
            .await
            .expect("should upsert user");

        let name = storage.get_user_name("145").await.expect("should query");
        assert_eq!(name.as_deref(), Some("Ahmed Al-Farsi"));
    }

    #[tokio::test]
    async fn test_get_user_name_not_found() {
        let Some(storage) = get_storage().await else {
            return;
        };

        let name = storage.get_user_name("nonexistent-pin").await.expect("should query");
        assert!(name.is_none());
    }
}
