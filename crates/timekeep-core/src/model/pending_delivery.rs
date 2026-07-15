//! Pending delivery — an outbox record for punches that failed to reach
//! an external system (Odoo, webhook, etc.). The background worker picks
//! these up and retries with exponential backoff.
//!
//! ## Lifecycle
//!
//! ```text
//! Pending ──► (retry up to 6 times) ──► Delivered (deleted)
//!         \                           \──► Exhausted → dead_letter
//! ```
//!
//! ## Backoff schedule (in seconds from created_at)
//!
//! Attempt 1:  30s
//! Attempt 2:  60s
//! Attempt 3: 120s
//! Attempt 4: 300s  (5 min)
//! Attempt 5: 600s  (10 min)
//! Attempt 6: 1800s (30 min)
//!
//! After 6 failures, the record moves to `dead_letter_deliveries` for
//! manual inspection. No further automatic retries.

use jiff::Timestamp;
use uuid::Uuid;

/// The maximum number of delivery attempts before moving to dead letter.
pub const MAX_DELIVERY_ATTEMPTS: i32 = 6;

/// Backoff durations in seconds, indexed by attempt number (0-based).
pub const BACKOFF_SECONDS: [u64; 6] = [30, 60, 120, 300, 600, 1800];

/// An outbox record — a punch delivery that failed and needs retry.
#[derive(Debug, Clone)]
pub struct PendingDelivery {
    /// Unique ID for this delivery attempt (UUID v7).
    pub id: String,
    /// The integration endpoint that should receive this punch.
    pub endpoint_id: String,
    /// The punch serialized as JSON (the full domain event).
    pub event_json: String,
    /// How many delivery attempts have been made (0 = never attempted).
    pub attempt_count: i32,
    /// When the next retry attempt should happen (Unix timestamp).
    pub next_retry_at: i64,
    /// When this record was created (Unix timestamp).
    pub created_at: i64,
}

impl PendingDelivery {
    /// Create a new pending delivery with the first retry scheduled at
    /// the first backoff interval from now.
    pub fn new(endpoint_id: impl Into<String>, event_json: impl Into<String>) -> Self {
        let now = Timestamp::now();
        let next_retry = now.as_second() + BACKOFF_SECONDS[0] as i64;
        Self {
            id: Uuid::now_v7().to_string(),
            endpoint_id: endpoint_id.into(),
            event_json: event_json.into(),
            attempt_count: 0,
            next_retry_at: next_retry,
            created_at: now.as_second(),
        }
    }

    /// Schedule the next retry based on the current attempt count.
    /// Returns the new `next_retry_at` value, or None if max attempts
    /// have been reached (caller should move to dead letter).
    pub fn schedule_next_retry(&mut self) -> Option<i64> {
        let next_attempt = self.attempt_count + 1;
        let idx = next_attempt as usize;
        if idx >= BACKOFF_SECONDS.len() {
            return None;
        }
        self.attempt_count = next_attempt;
        let next = Timestamp::now().as_second() + BACKOFF_SECONDS[idx] as i64;
        self.next_retry_at = next;
        Some(next)
    }

    /// Whether this delivery has exhausted all retry attempts.
    pub fn is_exhausted(&self) -> bool {
        self.attempt_count >= MAX_DELIVERY_ATTEMPTS
    }

    /// Whether this delivery is ready for a retry attempt (next_retry_at is in the past).
    pub fn is_ready(&self) -> bool {
        self.next_retry_at <= Timestamp::now().as_second()
    }
}

/// A delivery that has exhausted all retry attempts and requires
/// manual inspection.
#[derive(Debug, Clone)]
pub struct DeadLetterDelivery {
    pub id: String,
    pub endpoint_id: String,
    pub event_json: String,
    pub attempt_count: i32,
    pub last_error: Option<String>,
    pub created_at: i64,
    pub moved_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_delivery_schedules_first_retry() {
        let delivery = PendingDelivery::new("ep-1", r#"{"dummy":"event"}"#);
        assert_eq!(delivery.attempt_count, 0);
        // First retry should be ~30s from now. Allow ±10s for test timing.
        let now = Timestamp::now().as_second();
        let expected = now + 30;
        assert!(
            (delivery.next_retry_at - expected).abs() <= 10,
            "next_retry_at {} should be ~{expected} (diff: {})",
            delivery.next_retry_at,
            delivery.next_retry_at - expected,
        );
        assert!(!delivery.is_exhausted());
        // Should be immediately ready (first retry is at 30s from creation)
        // but since the test runs fast, it's always in the near future (< now + 30)
        // Actually: next_retry_at is "now + 30". That's in the future, not past.
        // The delivery was created just now with the first retry 30s out.
        assert!(!delivery.is_ready(), "delivery shouldn't be ready immediately after creation");
    }

    #[test]
    fn test_schedule_next_retry_increments_and_updates() {
        let mut delivery = PendingDelivery {
            id: "test".into(),
            endpoint_id: "ep-1".into(),
            event_json: "{}".into(),
            attempt_count: 2,
            next_retry_at: 0,
            created_at: 0,
        };
        let result = delivery.schedule_next_retry();
        assert!(result.is_some());
        assert_eq!(delivery.attempt_count, 3);
        let now = Timestamp::now().as_second();
        // attempt_count was 2, next_attempt = 3, BACKOFF_SECONDS[3] = 300
        let expected = now + 300;
        let diff = (delivery.next_retry_at - expected).abs();
        assert!(diff <= 10, "attempt 3 should be ~300s out (diff={diff})");
    }

    #[test]
    fn test_schedule_next_retry_exhausted() {
        // After 4 attempts, next attempt is #5 (index=5, backoff=1800s) — still valid
        let mut delivery = PendingDelivery {
            id: "test".into(),
            endpoint_id: "ep-1".into(),
            event_json: "{}".into(),
            attempt_count: MAX_DELIVERY_ATTEMPTS - 2, // 4
            next_retry_at: 0,
            created_at: 0,
        };
        let result = delivery.schedule_next_retry();
        assert!(result.is_some(), "attempt 5 (index 5) should be valid");
        assert_eq!(delivery.attempt_count, MAX_DELIVERY_ATTEMPTS - 1); // 5

        // After 5 attempts, next attempt is #6 (index=6) — exhausted
        let result2 = delivery.schedule_next_retry();
        assert!(result2.is_none(), "attempt 6 should be exhausted");
    }

    #[test]
    fn test_is_exhausted_after_max_attempts() {
        let mut delivery = PendingDelivery {
            id: "test".into(),
            endpoint_id: "ep-1".into(),
            event_json: "{}".into(),
            attempt_count: 5,
            next_retry_at: 0,
            created_at: 0,
        };
        assert!(!delivery.is_exhausted());
        delivery.attempt_count = 6;
        assert!(delivery.is_exhausted());
    }

    #[test]
    fn test_is_ready() {
        let past = Timestamp::now().as_second() - 100;
        let future = Timestamp::now().as_second() + 3600;

        let ready = PendingDelivery {
            id: "ready".into(),
            endpoint_id: "ep-1".into(),
            event_json: "{}".into(),
            attempt_count: 0,
            next_retry_at: past,
            created_at: past,
        };
        assert!(ready.is_ready());

        let not_ready = PendingDelivery {
            id: "not-ready".into(),
            endpoint_id: "ep-1".into(),
            event_json: "{}".into(),
            attempt_count: 0,
            next_retry_at: future,
            created_at: 0,
        };
        assert!(!not_ready.is_ready());
    }
}
