//! # timekeep-dist-webhook
//!
//! Generic webhook distributor. POSTs domain events as JSON to
//! any HTTP endpoint with retry and HMAC signing.
//!
//! ## Features
//! - **Exponential backoff retry** — Configurable max retries with increasing delays
//! - **HMAC-SHA256 signing** — Receiving systems can verify event authenticity
//! - **Dead-letter logging** — Failed deliveries are logged with full context
//!
//! ## Configuration
//! ```toml
//! [[distributors.webhook]]
//! url = "https://example.com/api/attendance/webhook"
//! secret = "${WEBHOOK_SECRET}"
//! max_retries = 5
//! ```

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use timekeep_core::{Error, events::DomainEvent, traits::distributor::Distributor};

type HmacSha256 = Hmac<Sha256>;

/// Default maximum retry attempts before declaring a dead letter.
const DEFAULT_MAX_RETRIES: u32 = 5;

/// Base delay in milliseconds for exponential backoff.
const DEFAULT_BASE_DELAY_MS: u64 = 1000;

/// A webhook distributor that POSTs events to an HTTP endpoint
/// with retry and optional HMAC signing.
pub struct WebhookDistributor {
    url: String,
    client: reqwest::Client,
    /// Shared secret for HMAC-SHA256 request signing.
    /// When set, an `X-Signature` header is added to each request.
    secret: Option<String>,
    /// Maximum number of retry attempts on transient failures.
    max_retries: u32,
    /// Base delay in milliseconds for exponential backoff.
    base_delay_ms: u64,
}

impl WebhookDistributor {
    /// Create a new webhook distributor with defaults (no secret, 5 retries).
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            client: reqwest::Client::new(),
            secret: None,
            max_retries: DEFAULT_MAX_RETRIES,
            base_delay_ms: DEFAULT_BASE_DELAY_MS,
        }
    }

    /// Set a shared secret for HMAC-SHA256 request signing.
    pub fn with_secret(mut self, secret: impl Into<String>) -> Self {
        self.secret = Some(secret.into());
        self
    }

    /// Override the maximum number of retry attempts.
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Override the base delay for exponential backoff (in milliseconds).
    pub fn with_base_delay(mut self, base_delay_ms: u64) -> Self {
        self.base_delay_ms = base_delay_ms;
        self
    }

    /// Compute the HMAC-SHA256 signature for a payload body.
    fn compute_signature(&self, body: &str) -> Option<String> {
        let secret = self.secret.as_ref()?;
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(body.as_bytes());
        let result = mac.finalize();
        Some(hex::encode(result.into_bytes()))
    }

    /// Send a single delivery attempt. Returns Ok on 2xx, Err on failure.
    async fn try_deliver(&self, body: &str, event_type: &str, attempt: u32) -> Result<(), Error> {
        let mut request = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .header("X-Event-Type", event_type);

        // Add HMAC signature if secret is configured
        if let Some(sig) = self.compute_signature(body) {
            request = request.header("X-Signature", format!("sha256={sig}"));
        }

        let response = request
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| format!("webhook POST failed: {e}"))?;

        let status = response.status();
        if status.is_success() {
            tracing::debug!(
                url = %self.url,
                event_type,
                attempt,
                status = status.as_u16(),
                "webhook delivered successfully"
            );
            Ok(())
        } else {
            let status_code = status.as_u16();
            let resp_body = response.text().await.unwrap_or_default();
            Err(Error::network(format!("webhook returned HTTP {status_code}: {resp_body}")))
        }
    }
}

