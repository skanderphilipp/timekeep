use super::SqliteStorage;
use timekeep_core::Error;
use timekeep_core::model::work_policy::WorkPolicyTemplate;

// These types are used through `dyn Storage` trait dispatch, not directly.
// Clippy false positive — suppress.
#[allow(dead_code)]
/// Row for deserialising a work policy template from SQLite.
#[derive(sqlx::FromRow)]
struct WorkPolicyTemplateRow {
    id: String,
    title: String,
    description: Option<String>,
    work_start: String,
    work_end: String,
    late_threshold_secs: i64,
    min_seconds_for_present: i64,
    daily_overtime_after_secs: i64,
    working_days: String,
    created_at: String,
    updated_at: String,
}

// Called through `dyn Storage` trait dispatch — clippy can't see the calls.
#[allow(dead_code)]
impl SqliteStorage {
    pub(super) async fn list_work_policy_templates(
        &self,
    ) -> Result<Vec<WorkPolicyTemplate>, Error> {
        let rows = sqlx::query_as::<_, WorkPolicyTemplateRow>(
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
        let row = sqlx::query_as::<_, WorkPolicyTemplateRow>(
            "SELECT id, title, description, work_start, work_end,
                    late_threshold_secs, min_seconds_for_present,
                    daily_overtime_after_secs, working_days,
                    created_at, updated_at
             FROM work_policy_templates
             WHERE id = ?",
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
        let row = sqlx::query_as::<_, WorkPolicyTemplateRow>(
            "SELECT id, title, description, work_start, work_end,
                    late_threshold_secs, min_seconds_for_present,
                    daily_overtime_after_secs, working_days,
                    created_at, updated_at
             FROM work_policy_templates
             WHERE title = ?",
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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
             SET title = ?, description = ?, work_start = ?, work_end = ?,
                 late_threshold_secs = ?, min_seconds_for_present = ?,
                 daily_overtime_after_secs = ?, working_days = ?,
                 updated_at = ?
             WHERE id = ?",
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
        sqlx::query("DELETE FROM work_policy_templates WHERE id = ?")
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
fn row_to_template(row: &WorkPolicyTemplateRow) -> Result<WorkPolicyTemplate, Error> {
    let work_start = parse_time(&row.work_start)?;
    let work_end = parse_time(&row.work_end)?;

    let working_days: [bool; 7] = serde_json::from_str(&row.working_days)
        .map_err(|e| Error::storage(format!("deserialize working_days: {e}")))?;

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

#[cfg(test)]
mod tests {
    use timekeep_core::model::work_policy::{WorkPolicy, WorkPolicyTemplate};

    #[tokio::test]
    async fn test_create_and_list_templates() {
        let storage = crate::test_storage().await;

        let tpl = WorkPolicyTemplate::new(
            "Test Standard",
            Some("A test policy".into()),
            &WorkPolicy::standard_9to5(),
        );
        storage.create_work_policy_template(&tpl).await.expect("should create");

        let list = storage.list_work_policy_templates().await.expect("should list");
        // Should have at least our test template + 7 seeds
        assert!(list.iter().any(|t| t.title == "Test Standard"));
    }

    #[tokio::test]
    async fn test_template_to_work_policy() {
        let tpl = WorkPolicyTemplate::new(
            "Night",
            None,
            &WorkPolicy {
                work_start: jiff::civil::Time::new(22, 0, 0, 0).unwrap(),
                work_end: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
                late_threshold_secs: 900,
                min_seconds_for_present: 14400,
                daily_overtime_after_secs: 28800,
                working_days: [true, true, true, true, true, true, false],
            },
        );

        let policy: WorkPolicy = tpl.to_work_policy();
        assert_eq!(policy.expected_seconds(), 8 * 3600);
        assert!(!policy.is_working_day(6)); // Sunday off
    }

    #[tokio::test]
    async fn test_update_template() {
        let storage = crate::test_storage().await;

        let mut tpl = WorkPolicyTemplate::new("To Update", None, &WorkPolicy::standard_9to5());
        storage.create_work_policy_template(&tpl).await.expect("should create");

        tpl.rename("Updated Name");
        tpl.update_config(&WorkPolicy {
            work_start: jiff::civil::Time::new(8, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(16, 0, 0, 0).unwrap(),
            late_threshold_secs: 600,
            min_seconds_for_present: 18000,
            daily_overtime_after_secs: 32400,
            working_days: [true, true, true, true, false, false, false],
        });
        storage.update_work_policy_template(&tpl).await.expect("should update");

        let fetched = storage
            .get_work_policy_template(&tpl.id)
            .await
            .expect("should get")
            .expect("should exist");
        assert_eq!(fetched.title, "Updated Name");
        assert_eq!(fetched.work_start.hour(), 8);
    }

    #[tokio::test]
    async fn test_delete_template() {
        let storage = crate::test_storage().await;

        let tpl = WorkPolicyTemplate::new("To Delete", None, &WorkPolicy::standard_9to5());
        storage.create_work_policy_template(&tpl).await.expect("should create");

        storage.delete_work_policy_template(&tpl.id).await.expect("should delete");

        let fetched = storage.get_work_policy_template(&tpl.id).await.expect("should get");
        assert!(fetched.is_none());
    }
}
