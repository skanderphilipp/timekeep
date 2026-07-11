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
use opentelemetry::metrics::MeterProvider as _;
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
/// OTLP exporter failures are logged and the application continues without
/// distributed tracing. A misconfigured OTLP endpoint should never prevent
/// the application from starting.
pub fn init_telemetry() {
    let enabled =
        std::env::var("TIMEKEEP_OTEL_ENABLED").map(|v| v == "true" || v == "1").unwrap_or(false);

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "attendance=info".into());

    let fmt_layer = tracing_subscriber::fmt::layer().with_filter(filter);

    if enabled {
        match build_otel_providers() {
            Ok((span_exporter, meter_provider, metrics)) => {
                global::set_meter_provider(meter_provider);
                METRICS.set(metrics).ok();
                TRACER_PROVIDER
                    .set(
                        SdkTracerProvider::builder()
                            .with_batch_exporter(span_exporter)
                            .with_resource(
                                Resource::builder().with_service_name("timekeep").build(),
                            )
                            .build(),
                    )
                    .ok();

                // Re-acquire the tracer from the provider for the OTLP layer
                // (the raw exporter was consumed by the provider builder above).
                // We use a fixed tracer name here — the provider was already built.
                let otel_layer = {
                    let provider = TRACER_PROVIDER.get().expect("TRACER_PROVIDER was just set");
                    OpenTelemetryLayer::new(provider.tracer("timekeep"))
                };

                tracing_subscriber::registry().with(fmt_layer).with(otel_layer).init();
                tracing::info!("OpenTelemetry tracing enabled (OTLP/HTTP)");
            },
            Err(e) => {
                tracing::error!(
                    error = %e,
                    "failed to initialize OTLP exporters — continuing without distributed tracing"
                );
                tracing_subscriber::registry().with(fmt_layer).init();
            },
        }
    } else {
        tracing_subscriber::registry().with(fmt_layer).init();
    }
}

/// Build both the OTLP span exporter and metric exporter.
///
/// Returns the raw components on success so the caller can compose them
/// into providers. On failure, returns a descriptive error — the caller
/// degrades to fmt-only logging.
fn build_otel_providers()
-> Result<(opentelemetry_otlp::SpanExporter, SdkMeterProvider, AttendanceMetrics), String> {
    let resource = Resource::builder().with_service_name("timekeep").build();

    // ── Span exporter ──────────────────────────────────────────────
    let span_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .build()
        .map_err(|e| format!("failed to build OTLP span exporter: {e}"))?;

    // ── Metric exporter ────────────────────────────────────────────
    let metric_exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_http()
        .build()
        .map_err(|e| format!("failed to build OTLP metric exporter: {e}"))?;

    let meter_provider = SdkMeterProvider::builder()
        .with_periodic_exporter(metric_exporter)
        .with_resource(resource)
        .build();

    // ── Pre-resolve counters ───────────────────────────────────────
    // We need to set the global meter provider *before* we can create
    // meters, but we can pre-build the counters after. We'll return
    // the meter_provider for the caller to set globally.
    let meter = meter_provider.meter("timekeep");
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

    Ok((span_exporter, meter_provider, metrics))
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
