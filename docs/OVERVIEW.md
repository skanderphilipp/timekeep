# Timekeep — System Overview & Design Reference

> **Last updated:** 2026-07-10
> **Purpose:** Central reference for architecture, capabilities, and feature ideation.
> **Project:** Alsabah ZKTeco Scanner Integration
> **Codebase:** `timekeep/` (Rust workspace, edition 2024)

---

## Table of Contents

1. [System Responsibilities](#1-system-responsibilities)
2. [What We Get From ZKTeco Scanners](#2-what-we-get-from-zkteco-scanners)
3. [Domain Event Catalog](#3-domain-event-catalog)
4. [Architecture Decision: Core + Providers](#4-architecture-decision-core--providers)
5. [Feature Matrix — Current vs. Planned vs. Visionary](#5-feature-matrix--current-vs-planned-vs-visionary)
6. [Integration Points — What Connects Where](#6-integration-points--what-connects-where)
7. [Reference Project Analysis](#7-reference-project-analysis)
8. [Impressive & Differentiating Features](#8-impressive--differentiating-features)
9. [Open Questions & Future Directions](#9-open-questions--future-directions)

---

## 1. System Responsibilities

Timekeep is a **device data collection and attendance management platform**. It sits between biometric scanners and HR systems.

### Core Responsibilities

| # | Responsibility | Description |
|---|---------------|-------------|
| R1 | **Device Communication** | Connect to biometric scanners via their native protocols (ZKTeco ADMS push, ZKTeco binary SDK, future: Suprema, Anviz). Normalize all vendor-specific data into a common domain model. |
| R2 | **Event-Driven Processing** | Every scanner event (punch, device online, device offline, storage warning) flows through an in-process event bus. Handlers react independently — storage, webhooks, notifications. |
| R3 | **Reliable Persistence** | Store attendance records with deduplication. Never lose a punch. Support SQLite (embedded) and PostgreSQL (server-grade). |
| R4 | **External Distribution** | Deliver events to HR systems via generic webhooks (any consumer) or vendor-specific adapters (Odoo XML-RPC). The library itself has zero knowledge of any specific HR system. |
| R5 | **Device Lifecycle Management** | Register, configure, monitor, and decommission scanners from a web dashboard. Track online/offline status, storage capacity, firmware version. |
| R6 | **Two APIs** | Management API (port 3000) for humans with session auth. Integration API (port 3001) for machines with API key auth. Different audiences, different security models. |

### Explicit Non-Responsibilities

- **Not an HR system.** Does not manage employees, departments, leave requests, or payroll.
- **Not an access control system.** Door relays, alarm zones, anti-passback are a separate bounded context. Reuses the same device driver but different domain logic.
- **Not a cloud service.** Self-hosted. Runs on-premise. No vendor lock-in. No subscription.

---

## 2. What We Get From ZKTeco Scanners

Based on live data extracted from the OFFICE scanner (Biopro SA40, serial CQZ7232960836, firmware Ver 6.60) on 2026-07-10.

### Device Capabilities

| Capability | Protocol | Status | Data Pulled |
|-----------|----------|--------|-------------|
| **Device Identity** | SDK + ADMS | ✅ Working | Model, serial, firmware, platform, MAC, IP, network config |
| **Device Time** | SDK | ✅ Working | Device clock (offset from UTC tracked) |
| **User List** | SDK + ADMS | ✅ Working | 116 users: PIN, name, privilege level, card number, fingerprint count |
| **Attendance Records** | SDK + ADMS | ✅ Working | 11,489 punches: user PIN, timestamp, check-in/out status, verification method |
| **Fingerprint Templates** | SDK only | ⚠️ Extractable | 402 templates, ZKFP binary format, vendor-specific blob |
| **Face Templates** | SDK only | ⚠️ Extractable | 0 on this device (no face module installed) |
| **Operation Logs** | ADMS push | ⚠️ Available | Admin actions, enrollments, deletions, reboots |
| **Real-Time Events** | SDK | ⚠️ Available | Live push of attendance, verification, alarms during enrollment |
| **Device Config** | SDK + ADMS | ⚠️ Available | ~81 key-value parameters: network, timezone, Wiegand, biometric thresholds |
| **User CRUD** | SDK commands | ⚠️ Available | Create/update/delete users on device, set passwords, enroll fingerprints |

### Data Formats

**Attendance Record** (40 bytes binary / tab-separated text):
```
user_sn: u16 | user_id: 9 bytes ASCII | verify_type: u8 | timestamp: u32 | status: u8
```

**User Record** (72 bytes binary / key=value text):
```
user_sn: u16 | password: 8 bytes | name: 24 bytes | card_no: u32 | user_id: 9 bytes
```

**Verification Methods:**
- 0 = Password/PIN
- 1 = Fingerprint
- 4 = RF Card
- 15 = Face Recognition
- 25 = Palm Vein

**Punch Status Codes:**
- 0 = Check In
- 1 = Check Out
- 2 = Break Out
- 3 = Break In
- 4 = Overtime In
- 5 = Overtime Out

### Proven Data From the Field

| Metric | Value |
|--------|-------|
| Scanner model | Biopro SA40[ID] (ZLM60_TFT) |
| Serial number | CQZ7232960836 |
| Users enrolled | 116 |
| Fingerprint templates | 402 |
| Attendance records | 11,489 |
| Date range | 2025-05-04 → 2026-07-09 |
| Punch rate | ~27/day (single scanner) |
| Punch types | 11,484 Check Out, 5 Break In |

---

## 3. Domain Event Catalog

Every significant occurrence in the system emits a [`DomainEvent`](../crates/timekeep-core/src/events/domain_events.rs).

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `PunchReceived` | Scanner POSTs attendance via ADMS or SDK pull | Storage, webhook, Odoo, dashboard WebSocket |
| `PunchesBatchReceived` | Multiple punches in one HTTP request | Storage (batch insert optimization) |
| `DeviceOnline` | First heartbeat after being offline | Webhook, dashboard, notification (email/Slack) |
| `DeviceOffline` | No heartbeat within configured threshold | Webhook, dashboard, alerting |
| `DeviceStorageWarning` | Records used > 80% capacity | Webhook, dashboard, admin notification |
| `EngineStarted` | System startup | Health check, metrics |
| `EngineStopping` | Graceful shutdown | Cleanup, flush pending writes |
| `DeviceRegistered` | New scanner added via management API | Device discovery, webhook |
| `DeviceRemoved` | Scanner decommissioned | Cleanup, webhook |

---

## 4. Architecture Decision: Core + Providers

### Why Not Monolithic

The Frappe biometric sync tool analysis confirmed: single-vendor implementations are fragile. Every vendor uses a different transport, wire format, auth mechanism, and data encoding. A monolithic implementation would need to be rewritten for each new vendor.

### The Trait-Based Approach

```rust
// Core defines the contract:
#[async_trait]
trait BiometricDevice: Send + Sync {
    async fn connect(&mut self) -> Result<(), String>;
    async fn get_users(&self) -> Result<Vec<User>, String>;
    async fn get_attendance(&self, since: Option<Timestamp>) -> Result<Vec<Punch>, String>;
    // ... 10+ methods
}

// Each vendor implements the contract:
struct ZkTecoDevice { ... }    // ZKTeco SDK + ADMS
struct SupremaDevice { ... }    // Suprema BioStar API
struct AnvizDevice { ... }      // Anviz protocol
```

### Crate Dependency Graph

```
timekeep
  ├── timekeep-engine
  │     └── timekeep-core
  ├── timekeep-zkteco
  │     ├── timekeep-core
  │     ├── axum (ADMS HTTP server)
  │     └── binrw (SDK binary protocol)
  ├── timekeep-storage-sqlite
  │     ├── timekeep-core
  │     └── sqlx (SQL queries)
  ├── timekeep-dist-webhook
  │     ├── timekeep-core
  │     └── reqwest (HTTP client)
  ├── timekeep-dist-odoo
  │     ├── timekeep-core
  │     └── reqwest (Odoo XML-RPC / JSON-RPC)
  └── timekeep-api
        ├── timekeep-core
        │     └── axum (REST API)
```

### Storage vs. Distribution — Separate Concerns

Storage persists data. Distribution notifies external systems. They are two different traits, two different implementations, two different failure modes:

```rust
trait Storage {         // Where data lives
    async fn store_punch(&self, punch: &Punch) -> Result<()>;
}

trait Distributor {     // Who gets notified
    async fn on_event(&self, event: &DomainEvent) -> Result<()>;
}
```

---

## 5. Feature Matrix — Current vs. Planned vs. Visionary

### ✅ Done — Core Platform (July 2026)

| Feature | Crate | Status |
|---------|-------|--------|
| Domain model (Punch, User, Device, OpLog) | `timekeep-core` | 5 model files, validation, dedup IDs |
| Traits (BiometricDevice, Storage, Distributor) | `timekeep-core` | 4 traits, documented |
| Event bus (tokio broadcast) | `timekeep-core` | 13 event types, 1024 buffer |
| ADMS HTTP push server | `timekeep-zkteco` | 6 endpoints, ATTLOG/USERINFO/KV parsers |
| SDK TCP binary protocol | `timekeep-zkteco` | Connect, auth, all commands, binrw framing |
| Background SDK poller | `timekeep-zkteco` | 60s interval, timezone-aware, graceful shutdown |
| SQLite storage | `timekeep-storage-sqlite` | WAL mode, idempotent, query builder, **19 tests** |
| PostgreSQL storage | `timekeep-storage-postgres` | Schema, migrations, all Storage methods |
| Webhook distributor | `timekeep-dist-webhook` | HMAC signature, exponential backoff, **11 tests** |
| Engine pipeline | `timekeep-engine` | normalize → dedup → enrich → store → distribute |
| Batch writer | `timekeep-engine` | 500 punch / 1s flush |
| Dedup cache | `timekeep-engine` | LRU in-memory + storage fallback, **7 tests** |
| REST API (management) | `timekeep-api` | JWT auth, device CRUD, punch query/correction |
| REST API (integration) | `timekeep-api` | API key auth, punch query |
| Prometheus metrics | `timekeep-api` | `axum-prometheus` on both routers |
| App binary | `timekeep` | Wiring, graceful shutdown, device registry |
| **209 unit tests** | all crates | All passing, zero warnings |

### 🔴 P0 — Critical Gaps (Now)

| Feature | Impact |
|---------|--------|
| Systemd service unit | Auto-start on NAS/linux reboot |
| Integration tests | Zero e2e tests. All 209 are unit tests. |
| PostgreSQL tests | SQLite has 19, Postgres has 0 |
| OpenTelemetry tracing | No OTLP export, no correlation IDs |
| PostgreSQL wiring in app | Postgres implemented but not selectable |

### 🟡 P1 — Important (Next)

| Feature | Impact |
|---------|--------|
| Odoo distributor (implement) | Stub with TODO(ENTERPRISE). Needs JSON-2 API. |
| Enrichment pipeline (implement) | Pass-through. Needs HR employee lookup. |
| Docker support | Dockerfile + docker-compose |
| cargo-deny in CI | License audit + security advisories |
| Dashboard embedded serving | React dashboard not served from Rust binary |

### 🟢 P2 — Polish (Later)

| Feature | Impact |
|---------|--------|
| Real-time enrollment | Fingerprint enrollment from dashboard (see `PLAN-realtime-enrollment.md`) |
| Shift-aware attendance | Late/early/overtime detection against schedules |
| CSV export | Integration with any payroll system |
| Health check depth | Add DB ping + device connectivity to /api/health |

### 💎 P3 — Differentiating Features (Future)

These are the features that make timekeep unique in the market.

| Feature | Why It's Unique |
|---------|-----------------|
| **Multi-vendor support** (Suprema, Anviz, Hikvision) | No existing open-source tool does this. Every implementation is single-vendor. |
| **Scanner auto-discovery** (UDP broadcast) | IT plugs in scanner, dashboard detects it, one-click configure. Currently requires manual IP entry. |
| **Shift-aware attendance processing** | Auto-detect late arrivals, early departures, overtime against configurable shift schedules. Currently requires HR system for this. |
| **Face/Palm verification tracking** | Track which biometric methods employees use. Compliance: some jurisdictions require specific verification methods. |
| **Offline-first scanner buffering** | Scanner stores punches when network is down, backfills when reconnected. Zero data loss. |
| **Anomaly detection** | Flag suspicious patterns: exact same punch time every day (buddy punching), impossible punch sequences (check-out before check-in). |
| **Graceful BioTime migration** | One-click import from existing BioTime MySQL database. Detect conflicts, map employee IDs. |
| **Attendance heatmap** | Visualize peak arrival/departure times. Optimize shift schedules. |
| **Privacy-aware fingerprint storage** | Store only hashes/templates for verification, never raw images. GDPR-compliant by design. |
| **IP camera snapshot on punch** | Correlate punch with camera frame for audit. "Who was at the scanner?" |
| **MQTT integration** | Real-time dashboard via any MQTT-compatible IoT platform. No WebSocket needed. |
| **Multi-site federation** | One dashboard for scanners across multiple physical locations. Each site runs a local instance, federation API aggregates. |

---

## 6. Integration Points — What Connects Where

### Inbound (Data Into timekeep)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ZKTeco Scanner   │────▶│ ADMS HTTP Server │────▶│ Event Bus        │
│ HTTP POST :8085  │     │ /iclock/cdata    │     │ PunchReceived    │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
┌──────────────────┐     ┌──────────────────┐              │
│ ZKTeco Scanner   │────▶│ SDK Pull Engine  │──────────────┤
│ TCP :4370        │     │ Binary protocol  │              │
└──────────────────┘     └──────────────────┘              │
                                                           │
┌──────────────────┐     ┌──────────────────┐              │
│ HR System        │────▶│ Management API   │──────────────┤
│ REST POST :3000  │     │ /api/devices     │  DeviceReg.  │
└──────────────────┘     └──────────────────┘              │
                                                           │
┌──────────────────┐                                      │
│ Admin Dashboard  │─── Scan QR code ────▶ Provisioning   │
│ Web UI           │                     new scanner      │
└──────────────────┘                                      │
```

### Outbound (Data Out of timekeep)

```
Event Bus
   │
   ├──▶ Storage (SQLite/PostgreSQL)
   │      └── Queried by: Management API, Integration API, Odoo (direct DB)
   │
   ├──▶ Webhook Distributor
   │      └── POST JSON → Any HTTP endpoint (Odoo, ERPNext, custom, Zapier)
   │
   ├──▶ Odoo Distributor
   │      └── XML-RPC → Odoo hr.attendance create/update
   │
   ├──▶ Integration API (:3001)
   │      └── GET /api/v1/punches → ERPNext, SAP, CSV export scripts
   │
   └──▶ Management API (:3000)
          └── WebSocket → Dashboard live updates
```

---

## 7. Reference Project Analysis

### Tier 1 — Directly Applicable

| Project | Stars | Language | What It Teaches |
|---------|-------|----------|-----------------|
| **[adrobinoga/zk-protocol](../.reference/zk-protocol/)** | 223 | Markdown | Complete binary SDK spec. ~50 commands, user/attendance/fingerprint/access formats. **Does NOT cover ADMS push.** |
| **[s0x90/zkteco-adms](../.reference/zkteco-adms/)** | 14 | Go | ADMS push server reference. Callback pattern, device registry, command queue. In-memory only (no persistence). |
| **[frappe/biometric-attendance-sync-tool](../.reference/biometric-attendance-sync-tool/)** | 271 | Python | ERPNext's official tool. Proves the NEED for multi-vendor. Crash-recovery dump file, resumable cursor, status tracking patterns. |
| **[saifulcoder/adms-server-ZKTeco](../.reference/adms-server-php/)** | 96 | PHP | Working ADMS push receiver. Confirmed protocol: GET handshake + POST cdata. Reveals TransFlag bitmap, OPERLOG fingerprint data format. |
| **[fananimi/pyzk](../.reference/pyzk/)** | 639 | Python | The de-facto Python ZKTeco SDK. We used this to pull live data. Reference for binary protocol implementation details. |
| **[adrobinoga/pyzatt](../.reference/pyzatt/)** | 135 | Python | Cleaner Python ZKTeco implementation. Protocol documentation cross-reference. |

### Tier 2 — Architectural Reference

| Project | Stars | Language | What It Teaches |
|---------|-------|----------|-----------------|
| **timberio/vector** | 19k+ | Rust | Data pipeline architecture: sources → transforms → sinks. Same pattern as scanner → pipeline → storage/distribution. |
| **tokio-rs/axum** | 30k+ | Rust | HTTP framework used for ADMS server and REST APIs. Mature, production-grade. |
| **launchbadge/sqlx** | 14k+ | Rust | Compile-time checked SQL. Used for both SQLite and PostgreSQL backends. |

---

## 8. Impressive & Differentiating Features

### What Makes This Special

The attendance tracking market is dominated by:
- **Vendor-locked software** (BioTime, ZKBioSecurity) — Windows-only, expensive licensing, no API
- **Cloud-only SaaS** (Personio, TimeTac) — no hardware integration, per-user monthly fees
- **Scrappy Python scripts** — single-vendor, no persistence, brittle, no dashboard

**timekeep bridges this gap:**

1. **Self-hosted, zero license cost.** Runs on a €200 NAS. No vendor lock-in, no subscription.
2. **ZKTeco native.** Full support for both ADMS push (real-time HTTP) and SDK pull (binary protocol on port 4370).
3. **Rust — single static binary.** 5MB, no runtime, no Docker needed (but Docker supported). Deploy with `scp`.
4. **API-first.** Any HR system (Odoo, ERPNext, SAP, custom) integrates via REST or webhooks. The library doesn't know about any specific HR system.
5. **ADMS push + SDK pull.** Handles both protocols. Push mode for real-time, pull mode for legacy scanners or bulk migration.
6. **Graceful offline.** Scanners buffer punches when connection drops. Server catches up on reconnect.
7. **Privacy by design.** Fingerprint templates stay on the scanner. Only attendance metadata flows to the server.

### The Killer Feature: Scanner Provisioning

Currently, setting up a ZKTeco scanner requires:
1. Physical access to the scanner
2. Navigating a tiny LCD menu with arrow keys
3. Setting IP, gateway, subnet mask, ADMS URL manually
4. Knowing the comm key (or resetting to factory defaults)

**With timekeep:**
1. IT admin opens the dashboard
2. Enters the scanner's IP address
3. timekeep auto-detects the model, firmware, current config
4. Admin sets comm key, timezone, ADMS URL from a web form
5. Scanner is live within 60 seconds

This doesn't exist in any open-source tool. BioTime and ZKBioSecurity have it, but locked behind their licensing.

---

## References

- [adrobinoga/zk-protocol](https://github.com/adrobinoga/zk-protocol) — Definitive ZKTeco binary protocol specification
- [s0x90/zkteco-adms](https://github.com/s0x90/zkteco-adms) — Go ADMS push server reference
- [frappe/biometric-attendance-sync-tool](https://github.com/frappe/biometric-attendance-sync-tool) — ERPNext biometric sync
- [fananimi/pyzk](https://github.com/fananimi/pyzk) — Python ZKTeco SDK
- [Odoo HR module](../.reference/odoo-hr/overview.md) — `hr.attendance` + `hr.employee` model reference
- [Alsabah Project README](../README.md) — Original project documentation and scanner access details