#[async_trait]
impl Distributor for WebhookDistributor {
    async fn on_event(&self, event: &DomainEvent) -> Result<(), Error> {
        let payload = WebhookPayload::from(event);
        let body = serde_json::to_string(&payload)
            .map_err(|e| Error::internal(format!("serialize: {e}")))?;

        let event_type = payload.event_type.clone();

        // Attempt delivery with exponential backoff
        for attempt in 0..=self.max_retries {
            match self.try_deliver(&body, &event_type, attempt).await {
                Ok(()) => return Ok(()),
                Err(e) => {
                    if attempt < self.max_retries {
                        let delay_ms = self.base_delay_ms * 2u64.pow(attempt);
                        tracing::warn!(
                            url = %self.url,
                            event_type,
                            attempt,
                            max_retries = self.max_retries,
                            delay_ms,
                            error = %e,
                            "webhook delivery failed, retrying"
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    } else {
                        tracing::error!(
                            url = %self.url,
                            event_type,
                            attempts = attempt + 1,
                            error = %e,
                            body_preview = %body.chars().take(200).collect::<String>(),
                            "webhook delivery exhausted all retries — DEAD LETTER"
                        );
                        return Err(Error::network(format!(
                            "webhook delivery failed after {} attempts: {e}",
                            attempt + 1
                        )));
                    }
                },
            }
        }

        // Unreachable due to the return in the loop, but Rust needs it
        unreachable!()
    }

    fn name(&self) -> &str {
        "webhook"
    }
}

/// JSON payload sent to webhook endpoints.
#[derive(serde::Serialize)]
struct WebhookPayload {
    event_type: String,
    timestamp: String,
    data: serde_json::Value,
}

impl From<&DomainEvent> for WebhookPayload {
    fn from(event: &DomainEvent) -> Self {
        let (event_type, data) = match event {
            DomainEvent::PunchReceived { punch } => (
                "punch_received",
                serde_json::json!({
                    "device_sn": punch.device_sn,
                    "user_pin": punch.user_pin,
                    "timestamp": punch.timestamp.as_second().to_string(),
                    "status": punch.status,
                    "verify_mode": punch.verify_mode,
                }),
            ),
            DomainEvent::DeviceOnline { device_sn, device_info } => (
                "device_online",
                serde_json::json!({
                    "device_sn": device_sn,
                    "model": device_info.model,
                }),
            ),
            DomainEvent::DeviceOffline { device_sn, last_seen } => (
                "device_offline",
                serde_json::json!({
                    "device_sn": device_sn,
                    "last_seen": last_seen.as_second().to_string(),
                }),
            ),
            DomainEvent::UserSetRequested { device_sn, user } => (
                "user_set_requested",
                serde_json::json!({
                    "device_sn": device_sn,
                    "user_pin": user.pin,
                    "user_name": user.name,
                }),
            ),
            DomainEvent::UserDeleteRequested { device_sn, user_sn } => (
                "user_delete_requested",
                serde_json::json!({
                    "device_sn": device_sn,
                    "user_sn": user_sn,
                }),
            ),
            _ => ("unknown", serde_json::json!({})),
        };

        Self {
            event_type: event_type.to_string(),
            timestamp: jiff::Timestamp::now().as_second().to_string(),
            data,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, routing::post};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicU32, Ordering};
    use timekeep_core::model::{AttendancePunch, PunchStatus, VerifyMode};

    /// Create a minimal test punch event.
    fn test_punch_event() -> DomainEvent {
        let ts = jiff::Timestamp::now();
        DomainEvent::PunchReceived {
            punch: AttendancePunch {
                id: "test-id-001".into(),
                device_sn: "TEST001".into(),
                user_pin: "12345".into(),
                timestamp: ts,
                local_time: None,
                time_offset_secs: None,
                timezone_name: None,
                status: PunchStatus::CheckIn,
                verify_mode: VerifyMode::Fingerprint,
                work_code: None,
                sub_status: None,
                employee_name: None,
                device_label: None,
                is_anomaly: false,
                anomaly_type: None,
                raw_data: None,
            },
        }
    }

    // ─── HMAC tests ─────────────────────────────────────────────────

    #[test]
    fn test_compute_signature_with_secret() {
        let dist = WebhookDistributor::new("http://localhost:9999").with_secret("my-secret-key");
        let sig = dist.compute_signature("hello world");
        assert!(sig.is_some());
        let sig = sig.unwrap();
        // HMAC-SHA256 hex output is always 64 chars
        assert_eq!(sig.len(), 64);
        // Should be deterministic
        let sig2 = dist.compute_signature("hello world").unwrap();
        assert_eq!(sig, sig2);
    }

