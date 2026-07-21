//! Rate limiter middleware for both API routers.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware::Next;
use tokio::sync::Mutex as TokioMutex;

#[derive(Clone)]
pub(crate) struct RateLimiter {
    timestamps: Arc<TokioMutex<VecDeque<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub(crate) fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            timestamps: Arc::new(TokioMutex::new(VecDeque::with_capacity(max_requests))),
            max_requests,
            window,
        }
    }
}

pub(crate) async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: axum::extract::Request,
    next: Next,
) -> Result<axum::response::Response, StatusCode> {
    // Skip rate limiting in E2E test mode — tests fire many requests
    // in rapid succession and the 100 req/60s limit is designed for
    // human-paced dashboard usage, not automated test suites.
    if std::env::var("TIMEKEEP_E2E").as_deref() == Ok("1") {
        return Ok(next.run(request).await);
    }

    let now = Instant::now();
    let mut timestamps = limiter.timestamps.lock().await;
    while timestamps.front().is_some_and(|t| now.duration_since(*t) > limiter.window) {
        timestamps.pop_front();
    }
    if timestamps.len() >= limiter.max_requests {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    timestamps.push_back(now);
    drop(timestamps);
    Ok(next.run(request).await)
}
