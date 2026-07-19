use super::PostgresStorage;
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
    step_index: i32,
    status: String,
    entity_id: Option<String>,
    step_data: serde_json::Value,
    error_message: Option<String>,
    compensating: serde_json::Value,
    created_at: i64,
    updated_at: i64,
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

        let compensating: Vec<String> = self
            .compensating
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        Ok(OnboardingSession {
            id: self.id,
            session_type,
            current_step: self.current_step,
            step_index: self.step_index as usize,
            status,
            entity_id: self.entity_id,
            step_data: self.step_data,
            error_message: self.error_message,
            compensating,
            created_at: jiff::Timestamp::from_second(self.created_at)
                .map_err(|e| Error::storage(format!("invalid created_at: {e}")))?,
            updated_at: jiff::Timestamp::from_second(self.updated_at)
                .map_err(|e| Error::storage(format!("invalid updated_at: {e}")))?,
        })
    }
}

#[derive(sqlx::FromRow)]
struct OnboardingSessionLogRow {
    id: String,
    session_id: String,
    step_name: String,
    action: String,
    detail_json: Option<serde_json::Value>,
    duration_ms: Option<i64>,
    created_at: i64,
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

        Ok(OnboardingSessionLog {
            id: self.id,
            session_id: self.session_id,
            step_name: self.step_name,
            action,
            detail_json: self.detail_json,
            duration_ms: self.duration_ms.map(|d| d as u64),
            created_at: jiff::Timestamp::from_second(self.created_at)
                .map_err(|e| Error::storage(format!("invalid created_at: {e}")))?,
        })
    }
}

// ── OnboardingSessionStore implementation ─────────────────────────

#[async_trait::async_trait]
impl timekeep_core::OnboardingSessionStore for PostgresStorage {
    async fn create_session(&self, session: &OnboardingSession) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO onboarding_sessions
                (id, session_type, current_step, step_index, status, entity_id,
                 step_data, error_message, compensating, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(&session.id)
        .bind(session.session_type.to_string())
        .bind(&session.current_step)
        .bind(session.step_index as i32)
        .bind(session.status.to_string())
        .bind(&session.entity_id)
        .bind(&session.step_data)
        .bind(&session.error_message)
        .bind(&serde_json::to_value(&session.compensating).unwrap_or_default())
        .bind(session.created_at.as_second())
        .bind(session.updated_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to create onboarding session: {e}")))?;

        Ok(())
    }

    async fn get_session(&self, id: &str) -> Result<Option<OnboardingSession>, Error> {
        let row = sqlx::query_as::<_, OnboardingSessionRow>(
            "SELECT * FROM onboarding_sessions WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to get onboarding session: {e}")))?;

        row.map(|r| r.into_session()).transpose()
    }

    async fn update_session(&self, session: &OnboardingSession) -> Result<(), Error> {
        sqlx::query(
            "UPDATE onboarding_sessions
             SET current_step = $1,
                 step_index = $2,
                 status = $3,
                 entity_id = $4,
                 step_data = $5,
                 error_message = $6,
                 compensating = $7,
                 updated_at = $8
             WHERE id = $9",
        )
        .bind(&session.current_step)
        .bind(session.step_index as i32)
        .bind(session.status.to_string())
        .bind(&session.entity_id)
        .bind(&session.step_data)
        .bind(&session.error_message)
        .bind(&serde_json::to_value(&session.compensating).unwrap_or_default())
        .bind(session.updated_at.as_second())
        .bind(&session.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to update onboarding session: {e}")))?;

        Ok(())
    }

    async fn list_sessions(
        &self,
        status: Option<OnboardingStatus>,
        session_type: Option<OnboardingType>,
    ) -> Result<Vec<OnboardingSession>, Error> {
        let mut query_str = String::from("SELECT * FROM onboarding_sessions WHERE TRUE");
        let mut param_idx = 1u32;

        if status.is_some() {
            query_str.push_str(&format!(" AND status = ${param_idx}"));
            param_idx += 1;
        }
        if session_type.is_some() {
            query_str.push_str(&format!(" AND session_type = ${param_idx}"));
        }
        query_str.push_str(" ORDER BY created_at DESC");

        let mut q = sqlx::query_as::<_, OnboardingSessionRow>(&query_str);

        if let Some(ref s) = status {
            q = q.bind(s.to_string());
        }
        if let Some(ref t) = session_type {
            q = q.bind(t.to_string());
        }

        let rows = q
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to list onboarding sessions: {e}")))?;

        rows.into_iter().map(|r| r.into_session()).collect()
    }

    async fn cancel_session(&self, id: &str) -> Result<(), Error> {
        sqlx::query(
            "UPDATE onboarding_sessions
             SET status = 'cancelled', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
             WHERE id = $1",
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to cancel onboarding session: {e}")))?;

        Ok(())
    }

    async fn list_abandoned_sessions(
        &self,
        older_than_secs: u64,
    ) -> Result<Vec<OnboardingSession>, Error> {
        let rows = sqlx::query_as::<_, OnboardingSessionRow>(
            "SELECT * FROM onboarding_sessions
             WHERE status = 'in_progress'
               AND updated_at < EXTRACT(EPOCH FROM NOW()) - $1::BIGINT",
        )
        .bind(older_than_secs as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to list abandoned sessions: {e}")))?;

        rows.into_iter().map(|r| r.into_session()).collect()
    }

    async fn time_out_session(&self, id: &str) -> Result<(), Error> {
        sqlx::query(
            "UPDATE onboarding_sessions
             SET status = 'timed_out', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
             WHERE id = $1",
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to time out onboarding session: {e}")))?;

        Ok(())
    }

    async fn delete_session(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM onboarding_session_logs WHERE session_id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to delete session logs: {e}")))?;

        sqlx::query("DELETE FROM onboarding_sessions WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("failed to delete onboarding session: {e}")))?;

        Ok(())
    }

    async fn count_sessions(&self, status: Option<OnboardingStatus>) -> Result<u64, Error> {
        let count = match status {
            Some(s) => sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM onboarding_sessions WHERE status = $1",
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

    async fn record_step_log(&self, log: &OnboardingSessionLog) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO onboarding_session_logs
                (id, session_id, step_name, action, detail_json, duration_ms, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(&log.id)
        .bind(&log.session_id)
        .bind(&log.step_name)
        .bind(log.action.to_string())
        .bind(&log.detail_json)
        .bind(log.duration_ms.map(|d| d as i64))
        .bind(log.created_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to record step log: {e}")))?;

        Ok(())
    }

    async fn get_step_logs(&self, session_id: &str) -> Result<Vec<OnboardingSessionLog>, Error> {
        let rows = sqlx::query_as::<_, OnboardingSessionLogRow>(
            "SELECT * FROM onboarding_session_logs
             WHERE session_id = $1
             ORDER BY created_at ASC",
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("failed to get step logs: {e}")))?;

        rows.into_iter().map(|r| r.into_log()).collect()
    }
}
