use super::SqliteStorage;
use timekeep_core::Error;

/// Minimal row for listing device users (pin, name, privilege, group, card).
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub(super) struct UserListRow {
    pin: String,
    name: String,
    privilege: Option<i32>,
    card_number: Option<String>,
    group_num: Option<i32>,
}

impl SqliteStorage {
    pub(super) async fn upsert_user(
        &self,
        device_sn: &str,
        pin: &str,
        name: &str,
        privilege: Option<i32>,
        card_number: Option<&str>,
        group_num: Option<i32>,
        timezone: Option<i32>,
        password_hash: Option<&str>,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO users (pin, device_sn, name, privilege, card_number, group_num, timezone, password_hash, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(pin, device_sn) DO UPDATE SET
                name = EXCLUDED.name,
                privilege = EXCLUDED.privilege,
                card_number = EXCLUDED.card_number,
                group_num = EXCLUDED.group_num,
                timezone = EXCLUDED.timezone,
                password_hash = EXCLUDED.password_hash,
                synced_at = datetime('now')",
        )
        .bind(pin)
        .bind(device_sn)
        .bind(name)
        .bind(privilege)
        .bind(card_number)
        .bind(group_num)
        .bind(timezone)
        .bind(password_hash)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert user: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let result =
            sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE pin = ? LIMIT 1")
                .bind(pin)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("get user name: {e}")))?;

        Ok(result)
    }

    pub(super) async fn count_device_users(&self, device_sn: &str) -> Result<u32, Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE device_sn = ?")
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
        let rows = sqlx::query_as::<_, UserListRow>(
            "SELECT pin, name, privilege FROM users WHERE device_sn = ? ORDER BY pin",
        )
        .bind(device_sn)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list device users: {e}")))?;

        Ok(rows.into_iter().map(|r| (r.pin, r.name, r.privilege)).collect())
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_upsert_user_inserts() {
        let storage = crate::test_storage().await;

        storage
            .upsert_user("SN001", "145", "Ahmed Al-Farsi", Some(0), None, None, None, None)
            .await
            .expect("should upsert user");

        let name = storage.get_user_name("145").await.expect("should query");
        assert_eq!(name.as_deref(), Some("Ahmed Al-Farsi"));
    }

    #[tokio::test]
    async fn test_get_user_name_not_found() {
        let storage = crate::test_storage().await;

        let name = storage.get_user_name("nonexistent-pin").await.expect("should query");
        assert!(name.is_none());
    }
}
