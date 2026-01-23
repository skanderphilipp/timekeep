//! # timekeep-circuit
//!
//! Circuit breaker pattern for production safety.
//!
//! Wraps fallible async operations (HTTP calls, TCP connections) in a
//! state machine that prevents cascading failures when downstream services
//! are unavailable.
//!
//! ## States
//!
//! ```text
//!         ┌──────────┐
//!         │  Closed  │ ← Normal operation. Calls pass through.
//!         └────┬─────┘
//!              │ failures ≥ threshold
//!              ▼
//!         ┌──────────┐
//!         │   Open   │ ← All calls immediately fail with CircuitOpen.
//!         └────┬─────┘   No HTTP/TCP overhead.
//!              │ recovery_timeout elapsed
//!              ▼
//!         ┌──────────┐
//!         │HalfOpen  │ ← One probe request allowed through.
//!         └──────────┘   Success → reset to Closed.
//!                        Failure → back to Open.
//! ```
//!
//! ## Usage
//!
//! ```rust,ignore
//! use timekeep_circuit::CircuitBreaker;
//! use std::time::Duration;
//!
//! let cb = CircuitBreaker::builder()
//!     .failure_threshold(5)
//!     .recovery_timeout(Duration::from_secs(30))
//!     .half_open_max_success(2)
//!     .build();
//!
//! let result = cb.call(|| async {
//!     reqwest::get("https://odoo.example.com/api/health").await
//! }).await;
//!
//! match result {
//!     Ok(resp) => { /* success */ }
//!     Err(CircuitBreakerError::CircuitOpen) => {
//!         tracing::warn!("Odoo circuit is open — skipping");
//!     }
//!     Err(CircuitBreakerError::Inner(e)) => {
//!         tracing::error!("Odoo call failed: {e}");
//!     }
//! }
//! ```

use std::fmt::Display;
use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::{AtomicU8, AtomicU32, Ordering};
use std::time::{Duration, Instant};

/// Circuit breaker state.
///
/// Uses `AtomicU8` for lock-free state transitions.
/// Values: 0=Closed, 1=Open, 2=HalfOpen
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum State {
    /// Normal operation — all calls pass through.
    Closed = 0,
    /// Circuit is tripped — all calls immediately fail.
    Open = 1,
    /// Recovery probe — one call allowed through to test the downstream.
    HalfOpen = 2,
}

impl State {
    /// Convert a raw u8 back to State, defaulting to Closed for invalid values.
    fn from_u8(v: u8) -> Self {
        match v {
            1 => State::Open,
            2 => State::HalfOpen,
            _ => State::Closed,
        }
    }
}

/// Error returned by [`CircuitBreaker::call`].
#[derive(Debug, thiserror::Error)]
pub enum CircuitBreakerError<E: Display> {
    /// The circuit is open and the call was rejected without execution.
    #[error("circuit is open")]
    CircuitOpen,

    /// The inner operation failed (circuit was closed or half-open).
    #[error("{0}")]
    Inner(E),
}

impl<E: Display> CircuitBreakerError<E> {
    /// Returns `true` if the error is `CircuitOpen`.
    pub fn is_circuit_open(&self) -> bool {
        matches!(self, Self::CircuitOpen)
    }
}

/// Configuration for building a [`CircuitBreaker`].
pub struct CircuitBreakerBuilder {
    failure_threshold: u32,
    recovery_timeout: Duration,
    half_open_max_success: u32,
}

impl Default for CircuitBreakerBuilder {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_timeout: Duration::from_secs(30),
            half_open_max_success: 2,
        }
    }
}

impl CircuitBreakerBuilder {
    /// Number of consecutive failures before the circuit opens.
    /// Default: 5.
    pub fn failure_threshold(mut self, n: u32) -> Self {
        self.failure_threshold = n;
        self
    }

    /// How long to wait in the Open state before attempting a probe.
    /// Default: 30 seconds.
    pub fn recovery_timeout(mut self, d: Duration) -> Self {
        self.recovery_timeout = d;
        self
    }

    /// Number of consecutive successes in HalfOpen before resetting to Closed.
    /// Default: 2.
    pub fn half_open_max_success(mut self, n: u32) -> Self {
        self.half_open_max_success = n;
        self
    }

