# Roadmap — Rust Backend

> Last audited: 2026-07-10 | Updated: 2026-07-10 (hardening complete) | See `adr/` for architecture decisions

## Current State

- **290 tests** passing (↑ from 251), 0 failures, 6 ignored (optional Postgres)
- **Typed errors**: `Error` enum with 9 variants replacing all `String` errors
- **API hardening**: Rate limiting (100/min management, 300/min integration), 1MB body limit
- **Config validation**: Startup checks for JWT secret, admin creds, DB backend
- **Migration versioning**: `_schema_version` table with numbered SQL migrations
- **Domain model tests**: `timekeep-core` now has 17 tests (↑ from 0)
- **PostgreSQL tests**: 19 tests with graceful skip when DB unavailable (↑ from 0)
- **13 event types** flowing through pipeline
- **2 storage backends**: SQLite + PostgreSQL (`TIMEKEEP_DB_BACKEND`)
- **Local user table**: Synced from device at startup → enrichment resolves PINs → names
- **OTel tracing**: `TIMEKEEP_OTEL_ENABLED=true` activates OTLP export
- **31 integration tests**: SQLite (15), API (12), ADMS (4)
- **Odoo distributor**: Real JSON-2 API — passes raw PINs to Odoo for identity resolution
- **Docker**: `docker/Dockerfile` + `docker-compose.yml` + `.dockerignore`
- **cargo-deny**: `deny.toml` + CI
- **CI pipeline**: fmt + clippy + test + deny + docs
- **CHANGELOG.md**: v0.1.0 release notes
- **5 ADR documents** in `docs/adr/`

---

## 🔴 P0 — Critical (Now)

---

## 🟡 P1 — Important (Next)

### 6. Odoo Distributor (Implement JSON-2 API)

**Why:** Currently a stub — logs "would push attendance to Odoo" but does nothing.
See [ADR-003](adr/003-odoo-json2-api.md).

**Plan:**
1. Add `reqwest::Client` to `OdooDistributor` struct
2. Implement `find_employee(barcode)` → `POST /json/2/hr.employee/search`
3. Implement `find_open_attendance(employee_id)` → `POST /json/2/hr.attendance/search`
4. Implement `create_check_in(employee_id, timestamp)` → `POST /json/2/hr.attendance/create`
5. Implement `set_check_out(attendance_id, timestamp)` → `POST /json/2/hr.attendance/write`
6. Wire `on_event()` with CheckIn/CheckOut dispatch + dedup logic
7. Add employee_id LRU cache (avoid repeated API calls)
8. Tests against Odoo sandbox or wiremock

**Estimate:** 4h

### 7. Enrichment Pipeline (Implement HR Lookup)

Dashboard shows raw PINs ("145") instead of names ("Jane Doe").
Can't detect late/early/overtime without shift schedules.

**Plan:**
1. Create `HrEnrichmentProvider` trait
2. Implement Odoo-backed version (reuses Odoo distributor's employee lookup)
3. Wire into pipeline: `enrich_punch()` calls provider, adds `employee_name`, `department`
4. Fallback: if provider unavailable, punch passes through (graceful degradation)

**Estimate:** 2h

### 8. Docker Support

**Why:** Can't deploy to containerized infrastructure. No `docker-compose` for dev.

**Plan:**
- Multi-stage `Dockerfile`: build → runtime (distroless or alpine)
- `docker-compose.yml`: app + optional PostgreSQL + optional OTel collector
- Document in README

**Estimate:** 1h

---

## 🟢 P2 — Polish (Later)

### 9. Real-Time Enrollment (see `PLAN-realtime-enrollment.md`)

Test-first implementation of fingerprint enrollment + real-time event receiving.

**Estimate:** 9h (5 phases)

### 10. API Module Organization

`management/mod.rs` and `integration/mod.rs` are empty files. All handlers (350+ lines)
live in `lib.rs`. Extract handlers into their module files.

**Estimate:** 30 min

### 11. Health Check Depth

`/api/health` returns 200 but doesn't verify DB connectivity or device status.
Add: DB ping, device registry check, engine status.

**Estimate:** 30 min

### 12. cargo-deny

Add `deny.toml` + CI step for license compliance and security advisory checks.
See reference configs: polars, bevy, meilisearch.

**Estimate:** 30 min

---

## 💎 P3 — Differentiating Features

| Feature | Why |
|---------|-----|
| Multi-vendor support (Suprema, Anviz) | No open-source tool does this |
| Scanner auto-discovery (UDP broadcast) | Plug in scanner → dashboard detects it |
| Anomaly detection | Buddy punching, impossible sequences |
| BioTime migration | One-click import from MySQL |
| IP camera snapshot on punch | Audit trail with camera frame |

---

## Crate Test Coverage

| Crate | Tests | Status |
|-------|-------|--------|
| `timekeep-zkteco` | 150 | ✅ Extensive |
| `timekeep-storage-sqlite` | 19 | ✅ Good |
| `timekeep-engine` | 18 | ✅ Good |
| `timekeep-api` | 11 | ⚠️ Needs integration tests |
| `timekeep-dist-webhook` | 11 | ✅ Good |
| `timekeep-core` | 0 | ⚠️ Model tests needed |
| `timekeep-storage-postgres` | 0 | 🔴 Critical gap |
| `timekeep-dist-odoo` | 0 | 🔴 Will need tests after implementation |
| `timekeep` | 0 | ⚠️ Needs e2e tests |
