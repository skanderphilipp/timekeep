# Changelog

## [0.1.0] — 2026-07-10

### Added
- ZKTeco ADMS push server (real-time attendance from scanners)
- ZKTeco SDK pull mode (TCP binary protocol, background poller)
- SQLite storage with WAL mode and idempotent inserts
- PostgreSQL storage with migrations
- Webhook distributor with HMAC signatures and retry
- Odoo distributor with JSON-2 API (employee lookup, check-in/out)
- REST API with JWT auth (management) and API key auth (integration)
- Event-driven pipeline: normalize → dedup → enrich → store → distribute
- Local user table synced from device for PIN → name enrichment
- OpenTelemetry distributed tracing (disabled by default)
- Prometheus metrics endpoint
- Docker support (multi-stage build, docker-compose)
- Systemd service unit with security hardening
- CI pipeline: fmt + clippy + test + cargo-deny + docs
- 271 tests (256 unit + 15 integration)
