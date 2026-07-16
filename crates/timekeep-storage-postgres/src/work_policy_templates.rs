use super::PostgresStorage;
use timekeep_core::Error;
use timekeep_core::model::work_policy::WorkPolicyTemplate;

/// Row for deserialising a work policy template from Postgres.
#[derive(sqlx::FromRow)]
struct WorkPolicyTemplateRowPg {
    id: String,
    title: String,
    description: Option<String>,
    work_start: String,
    work_end: String,
    late_threshold_secs: i64,
    min_seconds_for_present: i64,
    daily_overtime_after_secs: i64,
    working_days: String,
    created_at: i64,
    updated_at: i64,
}

// Called through `dyn Storage` trait dispatch — clippy can't see the calls.
#[allow(dead_code)]
impl PostgresStorage {
    pub(super) async fn list_work_policy_templates(
        &self,
    ) -> Result<Vec<WorkPolicyTemplate>, Error> {
        let rows = sqlx::query_as::<_, WorkPolicyTemplateRowPg>(
            "SELECT id, title, description, work_start, work_end,
                    late_threshold_secs, min_seconds_for_present,
                    daily_overtime_after_secs, working_days,
                    created_at, updated_at
             FROM work_policy_templates
             ORDER BY title",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list work policy templates: {e}")))?;

        rows.into_iter().map(|r| row_to_template(&r)).collect()
    }

    pub(super) async fn get_work_policy_template(
        &self,
        id: &str,
    ) -> Result<Option<WorkPolicyTemplate>, Error> {
        let row = sqlx::query_as::<_, WorkPolicyTemplateRowPg>(
            "SELECT id, title, description, work_start, work_end,
                    late_threshold_secs, min_seconds_for_present,
                    daily_overtime_after_secs, working_days,
                    created_at, updated_at
             FROM work_policy_templates
             WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get work policy template: {e}")))?;

        row.map(|r| row_to_template(&r)).transpose()
    }

    pub(super) async fn get_work_policy_template_by_title(
        &self,
        title: &str,
    ) -> Result<Option<WorkPolicyTemplate>, Error> {
        let row = sqlx::query_as::<_, WorkPolicyTemplateRowPg>(
            "SELECT id, title, description, work_start, work_end,
                    late_threshold_secs, min_seconds_for_present,
                    daily_overtime_after_secs, working_days,
                    created_at, updated_at
             FROM work_policy_templates
             WHERE title = $1",
        )
        .bind(title)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get work policy template by title: {e}")))?;

        row.map(|r| row_to_template(&r)).transpose()
    }

    pub(super) async fn create_work_policy_template(
        &self,
        tpl: &WorkPolicyTemplate,
    ) -> Result<(), Error> {
        let working_days_json = serde_json::to_string(&tpl.working_days)
            .map_err(|e| Error::storage(format!("serialize working_days: {e}")))?;

        sqlx::query(
            "INSERT INTO work_policy_templates
                (id, title, description, work_start, work_end,
                 late_threshold_secs, min_seconds_for_present,
                 daily_overtime_after_secs, working_days,
                 created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(&tpl.id)
        .bind(&tpl.title)
        .bind(&tpl.description)
        .bind(format!("{:02}:{:02}", tpl.work_start.hour(), tpl.work_start.minute()))
        .bind(format!("{:02}:{:02}", tpl.work_end.hour(), tpl.work_end.minute()))
        .bind(tpl.late_threshold_secs)
        .bind(tpl.min_seconds_for_present)
        .bind(tpl.daily_overtime_after_secs)
        .bind(&working_days_json)
        .bind(tpl.created_at.as_second())
        .bind(tpl.updated_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create work policy template: {e}")))?;

        Ok(())
    }

    pub(super) async fn update_work_policy_template(
        &self,
        tpl: &WorkPolicyTemplate,
    ) -> Result<(), Error> {
        let working_days_json = serde_json::to_string(&tpl.working_days)
            .map_err(|e| Error::storage(format!("serialize working_days: {e}")))?;

        sqlx::query(
            "UPDATE work_policy_templates
             SET title = $1, description = $2, work_start = $3, work_end = $4,
                 late_threshold_secs = $5, min_seconds_for_present = $6,
                 daily_overtime_after_secs = $7, working_days = $8,
                 updated_at = $9
             WHERE id = $10",
        )
        .bind(&tpl.title)
        .bind(&tpl.description)
        .bind(format!("{:02}:{:02}", tpl.work_start.hour(), tpl.work_start.minute()))
        .bind(format!("{:02}:{:02}", tpl.work_end.hour(), tpl.work_end.minute()))
        .bind(tpl.late_threshold_secs)
        .bind(tpl.min_seconds_for_present)
        .bind(tpl.daily_overtime_after_secs)
        .bind(&working_days_json)
        .bind(tpl.updated_at.as_second())
        .bind(&tpl.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update work policy template: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_work_policy_template(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM work_policy_templates WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete work policy template: {e}")))?;

        Ok(())
    }
}

#[allow(dead_code)]
fn parse_time(s: &str) -> Result<jiff::civil::Time, Error> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return Err(Error::storage(format!("invalid time format '{s}'")));
    }
    let hour: i8 = parts[0].parse().map_err(|e| Error::storage(format!("invalid hour: {e}")))?;
    let minute: i8 =
        parts[1].parse().map_err(|e| Error::storage(format!("invalid minute: {e}")))?;
    jiff::civil::Time::new(hour, minute, 0, 0)
        .map_err(|e| Error::storage(format!("invalid time '{s}': {e}")))
}

#[allow(dead_code)]
fn row_to_template(row: &WorkPolicyTemplateRowPg) -> Result<WorkPolicyTemplate, Error> {
    let work_start = parse_time(&row.work_start)?;
    let work_end = parse_time(&row.work_end)?;

    let working_days: [bool; 7] = serde_json::from_str(&row.working_days)
        .map_err(|e| Error::storage(format!("deserialize working_days: {e}")))?;

    let created_at = jiff::Timestamp::from_second(row.created_at)
        .map_err(|e| Error::storage(format!("timestamp created_at: {e}")))?;
    let updated_at = jiff::Timestamp::from_second(row.updated_at)
        .map_err(|e| Error::storage(format!("timestamp updated_at: {e}")))?;

    Ok(WorkPolicyTemplate {
        id: row.id.clone(),
        title: row.title.clone(),
        description: row.description.clone(),
        work_start,
        work_end,
        late_threshold_secs: row.late_threshold_secs,
        min_seconds_for_present: row.min_seconds_for_present,
        daily_overtime_after_secs: row.daily_overtime_after_secs,
        working_days,
        created_at,
        updated_at,
    })
}