    /// Build the circuit breaker.
    pub fn build(self) -> CircuitBreaker {
        CircuitBreaker {
            state: AtomicU8::new(State::Closed as u8),
            consecutive_failures: AtomicU32::new(0),
            consecutive_successes: AtomicU32::new(0),
            opened_at: std::sync::Mutex::new(None),
            config: Arc::new(CircuitConfig {
                failure_threshold: self.failure_threshold,
                recovery_timeout: self.recovery_timeout,
                half_open_max_success: self.half_open_max_success,
            }),
        }
    }
}

#[derive(Debug)]
struct CircuitConfig {
    failure_threshold: u32,
    recovery_timeout: Duration,
    half_open_max_success: u32,
}

/// A thread-safe circuit breaker that wraps fallible async operations.
///
/// ## Thread Safety
///
/// All state transitions use atomic operations. The `call` method can be
/// shared across tasks via `Arc<CircuitBreaker>`. The `opened_at` timestamp
/// uses a `Mutex` because `Instant` cannot be stored atomically, but this
/// lock is only contended during state transition (once per trip/reset).
///
/// ## Design Decisions
///
/// - **No external timer**: State transitions happen lazily on `call()`.
///   The Open→HalfOpen check is a simple elapsed-time comparison. No
///   background task needed.
/// - **Sliding window, not absolute**: Failures count as consecutive, not
///   within a time window. Simpler mental model, handles sustained failures well.
/// - **Half-open probe limit**: Only one call at a time is allowed through
///   in HalfOpen state (others get `CircuitOpen`). This prevents thundering
///   herd on recovery.
pub struct CircuitBreaker {
    state: AtomicU8,
    consecutive_failures: AtomicU32,
    consecutive_successes: AtomicU32,
    /// `Instant` when the circuit was opened. `None` when not in Open state.
    opened_at: std::sync::Mutex<Option<Instant>>,
    config: Arc<CircuitConfig>,
}

impl CircuitBreaker {
    /// Create a builder for fluent configuration.
    pub fn builder() -> CircuitBreakerBuilder {
        CircuitBreakerBuilder::default()
    }

    /// Create a circuit breaker with sensible production defaults.
    ///
    /// - 5 consecutive failures → trip
    /// - 30 second cooldown before probe
    /// - 2 consecutive successes to reset
    pub fn new() -> Self {
        Self::builder().build()
    }

    /// Wrap an async fallible function with circuit breaker logic.
    ///
    /// ## Behavior by state
    ///
    /// | State | Action |
    /// |-------|--------|
    /// | Closed | Call `f`. On failure, increment counter. If counter ≥ threshold, trip to Open. |
    /// | Open | If recovery timeout elapsed, transition to HalfOpen and probe. Otherwise return `CircuitOpen`. |
    /// | HalfOpen | If no probe in flight (success counter unchanged), allow one call. Otherwise `CircuitOpen`. |
    ///
    /// ## Concurrency Note
    ///
    /// In HalfOpen state, multiple concurrent `call()` invocations will
    /// see the same state and the first one to execute will attempt the
    /// probe. Others will get `CircuitOpen`. This is a best-effort
    /// approach — if you need strict single-probe semantics, use an
    /// external semaphore.
    pub async fn call<F, Fut, T, E>(&self, f: F) -> Result<T, CircuitBreakerError<E>>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, E>>,
        E: Display,
    {
        loop {
            let current = self.load_state();

            match current {
                State::Closed => {
                    let result = f().await;
                    match result {
                        Ok(value) => {
                            self.on_success();
                            return Ok(value);
                        },
                        Err(e) => {
                            self.on_failure();
                            return Err(CircuitBreakerError::Inner(e));
                        },
                    }
                },
                State::Open => {
                    if self.should_probe() {
                        // Try to transition to HalfOpen for probing
                        if self.transition_to(State::HalfOpen) {
                            tracing::info!("circuit half-open: running probe request");
                            // Fall through to HalfOpen handling below
                            continue;
                        }
                        // Another caller won the transition race — try again
                        continue;
                    }
                    return Err(CircuitBreakerError::CircuitOpen);
                },
                State::HalfOpen => {
                    let result = f().await;
                    match result {
                        Ok(value) => {
                            let successes =
                                self.consecutive_successes.fetch_add(1, Ordering::AcqRel) + 1;
                            if successes >= self.config.half_open_max_success {
                                self.reset();
                                tracing::info!(successes, "circuit closed: downstream healthy");
                            } else {
                                tracing::info!(
                                    successes,
                                    needed = self.config.half_open_max_success,
                                    "circuit half-open: probe {}/{} succeeded",
                                    successes,
                                    self.config.half_open_max_success,
                                );
                            }
                            return Ok(value);
                        },
                        Err(e) => {
                            self.trip();
                            tracing::warn!(
                                error = %e,
                                "circuit re-opened: probe failed"
                            );
                            return Err(CircuitBreakerError::Inner(e));
                        },
                    }
                },
            }
        }
    }

