use super::PostgresStorage;
use timekeep_core::Error;

/// Row type for dashboard users (PostgreSQL).
#[derive(sqlx::FromRow)]
pub(super) struct DashboardUserRowPg {
    id: String,
    username: String,
    password_hash: String,
    salt: String,
    role: String,
    permissions_text: String,
    display_name: String,
    active: bool,
    created_at: i64,
    updated_at: i64,
}

impl DashboardUserRowPg {
    fn into_user(self) -> timekeep_core::DashboardUser {
        let role = match self.role.as_str() {
            "admin" => timekeep_core::Role::Admin,
            "operator" => timekeep_core::Role::Operator,
            _ => timekeep_core::Role::Viewer,
        };
        let permissions =
            timekeep_core::PermissionSet::from_space_separated(&self.permissions_text);

        timekeep_core::DashboardUser {
            id: self.id,
            username: self.username,
            password_hash: self.password_hash,
            salt: self.salt,
            role,
            permissions,
            display_name: self.display_name,
            active: self.active,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

impl PostgresStorage {
    pub(super) async fn create_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.as_str();
        let perms_text = user.permissions.to_space_separated();

        sqlx::query(
            "INSERT INTO dashboard_users (id, username, password_hash, salt, role, permissions_text, display_name, active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(&user.id)
        .bind(&user.username)
        .bind(&user.password_hash)
        .bind(&user.salt)
        .bind(role_str)
        .bind(perms_text)
        .bind(&user.display_name)
        .bind(user.active)
        .bind(user.created_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create dashboard user: {e}")))?;

        Ok(())
    }

    pub(super) async fn find_dashboard_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<timekeep_core::DashboardUser>, Error> {
        let row = sqlx::query_as::<_, DashboardUserRowPg>(
            "SELECT id, username, password_hash, salt, role, permissions_text, display_name, active, created_at, updated_at
             FROM dashboard_users WHERE username = $1 AND active = TRUE",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find dashboard user: {e}")))?;

        Ok(row.map(|r| r.into_user()))
    }

    pub(super) async fn list_dashboard_users(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DashboardUser>, Error> {
        let limit = params.clamped_limit() as i64;
        let search = params.search.as_deref().unwrap_or("");
        let search_pattern = timekeep_core::sanitize_search(search);

        let has_search = !search.is_empty();
        let where_clause = if has_search {
            "WHERE (username LIKE $1 ESCAPE '\\' OR display_name LIKE $2 ESCAPE '\\')"
        } else {
            ""
        };

        // Count total
        let count_sql = format!("SELECT COUNT(*) FROM dashboard_users {where_clause}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        if has_search {
            count_query = count_query.bind(&search_pattern).bind(&search_pattern);
        }
        let total: i64 = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count dashboard users: {e}")))?;

        let query_sql = format!(
            "SELECT id, username, password_hash, salt, role, permissions_text, display_name, active, created_at, updated_at
             FROM dashboard_users {where_clause} ORDER BY username ASC LIMIT {limit}"
        );
        let mut query = sqlx::query_as::<_, DashboardUserRowPg>(&query_sql);
        if has_search {
            query = query.bind(&search_pattern).bind(&search_pattern);
        }

        let rows: Vec<DashboardUserRowPg> = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?;

        let total_u64 = total as u64;
        let has_more = (rows.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(
            rows.into_iter().map(|r| r.into_user()).collect(),
            total_u64,
            has_more,
            None,
        ))
    }

    pub(super) async fn update_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.as_str();
        let perms_text = user.permissions.to_space_separated();

        let rows = sqlx::query(
            "UPDATE dashboard_users SET role = $1, permissions_text = $2, display_name = $3, active = $4, updated_at = $5
             WHERE id = $6",
        )
        .bind(role_str)
        .bind(perms_text)
        .bind(&user.display_name)
        .bind(user.active)
        .bind(user.updated_at)
        .bind(&user.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update dashboard user: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("dashboard user {}", user.id)));
        }
        Ok(())
    }

    pub(super) async fn delete_dashboard_user(&self, id: &str) -> Result<(), Error> {
        let rows = sqlx::query("DELETE FROM dashboard_users WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete dashboard user: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("dashboard user {id}")));
        }
        Ok(())
    }

    pub(super) async fn update_dashboard_user_password(
        &self,
        id: &str,
        password_hash: &str,
        salt: &str,
    ) -> Result<(), Error> {
        let rows = sqlx::query(
            "UPDATE dashboard_users SET password_hash = $1, salt = $2, updated_at = $3 WHERE id = $4",
        )
        .bind(password_hash)
        .bind(salt)
        .bind(jiff::Timestamp::now().as_second())
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update dashboard user password: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("dashboard user {id}")));
        }
        Ok(())
    }
}
