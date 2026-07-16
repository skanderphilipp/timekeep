use super::PostgresStorage;
use timekeep_core::Error;
use timekeep_core::model::department::Department;

/// Row for deserialising a department from Postgres.
#[derive(sqlx::FromRow)]
struct DepartmentRowPg {
    id: String,
    name: String,
    work_policy_id: Option<String>,
    work_policy_json: Option<String>,
    created_at: i64,
    updated_at: i64,
}

impl PostgresStorage {
    pub(super) async fn list_departments(&self) -> Result<Vec<Department>, Error> {
        let rows = sqlx::query_as::<_, DepartmentRowPg>(
            "SELECT id, name, work_policy_id, work_policy_json, created_at, updated_at FROM departments ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list departments: {e}")))?;

        rows.into_iter().map(|r| row_to_department(&r)).collect()
    }

    pub(super) async fn get_department(&self, id: &str) -> Result<Option<Department>, Error> {
        let row = sqlx::query_as::<_, DepartmentRowPg>(
            "SELECT id, name, work_policy_id, work_policy_json, created_at, updated_at FROM departments WHERE id = $1",
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
        let row = sqlx::query_as::<_, DepartmentRowPg>(
            "SELECT id, name, work_policy_id, work_policy_json, created_at, updated_at FROM departments WHERE name = $1",
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
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| Error::validation(format!("serialize work policy: {e}")))?;

        sqlx::query(
            "INSERT INTO departments (id, name, work_policy_id, work_policy_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(&dept.id.0)
        .bind(&dept.name)
        .bind(&dept.work_policy_id)
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
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| Error::validation(format!("serialize work policy: {e}")))?;

        sqlx::query(
            "UPDATE departments SET name = $1, work_policy_id = $2, work_policy_json = $3, updated_at = $4 WHERE id = $5",
        )
        .bind(&dept.name)
        .bind(&dept.work_policy_id)
        .bind(&policy_json)
        .bind(dept.updated_at.as_second())
        .bind(&dept.id.0)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update department: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_department(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM departments WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete department: {e}")))?;

        Ok(())
    }
}

fn row_to_department(row: &DepartmentRowPg) -> Result<Department, Error> {
    let work_policy = match &row.work_policy_json {
        Some(json) if !json.is_empty() => Some(
            serde_json::from_str(json)
                .map_err(|e| Error::storage(format!("deserialize work policy: {e}")))?,
        ),
        _ => None,
    };

    let created_at = jiff::Timestamp::from_second(row.created_at)
        .map_err(|e| Error::storage(format!("timestamp created_at: {e}")))?;
    let updated_at = jiff::Timestamp::from_second(row.updated_at)
        .map_err(|e| Error::storage(format!("timestamp updated_at: {e}")))?;

    Ok(Department {
        id: timekeep_core::model::department::DepartmentId(row.id.clone()),
        name: row.name.clone(),
        work_policy_id: row.work_policy_id.clone(),
        work_policy,
        created_at,
        updated_at,
    })
}
