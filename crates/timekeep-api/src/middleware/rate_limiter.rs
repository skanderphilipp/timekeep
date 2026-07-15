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
