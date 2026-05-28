# ADR-005: Observability — Tracing-First with Prometheus Metrics

**Status:** Proposed
**Date:** 2026-07-10
**Deciders:** Alsabah Technical Team

## Context

timekeep needs observability for production debugging: structured
logging, distributed tracing across the pipeline, and metrics for monitoring
and alerting.

## Decision

**Use `tracing` as the foundation, with Prometheus metrics via `axum-prometheus`
and OpenTelemetry (OTel) for distributed tracing.**

- `tracing-subscriber` with `env-filter` for structured JSON logs (already
  implemented)
- `axum-prometheus` for HTTP-level metrics (already wired on both API routers)
- `tracing-opentelemetry` + `opentelemetry-otlp` for distributed tracing
  with correlation IDs across: event bus → pipeline stages → storage → distributors

### Span Strategy

```
Event received    span: "punch_processing" { device_sn, user_pin }
  ├── normalize   span: "normalize"
  ├── dedup       span: "dedup" { cache_hit: bool }
  ├── enrich      span: "enrich"
  ├── store       span: "store" { backend: "sqlite"|"postgres" }
  └── distribute  span: "distribute" { distributor: "odoo"|"webhook" }
```

### Metrics to Export

| Metric | Type | Labels |
|--------|------|--------|
| `punches_received_total` | Counter | device_sn, status |
| `punches_deduplicated_total` | Counter | — |
| `punches_stored_total` | Counter | backend |
| `punches_distributed_total` | Counter | distributor, status |
| `distribution_latency_seconds` | Histogram | distributor |
| `device_connected` | Gauge | device_sn |
| `dedup_cache_size` | Gauge | — |

## Rationale

- **`tracing` is already the logging crate** — adding OTel is a natural
  extension, not a replacement
- **Prometheus is the standard** for Rust service metrics — `axum-prometheus`
  already gives us HTTP metrics for free
- **OTLP export** enables sending traces to Jaeger, Grafana Tempo, or any
  OTel-compatible backend without code changes
- **Correlation IDs** let us trace a single punch from device → storage →
  Odoo across all log lines and spans

## Consequences

- Adds 3 dependencies: `tracing-opentelemetry`, `opentelemetry`, `opentelemetry-otlp`
- Requires an OTel collector or backend to receive traces (optional — can
  be disabled via env var)
- Each pipeline stage gets a span — negligible performance overhead
  (spans are no-ops when no subscriber is configured)

## Alternatives Considered

- **Prometheus only (no tracing)**: Rejected — metrics tell you *what* happened,
  traces tell you *why*. Both are needed.
- **`log` crate instead of `tracing`**: Rejected — `tracing` is already in use
  and provides structured spans that `log` cannot
- **Vendor-specific APM**: Rejected — OTel is vendor-neutral
