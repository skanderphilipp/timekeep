# API Endpoint Audit — Production Readiness Assessment

> **Date:** 2026-07-10 (updated after implementation)
> **Product:** Enterprise biometric attendance management
> **Principle:** Every endpoint serves the dashboard, an integration partner, or operations.

---

## Current Endpoints (36 total)

### Public (no auth)

| # | Method | Path | Purpose | Status |
|---|--------|------|---------|--------|
| 1 | POST | `/api/auth/login` | JWT token issuance + user profile | ✅ |
| 2 | GET | `/api/health` | Health check + DB ping | ✅ |
| 3 | GET | `/api/metrics` | Prometheus metrics | ✅ |
| 4 | GET | `/api/docs` | Swagger UI | ✅ |

### Viewer (read-only)

| # | Method | Path | Purpose | Status |
|---|--------|------|---------|--------|
| 5 | GET | `/api/devices` | Device list + search/sort/page + connection status | ✅ |
| 6 | GET | `/api/devices/{sn}` | Single device detail | ✅ |
| 7 | GET | `/api/auth/me` | Current user profile from JWT | ✅ |
| 8 | GET | `/api/dashboard/today` | Today's summary + recent events + device health + hourly breakdown | ✅ |
| 9 | GET | `/api/reports/summary` | Date-filtered punch distribution | ✅ |
| 10 | GET | `/api/punches` | Paginated punch records + search/sort/filter | ✅ |
| 11 | GET | `/api/endpoints` | Integration endpoint list | ✅ |
| 12 | GET | `/api/settings` | System settings (poll, auto-discover) | ✅ |
| 13 | GET | `/api/audit` | Audit log query | ✅ |
| 14 | PUT | `/api/users/{id}/password` | Change own password | ✅ |

### Operator

| # | Method | Path | Purpose | Status |
|---|--------|------|---------|--------|
| 15 | POST | `/api/punches/correct` | Manual punch correction | ✅ |
| 16 | POST | `/api/devices/{sn}/users` | Enroll user on device | ✅ |
| 17 | DELETE | `/api/devices/{sn}/users/{user_sn}` | Delete user from device | ✅ |
| 18 | POST | `/api/devices/{sn}/commands` | Enqueue device command | ✅ |
| 19 | GET | `/api/api-keys` | List API keys (metadata) | ✅ |

### Admin

| # | Method | Path | Purpose | Status |
|---|--------|------|---------|--------|
| 20 | POST | `/api/devices` | Add device | ✅ |
| 21 | PUT | `/api/devices/{sn}` | Update device config | ✅ |
| 22 | DELETE | `/api/devices/{sn}` | Remove device | ✅ |
| 23 | POST | `/api/api-keys` | Create API key | ✅ |
| 24 | DELETE | `/api/api-keys/{id}` | Revoke API key | ✅ |
| 25 | GET | `/api/exports/punches` | CSV/XLSX export | ✅ |
| 26 | POST | `/api/endpoints` | Create integration endpoint | ✅ |
| 27 | PUT | `/api/endpoints/{id}` | Update endpoint | ✅ |
| 28 | DELETE | `/api/endpoints/{id}` | Delete endpoint | ✅ |
| 29 | PUT | `/api/settings` | Update system settings | ✅ |
| 30 | GET | `/api/users` | List dashboard users | ✅ |
| 31 | POST | `/api/users` | Create dashboard user | ✅ |
| 32 | PUT | `/api/users/{id}` | Update user role/status | ✅ |
| 33 | DELETE | `/api/users/{id}` | Delete user (last-admin guard) | ✅ |

### Integration API (API key auth, port 3001)

| # | Method | Path | Purpose | Status |
|---|--------|------|---------|--------|
| 34 | GET | `/api/v1/health` | Integration health check | ✅ |
| 35 | GET | `/api/v1/metrics` | Prometheus metrics | ✅ |
| 36 | GET | `/api/v1/punches` | Paginated punch records | ✅ |

---

## What's Missing — Critical for Production

### 🔴 Dashboard Enrichment ✅ DONE

`GET /api/dashboard/today` now returns enriched data:

| Need | Status | Implementation |
|------|--------|----------------|
| Recent events | ✅ | Last 20 punches with names, timestamps, status |
| Device health | ✅ | Per-device: online/offline, ADMS/sdk status, last seen |
| Hourly breakdown | ✅ | Punch distribution by hour for today's chart |
| Late/early indicators | ⏳ | Requires shift/schedule system (future ADR) |

### 🔴 Dashboard User Management ✅ DONE

Database-backed user management replaces env-var only auth.
Env-var fallback retained for backward compatibility.

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/users` | ✅ List dashboard users (Admin) |
| POST | `/api/users` | ✅ Create user with role (Admin) |
| PUT | `/api/users/{id}` | ✅ Update user role/status (Admin) |
| DELETE | `/api/users/{id}` | ✅ Delete user with last-admin guard (Admin) |
| PUT | `/api/users/{id}/password` | ✅ Change own password (any authenticated, or admin for any) |

Bonus: `GET /api/auth/me` returns current user profile from JWT claims (avoids DB round-trip).

### 🟡 Missing CRUD Detail Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/devices/{sn}/users` | List users enrolled on a device |
| GET | `/api/punches/{id}` | Single punch detail |
| GET | `/api/api-keys/{id}` | Single API key detail |
| GET | `/api/endpoints/{id}` | Single endpoint detail |

### 🟡 Operational Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/devices/{sn}/sync` | Trigger manual SDK sync |
| POST | `/api/endpoints/{id}/test` | Test integration endpoint connectivity |

### 🟢 Missing for Integration Partners

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/punches` | Push punch from external system (webhook reverse) |
| GET | `/api/v1/devices` | Device list for integration partners |

---

## What's Working Well

1. **Search/Sort/Pagination** — Consistent `ListParams` across all list endpoints
2. **Connection transparency** — `connection_status`, `adms_active`, `sdk_poll_active`, `last_seen_at`
3. **Audit trail** — Every write operation captured automatically
4. **Role-based access** — Viewer/Operator/Admin with compile-time permission mapping
5. **API key management** — Create/list/revoke with scoped permissions
6. **Integration endpoints** — Generic, extensible (Odoo, webhook, SAP, Zapier)
7. **Dual-path data collection** — ADMS push + SDK poll with dedup
8. **Export** — CSV and styled XLSX downloads
9. **i18n** — English + Arabic, Lingui throughout
10. **Test coverage** — 39 integration tests + 57 unit tests
11. **Dashboard user management** — DB-backed users with role-based access, last-admin guard
12. **Dashboard enrichment** — Live device health, hourly charts, activity feed

---

## Priority Order

| Priority | What | Why | Est. |
|----------|------|-----|------|
| 🔴 1 | Dashboard enrichment | ✅ DONE — Operators can see what's happening RIGHT NOW | — |
| 🔴 2 | User management CRUD | ✅ DONE — DB-backed users with env-var fallback | — |
| 🟡 3 | Detail endpoints (GET by ID) | Frontend needs them for edit forms | 1h |
| 🟡 4 | Device user listing | Can't manage device users without seeing them | 30m |
| 🟡 5 | Endpoint test endpoint | Verify integrations work before relying on them | 45m |
| 🟢 6 | Integration push endpoint | External systems can push punches IN | 30m |
