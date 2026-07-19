//! Persistence for the OnboardingSession aggregate.
//!
//! Onboarding sessions are the persistent state machines backing the
//! employee and device onboarding wizards. See the ADR for the full
//! Process Manager design.
//!
//! This store handles persistence of both the session itself and its
//! audit trail (`onboarding_session_logs`). The actual step execution
//! logic lives in the `OnboardingProcessManager` (in `timekeep-api`).

use async_trait::async_trait;

use crate::Error;
use crate::model::onboarding::{
    OnboardingSession, OnboardingSessionLog, OnboardingStatus, OnboardingType,
};

/// Persistence operations for onboarding sessions.
#[async_trait]
pub trait OnboardingSessionStore: Send + Sync {
    /// Create a new onboarding session.
    async fn create_session(&self, session: &OnboardingSession) -> Result<(), Error>;

    /// Retrieve a session by its UUID.
    async fn get_session(&self, id: &str) -> Result<Option<OnboardingSession>, Error>;

    /// Update a session's state (current_step, step_index, status, step_data, etc.).
    async fn update_session(&self, session: &OnboardingSession) -> Result<(), Error>;

    /// List sessions, optionally filtered by status and type.
    async fn list_sessions(
        &self,
        status: Option<OnboardingStatus>,
        session_type: Option<OnboardingType>,
    ) -> Result<Vec<OnboardingSession>, Error>;

    /// Cancel a session, recording the step at which it was cancelled.
    /// Runs compensating actions via the event bus.
    async fn cancel_session(&self, id: &str) -> Result<(), Error>;

    /// Find sessions that have been in_progress for longer than the given
    /// duration and are candidates for automatic cleanup.
    async fn list_abandoned_sessions(
        &self,
        older_than_secs: u64,
    ) -> Result<Vec<OnboardingSession>, Error>;

    /// Mark a session as timed_out.
    async fn time_out_session(&self, id: &str) -> Result<(), Error>;

    /// Delete a session (only allowed for terminal states).
    async fn delete_session(&self, id: &str) -> Result<(), Error>;

    /// Count sessions for dashboard metrics.
    async fn count_sessions(&self, status: Option<OnboardingStatus>) -> Result<u64, Error>;

    // ── Audit Trail ─────────────────────────────────────────────

    /// Record a step transition log entry.
    async fn record_step_log(&self, log: &OnboardingSessionLog) -> Result<(), Error>;

    /// Retrieve the full audit trail for a session (ordered chronologically).
    async fn get_step_logs(&self, session_id: &str) -> Result<Vec<OnboardingSessionLog>, Error>;
}
