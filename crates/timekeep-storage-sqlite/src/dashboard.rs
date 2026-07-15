use super::SqliteStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct DashboardUserRow {
    id: String,
    username: String,
    password_hash: String,
    salt: String,
    role: String,
    display_name: String,
    active: i32,
    created_at: i64,
    updated_at: i64,
    permissions_text: Option<String>,
}

impl DashboardUserRow {
    fn into_user(self) -> Result<timekeep_core::DashboardUser, Error> {
        let role = timekeep_core::Role::from_str(&self.role).unwrap_or(timekeep_core::Role::Viewer);
        let permissions = self
            .permissions_text
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(timekeep_core::PermissionSet::from_space_separated)
            .unwrap_or_else(timekeep_core::PermissionSet::empty);
        Ok(timekeep_core::DashboardUser {
            id: self.id,
            username: self.username,
            password_hash: self.password_hash,
            salt: self.salt,
            role,
            permissions,
            display_name: self.display_name,
            active: self.active != 0,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

impl SqliteStorage {
    pub(super) async fn create_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.to_string();
        let perms_text = user.permissions.to_space_separated();
        sqlx::query(
            "INSERT INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&user.id)
        .bind(&user.username)
        .bind(&user.password_hash)
        .bind(&user.salt)
        .bind(&role_str)
        .bind(&user.display_name)
        .bind(user.active as i32)
        .bind(user.created_at)
        .bind(user.updated_at)
        .bind(&perms_text)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("UNIQUE") {
                Error::duplicate(format!("username '{}' already exists", user.username))
            } else {
                Error::storage(format!("create dashboard user: {e}"))
            }
        })?;
        tracing::info!(username = %user.username, role = %role_str, "dashboard user created");
        Ok(())
    }

    pub(super) async fn find_dashboard_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<timekeep_core::DashboardUser>, Error> {
        let row = sqlx::query_as::<_, DashboardUserRow>(
            "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
             FROM dashboard_users WHERE username = ? AND active = 1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find dashboard user: {e}")))?;

        row.map(|r| r.into_user()).transpose()
    }

    pub(super) async fn list_dashboard_users(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DashboardUser>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = match params.sort_by.as_deref().unwrap_or("username") {
            "username" => "username",
            "role" => "role",
            "display_name" => "display_name",
            "created_at" => "created_at",
            _ => "username",
        };
        let sort_dir = params.sort_order.as_sql();
        let limit = params.clamped_limit();

        // Count
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM dashboard_users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count dashboard users: {e}")))?;

        // Fetch
        let mut query_sql = format!(
            "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
             FROM dashboard_users ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );

        // Apply search if provided
        let rows: Vec<DashboardUserRow> = if let Some(ref search) = params.search {
            if !search.is_empty() {
                let pattern = sanitize_search(search);
                query_sql = format!(
                    "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
                     FROM dashboard_users
                     WHERE (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
                     ORDER BY {sort_col} {sort_dir} LIMIT ?"
                );
                sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                    .bind(&pattern)
                    .bind(&pattern)
                    .bind(limit as i64)
                    .fetch_all(&self.pool)
                    .await
                    .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
            } else {
                sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                    .bind(limit as i64)
                    .fetch_all(&self.pool)
                    .await
                    .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
            }
        } else {
            sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                .bind(limit as i64)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
        };

        let items: Vec<timekeep_core::DashboardUser> =
            rows.into_iter().map(|r| r.into_user()).collect::<Result<_, _>>()?;

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;
        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    pub(super) async fn update_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.to_string();
        let perms_update_text = user.permissions.to_space_separated();
        let affected = sqlx::query(
            "UPDATE dashboard_users
             SET role = ?, display_name = ?, active = ?, permissions_text = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&role_str)
        .bind(&user.display_name)
        .bind(user.active as i32)
        .bind(&perms_update_text)
        .bind(user.updated_at)
        .bind(&user.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update dashboard user: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{}' not found", user.id)));
        }
        tracing::info!(id = %user.id, username = %user.username, "dashboard user updated");
        Ok(())
    }

    pub(super) async fn delete_dashboard_user(&self, id: &str) -> Result<(), Error> {
        let affected = sqlx::query("DELETE FROM dashboard_users WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete dashboard user: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{id}' not found")));
        }
        tracing::info!(id = %id, "dashboard user deleted");
        Ok(())
    }

    pub(super) async fn update_dashboard_user_password(
        &self,
        id: &str,
        password_hash: &str,
        salt: &str,
    ) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second();
        let affected = sqlx::query(
            "UPDATE dashboard_users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?",
        )
        .bind(password_hash)
        .bind(salt)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update password: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{id}' not found")));
        }
        tracing::info!(id = %id, "dashboard user password changed");
        Ok(())
    }
}