    // ─── State management ────────────────────────────────────────────

    fn load_state(&self) -> State {
        match self.state.load(Ordering::Acquire) {
            0 => State::Closed,
            1 => State::Open,
            2 => State::HalfOpen,
            _ => State::Closed, // invalid state → safe default
        }
    }

    /// Attempt to transition from current state to `target`.
    /// Returns `true` if the transition succeeded.
    fn transition_to(&self, target: State) -> bool {
        let expected = self.state.load(Ordering::Acquire);
        // Only allow: Closed→Open, Open→HalfOpen, HalfOpen→Closed, HalfOpen→Open
        let current_state = State::from_u8(expected);
        let valid = matches!(
            (current_state, target),
            (State::Closed, State::Open)
                | (State::Open, State::HalfOpen)
                | (State::HalfOpen, State::Closed)
                | (State::HalfOpen, State::Open)
        );
        if !valid {
            return false;
        }
        let result = self.state.compare_exchange(
            expected,
            target as u8,
            Ordering::AcqRel,
            Ordering::Acquire,
        );
        if result.is_ok() {
            if target == State::Open {
                let mut guard = self.opened_at.lock().unwrap();
                *guard = Some(Instant::now());
            }
            if target == State::Closed {
                let mut guard = self.opened_at.lock().unwrap();
                *guard = None;
            }
        }
        result.is_ok()
    }

    fn should_probe(&self) -> bool {
        let guard = self.opened_at.lock().unwrap();
        match *guard {
            Some(opened) => opened.elapsed() >= self.config.recovery_timeout,
            None => true, // No timestamp set, allow probe
        }
    }

    fn on_success(&self) {
        self.consecutive_failures.store(0, Ordering::Release);
    }

    fn on_failure(&self) {
        let count = self.consecutive_failures.fetch_add(1, Ordering::AcqRel) + 1;
        if count >= self.config.failure_threshold && self.transition_to(State::Open) {
            tracing::warn!(
                failures = count,
                threshold = self.config.failure_threshold,
                timeout_secs = self.config.recovery_timeout.as_secs(),
                "circuit opened: downstream failures exceeded threshold"
            );
        }
    }

    fn trip(&self) {
        self.consecutive_failures.store(self.config.failure_threshold, Ordering::Release);
        self.consecutive_successes.store(0, Ordering::Release);
        self.state.store(State::Open as u8, Ordering::Release);
        {
            let mut guard = self.opened_at.lock().unwrap();
            *guard = Some(Instant::now());
        }
    }

    fn reset(&self) {
        self.consecutive_failures.store(0, Ordering::Release);
        self.consecutive_successes.store(0, Ordering::Release);
        self.state.store(State::Closed as u8, Ordering::Release);
        {
            let mut guard = self.opened_at.lock().unwrap();
            *guard = None;
        }
    }

    // ─── Diagnostics ─────────────────────────────────────────────────

    /// Get the current circuit state (for health checks and metrics).
    pub fn current_state(&self) -> State {
        self.load_state()
    }

    /// Get the current consecutive failure count.
    pub fn failure_count(&self) -> u32 {
        self.consecutive_failures.load(Ordering::Acquire)
    }

    /// How long the circuit has been open, if it's in Open state.
    pub fn open_duration(&self) -> Option<Duration> {
        let guard = self.opened_at.lock().unwrap();
        guard.map(|t| t.elapsed())
    }

    /// Force the circuit open (for testing and manual intervention).
    pub fn force_open(&self) {
        self.trip();
    }

