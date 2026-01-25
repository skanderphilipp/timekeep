//! OpenTelemetry distributed tracing for the attendance pipeline.
//!
//! ## Design
//!
//! - **Disabled by default.** Only activates when `TIMEKEEP_OTEL_ENABLED=true`.
//! - Spans and metrics are no-ops when disabled — zero overhead.
//! - Uses OTLP/HTTP (not gRPC) for simplicity — no protobuf dependency.
//! - Metrics are exposed as standard OTel counters so any OTLP-compatible
//!   backend (Jaeger, Grafana Tempo, Honeycomb) can ingest them.
//!
//! ## Configuration
//!
//! ```bash
//! export TIMEKEEP_OTEL_ENABLED=true
//! export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
//! cargo run
//! ```
//!
//! ## Metrics exported
//!
//! | Counter | Labels | Description |
//! |---|---|---|
//! | `attendance_punches_received_total` | — | Punches entering the pipeline |
//! | `attendance_punches_deduplicated_total` | — | Punches filtered as duplicates |
//! | `attendance_punches_distributed_total` | `distributor` | Punches forwarded to each distributor |

use std::sync::OnceLock;

use opentelemetry::KeyValue;
use opentelemetry::global;
use opentelemetry::metrics::Counter;
use opentelemetry::trace::TracerProvider as _;
use opentelemetry_sdk::Resource;
use opentelemetry_sdk::metrics::SdkMeterProvider;
use opentelemetry_sdk::trace::SdkTracerProvider;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetryLayer;
use tracing_subscriber::Layer as _;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

/// Holds the pre-configured metrics counters so every call site can increment
/// without re-resolving the meter on the hot path.
static METRICS: OnceLock<AttendanceMetrics> = OnceLock::new();

/// Kept alive for the program lifetime so the batch / periodic exporters can
/// flush pending data before the process exits.
#[allow(dead_code)]
static TRACER_PROVIDER: OnceLock<SdkTracerProvider> = OnceLock::new();

struct AttendanceMetrics {
    punches_received: Counter<u64>,
    punches_deduplicated: Counter<u64>,
    punches_distributed: Counter<u64>,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Initialise the tracing subscriber (both `fmt` and optional OTLP layer) and
/// the OTLP meter provider for metrics export.
///
/// Must be called **early** in `main()`, before any `tracing` macros are used.
/// The subscriber is installed via `set_global_default` — subsequent calls to
/// `tracing_subscriber::fmt().init()` elsewhere will panic.
///
/// When `TIMEKEEP_OTEL_ENABLED` is not `"true"` or `"1"`, only the `fmt`
/// layer is installed — no OTLP connection is attempted.
///
/// # Panics
///
/// Panics if the OTLP exporter cannot be built — this is intentional so the
/// operator gets a clear start-up failure rather than silently missing traces.
pub fn init_telemetry() {
    let enabled =
        std::env::var("TIMEKEEP_OTEL_ENABLED").map(|v| v == "true" || v == "1").unwrap_or(false);

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "attendance=info".into());

    let fmt_layer = tracing_subscriber::fmt::layer().with_filter(filter);

    if enabled {
        let resource = Resource::builder().with_service_name("timekeep").build();

        // ── Tracer provider ────────────────────────────────────────────
        let span_exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .build()
            .expect("failed to build OTLP span exporter (check OTEL_EXPORTER_OTLP_ENDPOINT)");

        let tracer_provider = SdkTracerProvider::builder()
            .with_batch_exporter(span_exporter)
            .with_resource(resource.clone())
            .build();

        let tracer = tracer_provider.tracer("timekeep");

        // ── Meter provider ─────────────────────────────────────────────
        let metric_exporter = opentelemetry_otlp::MetricExporter::builder()
            .with_http()
            .build()
            .expect("failed to build OTLP metric exporter (check OTEL_EXPORTER_OTLP_ENDPOINT)");

        let meter_provider = SdkMeterProvider::builder()
            .with_periodic_exporter(metric_exporter)
            .with_resource(resource)
            .build();

        global::set_meter_provider(meter_provider);

        // ── Pre-resolve counters ───────────────────────────────────────
        let meter = global::meter("timekeep");
        let metrics = AttendanceMetrics {
            punches_received: meter
                .u64_counter("attendance_punches_received_total")
                .with_description("Total number of attendance punches received")
                .build(),
            punches_deduplicated: meter
                .u64_counter("attendance_punches_deduplicated_total")
                .with_description("Total number of punches filtered as duplicates")
                .build(),
            punches_distributed: meter
                .u64_counter("attendance_punches_distributed_total")
                .with_description("Total number of punches forwarded to distributors")
                .build(),
        };
        METRICS.set(metrics).ok();

        // Keep the provider alive so the batch exporter can flush.
        TRACER_PROVIDER.set(tracer_provider).ok();

        let otel_layer = OpenTelemetryLayer::new(tracer);

        tracing_subscriber::registry().with(fmt_layer).with(otel_layer).init();

        tracing::info!("OpenTelemetry tracing enabled (OTLP/HTTP)");
    } else {
        tracing_subscriber::registry().with(fmt_layer).init();
    }
}

/// Returns `true` when OpenTelemetry tracing is active.
pub fn is_enabled() -> bool {
    METRICS.get().is_some()
}

/// Create the root span for a single-punch pipeline invocation.
///
/// Returns [`Span::none()`] when OTEL is disabled so callers don't need
/// to branch — entering a none span is a cheap no-op.
#[must_use]
pub fn punch_span(device_sn: &str, user_pin: &str) -> Span {
    if !is_enabled() {
        return Span::none();
    }
    tracing::info_span!(
        "punch_processing",
        device_sn = %device_sn,
        user_pin = %user_pin,
        service.name = "timekeep",
    )
}

/// Create an optional span for an individual pipeline stage.
///
/// `stage` must be one of: `"normalize"`, `"dedup"`, `"enrich"`,
/// `"store"`, `"distribute"`.  Returns [`Span::none()`] for any other
/// value or when OTEL is disabled.
pub fn stage_span(stage: &'static str) -> Span {
    if !is_enabled() {
        return Span::none();
    }
    match stage {
        "normalize" => tracing::info_span!("normalize"),
        "dedup" => tracing::info_span!("dedup"),
        "enrich" => tracing::info_span!("enrich"),
        "store" => tracing::info_span!("store"),
        "distribute" => tracing::info_span!("distribute"),
        _ => Span::none(),
    }
}

// ---------------------------------------------------------------------------
// Metric helpers — zero-cost when OTEL is disabled
// ---------------------------------------------------------------------------

/// Increment the `attendance_punches_received_total` counter.
#[inline]
pub fn record_punch_received() {
    if let Some(m) = METRICS.get() {
        m.punches_received.add(1, &[]);
    }
}

/// Increment the `attendance_punches_deduplicated_total` counter.
#[inline]
pub fn record_punch_deduplicated() {
    if let Some(m) = METRICS.get() {
        m.punches_deduplicated.add(1, &[]);
    }
}

/// Increment the `attendance_punches_distributed_total` counter with
/// a `distributor` label identifying the downstream system.
#[inline]
pub fn record_punch_distributed(distributor: &str) {
    if let Some(m) = METRICS.get() {
        m.punches_distributed.add(1, &[KeyValue::new("distributor", distributor.to_owned())]);
    }
}
