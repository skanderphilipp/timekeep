use super::SqliteStorage;
use timekeep_core::Error;
use timekeep_core::model::department::Department;

/// Row for deserialising a department from SQLite.
#[derive(sqlx::FromRow)]
struct DepartmentRow {
    id: String,
    name: String,
    work_policy_json: Option<String>,
    created_at: String,
    updated_at: String,
}

impl SqliteStorage {
    pub(super) async fn list_departments(&self) -> Result<Vec<Department>, Error> {
        let rows = sqlx::query_as::<_, DepartmentRow>(
            "SELECT id, name, work_policy_json, created_at, updated_at FROM departments ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list departments: {e}")))?;

        rows.into_iter().map(|r| row_to_department(&r)).collect()
    }

    pub(super) async fn get_department(&self, id: &str) -> Result<Option<Department>, Error> {
        let row = sqlx::query_as::<_, DepartmentRow>(
            "SELECT id, name, work_policy_json, created_at, updated_at FROM departments WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get department: {e}")))?;

        row.map(|r| row_to_department(&r)).transpose()
    }

    pub(super) async fn get_department_by_name(
        &self,
        name: &str,
    ) -> Result<Option<Department>, Error> {
        let row = sqlx::query_as::<_, DepartmentRow>(
            "SELECT id, name, work_policy_json, created_at, updated_at FROM departments WHERE name = ?",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get department by name: {e}")))?;

        row.map(|r| row_to_department(&r)).transpose()
    }

    pub(super) async fn create_department(&self, dept: &Department) -> Result<(), Error> {
        let policy_json = dept
            .work_policy
            .as_ref()
            .map(|p| serde_json::to_string(p))
            .transpose()
            .map_err(|e| Error::validation(format!("serialize work policy: {e}")))?;

        sqlx::query(
            "INSERT INTO departments (id, name, work_policy_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&dept.id.0)
        .bind(&dept.name)
        .bind(&policy_json)
        .bind(dept.created_at.as_second())
        .bind(dept.updated_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create department: {e}")))?;

        Ok(())
    }

    pub(super) async fn update_department(&self, dept: &Department) -> Result<(), Error> {
        let policy_json = dept
            .work_policy
            .as_ref()
            .map(|p| serde_json::to_string(p))
            .transpose()
            .map_err(|e| Error::validation(format!("serialize work policy: {e}")))?;

        sqlx::query(
            "UPDATE departments SET name = ?, work_policy_json = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&dept.name)
        .bind(&policy_json)
        .bind(dept.updated_at.as_second())
        .bind(&dept.id.0)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update department: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_department(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM departments WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete department: {e}")))?;

        Ok(())
    }
}

fn row_to_department(row: &DepartmentRow) -> Result<Department, Error> {
    let work_policy = match &row.work_policy_json {
        Some(json) if !json.is_empty() => Some(
            serde_json::from_str(json)
                .map_err(|e| Error::storage(format!("deserialize work policy: {e}")))?,
        ),
        _ => None,
    };

    let created_at = jiff::Timestamp::from_second(
        row.created_at
            .parse::<i64>()
            .map_err(|e| Error::storage(format!("parse created_at: {e}")))?,
    )
    .map_err(|e| Error::storage(format!("timestamp created_at: {e}")))?;

    let updated_at = jiff::Timestamp::from_second(
        row.updated_at
            .parse::<i64>()
            .map_err(|e| Error::storage(format!("parse updated_at: {e}")))?,
    )
    .map_err(|e| Error::storage(format!("timestamp updated_at: {e}")))?;

    Ok(Department {
        id: timekeep_core::model::department::DepartmentId(row.id.clone()),
        name: row.name.clone(),
        work_policy,
        created_at,
        updated_at,
    })
}

#[cfg(test)]
mod tests {
    use timekeep_core::model::department::Department;
    use timekeep_core::model::work_policy::WorkPolicy;

    #[tokio::test]
    async fn test_create_and_list_departments() {
        let storage = crate::test_storage().await;

        let dept = Department::new("Engineering", None);
        storage.create_department(&dept).await.expect("should create");

        let list = storage.list_departments().await.expect("should list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Engineering");
    }

    #[tokio::test]
    async fn test_department_with_work_policy() {
        let storage = crate::test_storage().await;

        let policy = WorkPolicy::standard_9to5();
        let dept = Department::new("Warehouse", Some(policy.clone()));
        storage.create_department(&dept).await.expect("should create");

        let fetched =
            storage.get_department(&dept.id.0).await.expect("should get").expect("should exist");
        assert_eq!(fetched.name, "Warehouse");
        assert!(fetched.work_policy.is_some());
    }

    #[tokio::test]
    async fn test_update_department() {
        let storage = crate::test_storage().await;

        let mut dept = Department::new("HR", None);
        storage.create_department(&dept).await.expect("should create");

        dept.rename("Human Resources");
        dept.set_work_policy(Some(WorkPolicy::standard_9to5()));
        storage.update_department(&dept).await.expect("should update");

        let fetched =
            storage.get_department(&dept.id.0).await.expect("should get").expect("should exist");
        assert_eq!(fetched.name, "Human Resources");
        assert!(fetched.work_policy.is_some());
    }

    #[tokio::test]
    async fn test_delete_department() {
        let storage = crate::test_storage().await;

        let dept = Department::new("Temp", None);
        storage.create_department(&dept).await.expect("should create");

        storage.delete_department(&dept.id.0).await.expect("should delete");

        let fetched = storage.get_department(&dept.id.0).await.expect("should get");
        assert!(fetched.is_none());
    }
}