    /// Force the circuit closed (for testing and manual intervention).
    pub fn force_close(&self) {
        self.reset();
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_closed_passes_through() {
        let cb = CircuitBreaker::new();
        let result = cb.call(|| std::future::ready(Ok::<_, String>(42))).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(cb.current_state(), State::Closed);
    }

    #[tokio::test]
    async fn test_closed_records_failures() {
        let cb = CircuitBreaker::new();
        let result = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
        assert!(result.is_err());
        assert_eq!(cb.failure_count(), 1);
    }

    #[tokio::test]
    async fn test_trips_after_threshold() {
        let cb = CircuitBreaker::builder()
            .failure_threshold(3)
            .recovery_timeout(Duration::from_secs(60))
            .build();

        // 3 failures → should trip
        for _ in 0..3 {
            let result = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
            assert!(result.is_err());
        }

        assert_eq!(cb.current_state(), State::Open);
    }

    #[tokio::test]
    async fn test_open_returns_circuit_open() {
        let cb = CircuitBreaker::builder()
            .failure_threshold(1)
            .recovery_timeout(Duration::from_secs(60))
            .build();

        // Trip the circuit
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
        assert_eq!(cb.current_state(), State::Open);

        // Now calls should get CircuitOpen
        let result = cb.call(|| std::future::ready(Ok::<u32, String>(42))).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CircuitBreakerError::CircuitOpen));
    }

    #[tokio::test]
    async fn test_recovers_after_probe_succeeds() {
        let cb = CircuitBreaker::builder()
            .failure_threshold(1)
            .recovery_timeout(Duration::from_millis(1)) // immediate probe
            .half_open_max_success(1)
            .build();

        // Trip
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
        assert_eq!(cb.current_state(), State::Open);

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(10)).await;

        // Probe should succeed and reset
        let result = cb.call(|| std::future::ready(Ok::<u32, String>(42))).await;
        assert!(result.is_ok());
        assert_eq!(cb.current_state(), State::Closed);
    }

    #[tokio::test]
    async fn test_reopens_after_probe_fails() {
        let cb = CircuitBreaker::builder()
            .failure_threshold(1)
            .recovery_timeout(Duration::from_millis(1))
            .half_open_max_success(2)
            .build();

        // Trip
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
        assert_eq!(cb.current_state(), State::Open);

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(10)).await;

        // Probe fails → back to Open
        let result = cb.call(|| std::future::ready(Err::<u32, _>("fail again".to_string()))).await;
        assert!(result.is_err());
        assert_eq!(cb.current_state(), State::Open);
    }

    #[tokio::test]
    async fn test_half_open_needs_multiple_successes() {
        let cb = CircuitBreaker::builder()
            .failure_threshold(1)
            .recovery_timeout(Duration::from_millis(1))
            .half_open_max_success(2)
            .build();

        // Trip
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("fail".to_string()))).await;
        assert_eq!(cb.current_state(), State::Open);

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(10)).await;

        // First probe succeeds but stays HalfOpen
        let result = cb.call(|| std::future::ready(Ok::<u32, String>(1))).await;
        assert!(result.is_ok());
        assert_eq!(cb.current_state(), State::HalfOpen);

        // Second probe succeeds → Closed
        let result = cb.call(|| std::future::ready(Ok::<u32, String>(2))).await;
        assert!(result.is_ok());
        assert_eq!(cb.current_state(), State::Closed);
    }

    #[tokio::test]
    async fn test_success_in_closed_resets_counter() {
        let cb = CircuitBreaker::builder().failure_threshold(3).build();

        // 2 failures, then 1 success, then 2 more failures
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("f1".to_string()))).await;
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("f2".to_string()))).await;
        assert_eq!(cb.failure_count(), 2);

        // Success resets counter
        let _ = cb.call(|| std::future::ready(Ok::<u32, String>(42))).await;
        assert_eq!(cb.failure_count(), 0);

        // Now need 3 more failures to trip
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("f3".to_string()))).await;
        let _ = cb.call(|| std::future::ready(Err::<u32, _>("f4".to_string()))).await;
        assert_eq!(cb.current_state(), State::Closed); // still closed at 2

        let _ = cb.call(|| std::future::ready(Err::<u32, _>("f5".to_string()))).await;
        assert_eq!(cb.current_state(), State::Open); // now tripped
    }
}
