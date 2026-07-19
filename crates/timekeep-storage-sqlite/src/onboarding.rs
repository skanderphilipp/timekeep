use super::SqliteStorage;
use timekeep_core::{
    Error,
    model::onboarding::{
        OnboardingSession, OnboardingSessionLog, OnboardingStatus, OnboardingStepAction,
        OnboardingType,
    },
};

// ── Row types ─────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct OnboardingSessionRow {
    id: String,
    session_type: String,
    current_step: String,
    step_index: i64,
    status: String,
    entity_id: Option<String>,
    step_data: String,
    error_message: Option<String>,
    compensating: String,
    created_at: String,
    updated_at: String,
}

impl OnboardingSessionRow {
    fn into_session(self) -> Result<OnboardingSession, Error> {
        let session_type = match self.session_type.as_str() {
            "employee" => OnboardingType::Employee,
            "device" => OnboardingType::Device,
            other => {
                return Err(Error::storage(format!("unknown onboarding session_type: {other}")));
            },
        };

        let status = match self.status.as_str() {
            "in_progress" => OnboardingStatus::InProgress,
            "completed" => OnboardingStatus::Completed,
            "failed" => OnboardingStatus::Failed,
            "cancelled" => OnboardingStatus::Cancelled,
            "timed_out" => OnboardingStatus::TimedOut,
            other => {
                return Err(Error::storage(format!("unknown onboarding status: {other}")));
            },
        };

        let step_data: serde_json::Value =
            serde_json::from_str(&self.step_data).unwrap_or(serde_json::json!({}));
        let compensating: Vec<String> =
            serde_json::from_str(&self.compensating).unwrap_or_default();

        let created_at = parse_sqlite_timestamp(&self.created_at);
        let updated_at = parse_sqlite_timestamp(&self.updated_at);

        Ok(OnboardingSession {
            id: self.id,
            session_type,
            current_step: self.current_step,
            step_index: self.step_index as usize,
            status,
            entity_id: self.entity_id,
            step_data,
            error_message: self.error_message,
            compensating,
            created_at,
            updated_at,
        })
    }
}

#[derive(sqlx::FromRow)]
struct OnboardingSessionLogRow {
    id: String,
    session_id: String,
    step_name: String,
    action: String,
    detail_json: Option<String>,
    duration_ms: Option<i64>,
    created_at: String,
}

impl OnboardingSessionLogRow {
    fn into_log(self) -> Result<OnboardingSessionLog, Error> {
        let action = match self.action.as_str() {
            "started" => OnboardingStepAction::Started,
            "completed" => OnboardingStepAction::Completed,
            "failed" => OnboardingStepAction::Failed,
            "compensated" => OnboardingStepAction::Compensated,
            other => {
                return Err(Error::storage(format!("unknown step action: {other}")));
            },
        };

        let detail_json: Option<serde_json::Value> =
            self.detail_json.filter(|s| !s.is_empty()).and_then(|s| serde_json::from_str(&s).ok());

        let duration_ms = self.duration_ms.map(|d| d as u64);
        let created_at = parse_sqlite_timestamp(&self.created_at);

        Ok(OnboardingSessionLog {
            id: self.id,
            session_id: self.session_id,
            step_name: self.step_name,
            action,
            detail_json,
            duration_ms,
            created_at,
        })
    }
}

/// Parse a SQLite timestamp string into a `jiff::Timestamp`.
/// SQLite stores timestamps as either ISO 8601 text or Unix epoch seconds as text.
fn parse_sqlite_timestamp(raw: &str) -> jiff::Timestamp {
    raw.parse::<i64>()
        .ok()
        .and_then(|t| jiff::Timestamp::from_second(t).ok())
        .unwrap_or_else(jiff::Timestamp::now)
}

// ── Internal helpers ──────────────────────────────────────────────

impl SqliteStorage {
    /// Serialize session fields for a SQL INSERT or UPDATE.
    fn serialize_session_fields(session: &OnboardingSession) -> (String, String) {
        let step_data = session.step_data.to_string();
        let compensating =
            serde_json::to_string(&session.compensating).unwrap_or_else(|_| "[]".into());
        (step_data, compensating)
    }
}

// ── OnboardingSessionStore inherent methods ───────────────────────
// These mirror the OnboardingSessionStore trait. The trait delegation
// lives in lib.rs (matching the EmployeeStore pattern).