    #[test]
    fn test_compute_signature_different_inputs() {
        let dist = WebhookDistributor::new("http://localhost:9999").with_secret("key");
        let sig1 = dist.compute_signature("payload-a").unwrap();
        let sig2 = dist.compute_signature("payload-b").unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn test_compute_signature_different_secrets() {
        let dist1 = WebhookDistributor::new("http://localhost:9999").with_secret("key-a");
        let dist2 = WebhookDistributor::new("http://localhost:9999").with_secret("key-b");
        let sig1 = dist1.compute_signature("same payload").unwrap();
        let sig2 = dist2.compute_signature("same payload").unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn test_no_signature_without_secret() {
        let dist = WebhookDistributor::new("http://localhost:9999");
        assert!(dist.compute_signature("test").is_none());
    }

    // ─── Retry / integration tests ──────────────────────────────────

    /// Tests that the webhook delivers successfully on first attempt.
    #[tokio::test]
    async fn test_deliver_success_first_attempt() {
        // Spawn a simple HTTP server that always returns 200
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let app = Router::new().route("/webhook", post(|| async { "OK" }));

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        // Give server a moment to start
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let url = format!("http://{addr}/webhook");
        let dist = WebhookDistributor::new(&url).with_max_retries(3).with_base_delay(10);

        let result = dist.on_event(&test_punch_event()).await;
        assert!(result.is_ok(), "expected success, got: {result:?}");
    }

    /// Tests that the webhook retries and eventually succeeds.
    #[tokio::test]
    async fn test_retry_then_succeed() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Server that fails twice, then succeeds
        let fail_count = Arc::new(AtomicU32::new(0));
        let fc = fail_count.clone();

        let app = Router::new().route(
            "/webhook",
            post(move || {
                let count = fc.fetch_add(1, Ordering::SeqCst);
                async move {
                    if count < 2 {
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR
                    } else {
                        axum::http::StatusCode::OK
                    }
                }
            }),
        );

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let url = format!("http://{addr}/webhook");
        let dist = WebhookDistributor::new(&url).with_max_retries(3).with_base_delay(10); // 10ms base for fast tests

        let result = dist.on_event(&test_punch_event()).await;
        assert!(result.is_ok(), "expected success after retries, got: {result:?}");
        assert_eq!(
            fail_count.load(Ordering::SeqCst),
            3,
            "expected 3 attempts (2 fails + 1 success)"
        );
    }

    /// Tests that the webhook exhausts all retries and returns an error.
    #[tokio::test]
    async fn test_exhaust_all_retries() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Server that always fails
        let app = Router::new()
            .route("/webhook", post(|| async { axum::http::StatusCode::SERVICE_UNAVAILABLE }));

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let url = format!("http://{addr}/webhook");
        let dist = WebhookDistributor::new(&url)
            .with_max_retries(2) // 3 attempts total (0, 1, 2)
            .with_base_delay(10);

        let result = dist.on_event(&test_punch_event()).await;
        assert!(result.is_err(), "expected failure after all retries");
        let err = result.unwrap_err();
        assert!(
            err.to_string().contains("3 attempts"),
            "error should mention attempt count, got: {err}"
        );
    }

    /// Tests that the X-Signature header is present when a secret is configured.
    #[tokio::test]
    async fn test_hmac_header_present() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Server that captures the signature header
        let received_sig = Arc::new(std::sync::Mutex::new(None::<String>));
        let rs = received_sig.clone();

        let app = Router::new().route(
            "/webhook",
            post(move |headers: axum::http::HeaderMap| {
                let sig =
                    headers.get("X-Signature").and_then(|v| v.to_str().ok()).map(String::from);
                *rs.lock().unwrap() = sig;
                async { "OK" }
            }),
        );

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let url = format!("http://{addr}/webhook");
        let dist = WebhookDistributor::new(&url).with_secret("test-secret").with_max_retries(1);

        let result = dist.on_event(&test_punch_event()).await;
        assert!(result.is_ok());

        let sig = received_sig.lock().unwrap();
        assert!(sig.is_some(), "X-Signature header should be present");
        let sig = sig.as_ref().unwrap();
        assert!(sig.starts_with("sha256="), "signature should start with sha256=, got: {sig}");
        assert_eq!(sig.len(), 7 + 64, "sha256= prefix + 64 hex chars");
    }

    /// Tests that no X-Signature header is sent when secret is not configured.
    #[tokio::test]
    async fn test_no_hmac_header_without_secret() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let received_sig = Arc::new(std::sync::Mutex::new(None::<String>));
        let rs = received_sig.clone();

        let app = Router::new().route(
            "/webhook",
            post(move |headers: axum::http::HeaderMap| {
                let sig =
                    headers.get("X-Signature").and_then(|v| v.to_str().ok()).map(String::from);
                *rs.lock().unwrap() = sig;
                async { "OK" }
            }),
        );

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let url = format!("http://{addr}/webhook");
        let dist = WebhookDistributor::new(&url).with_max_retries(1);
        // No .with_secret()

        let result = dist.on_event(&test_punch_event()).await;
        assert!(result.is_ok());
        assert!(received_sig.lock().unwrap().is_none(), "no signature header expected");
    }

    // ─── Builder pattern tests ──────────────────────────────────────

    #[test]
    fn test_builder_defaults() {
        let dist = WebhookDistributor::new("http://localhost:9999");
        assert_eq!(dist.url, "http://localhost:9999");
        assert!(dist.secret.is_none());
        assert_eq!(dist.max_retries, 5);
        assert_eq!(dist.base_delay_ms, 1000);
        assert_eq!(dist.name(), "webhook");
    }

    #[test]
    fn test_builder_custom() {
        let dist = WebhookDistributor::new("http://example.com/webhook")
            .with_secret("s3cret!")
            .with_max_retries(3)
            .with_base_delay(500);

        assert_eq!(dist.url, "http://example.com/webhook");
        assert_eq!(dist.secret, Some("s3cret!".to_string()));
        assert_eq!(dist.max_retries, 3);
        assert_eq!(dist.base_delay_ms, 500);
    }
}