impl SqliteStorage {
    pub(super) async fn create_session(&self, session: &OnboardingSession) -> Result<(), Error> {
        let (step_data, compensating) = Self::serialize_session_fields(session);

        sqlx::query(
            "INSERT INTO onboarding_sessions
                (id, session_type, current_step, step_index, status, entity_id,
                 step_data, error_message, compensating, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&session.id)
        .bind(session.session_type.to_string())
        .bind(&session.current_step)
        .bind(session.step_index as i64)
        .bind(session.status.to_string())
        .bind(&session.entity_id)
        .bind(&step_data)
        .bind(&session.error_message)
        .bind(&compensating)
        .bind(session.created_at.as_second() as i64)
        .bind(session.updated_at.as_second() as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to create onboarding session: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_session(&self, id: &str) -> Result<Option<OnboardingSession>, Error> {
        let row = sqlx::query_as::<_, OnboardingSessionRow>(
            "SELECT * FROM onboarding_sessions WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to get onboarding session: {e}")))?;

        row.map(|r| r.into_session()).transpose()
    }

    pub(super) async fn update_session(&self, session: &OnboardingSession) -> Result<(), Error> {
        let (step_data, compensating) = Self::serialize_session_fields(session);

        sqlx::query(
            "UPDATE onboarding_sessions
             SET current_step = ?,
                 step_index = ?,
                 status = ?,
                 entity_id = ?,
                 step_data = ?,
                 error_message = ?,
                 compensating = ?,
                 updated_at = ?
             WHERE id = ?",
        )
        .bind(&session.current_step)
        .bind(session.step_index as i64)
        .bind(session.status.to_string())
        .bind(&session.entity_id)
        .bind(&step_data)
        .bind(&session.error_message)
        .bind(&compensating)
        .bind(session.updated_at.as_second() as i64)
        .bind(&session.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to update onboarding session: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_sessions(
        &self,
        status: Option<OnboardingStatus>,
        session_type: Option<OnboardingType>,
    ) -> Result<Vec<OnboardingSession>, Error> {
        let mut query = String::from("SELECT * FROM onboarding_sessions WHERE 1=1");
        let mut params: Vec<String> = Vec::new();

        if let Some(ref s) = status {
            query.push_str(" AND status = ?");
            params.push(s.to_string());
        }
        if let Some(ref t) = session_type {
            query.push_str(" AND session_type = ?");
            params.push(t.to_string());
        }
        query.push_str(" ORDER BY created_at DESC");

        let mut q = sqlx::query_as::<_, OnboardingSessionRow>(&query);
        for p in &params {
            q = q.bind(p);
        }

        let rows = q
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to list onboarding sessions: {e}")))?;

        rows.into_iter().map(|r| r.into_session()).collect()
    }

    pub(super) async fn cancel_session(&self, id: &str) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second() as i64;
        sqlx::query(
            "UPDATE onboarding_sessions
             SET status = 'cancelled', updated_at = ?
             WHERE id = ?",
        )
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to cancel onboarding session: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_abandoned_sessions(
        &self,
        older_than_secs: u64,
    ) -> Result<Vec<OnboardingSession>, Error> {
        let cutoff = jiff::Timestamp::now().as_second() as i64 - older_than_secs as i64;

        let rows = sqlx::query_as::<_, OnboardingSessionRow>(
            "SELECT * FROM onboarding_sessions
             WHERE status = 'in_progress'
               AND CAST(updated_at AS INTEGER) < ?",
        )
        .bind(cutoff)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to list abandoned sessions: {e}")))?;

        rows.into_iter().map(|r| r.into_session()).collect()
    }

    pub(super) async fn time_out_session(&self, id: &str) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second() as i64;
        sqlx::query(
            "UPDATE onboarding_sessions
             SET status = 'timed_out', updated_at = ?
             WHERE id = ?",
        )
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to time out onboarding session: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_session(&self, id: &str) -> Result<(), Error> {
        // Delete audit trail first (foreign key), then the session.
        sqlx::query("DELETE FROM onboarding_session_logs WHERE session_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to delete session logs: {e}")))?;

        sqlx::query("DELETE FROM onboarding_sessions WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to delete onboarding session: {e}")))?;

        Ok(())
    }

    pub(super) async fn count_sessions(
        &self,
        status: Option<OnboardingStatus>,
    ) -> Result<u64, Error> {
        let count = match status {
            Some(s) => sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM onboarding_sessions WHERE status = ?",
            )
            .bind(s.to_string())
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to count sessions: {e}")))?,
            None => sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM onboarding_sessions")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("failed to count sessions: {e}")))?,
        };
        Ok(count as u64)
    }

    // ── Audit Trail ─────────────────────────────────────────────

    pub(super) async fn record_step_log(&self, log: &OnboardingSessionLog) -> Result<(), Error> {
        let detail_json = log.detail_json.as_ref().map(|v| v.to_string());

        sqlx::query(
            "INSERT INTO onboarding_session_logs
                (id, session_id, step_name, action, detail_json, duration_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&log.id)
        .bind(&log.session_id)
        .bind(&log.step_name)
        .bind(log.action.to_string())
        .bind(&detail_json)
        .bind(log.duration_ms.map(|d| d as i64))
        .bind(log.created_at.as_second() as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to record step log: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_step_logs(
        &self,
        session_id: &str,
    ) -> Result<Vec<OnboardingSessionLog>, Error> {
        let rows = sqlx::query_as::<_, OnboardingSessionLogRow>(
            "SELECT * FROM onboarding_session_logs
             WHERE session_id = ?
             ORDER BY created_at ASC",
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to get step logs: {e}")))?;

        rows.into_iter().map(|r| r.into_log()).collect()
    }
}
