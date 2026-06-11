# Attendance OS

**Self-hosted, multi-vendor biometric attendance management.**

A single Rust binary that collects real-time attendance data from biometric scanners (ZKTeco, Suprema, Anviz), enriches it with employee identity, and distributes it to your HR/payroll systems. Runs on a Synology NAS, Raspberry Pi, or any Linux server. No cloud dependency — your data stays on your hardware.

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![CI](https://github.com/bentech/timekeep/actions/workflows/ci.yml/badge.svg)](https://github.com/bentech/timekeep/actions/workflows/ci.yml)
[![Rust](https://img.shields.io/badge/rust-1.85%2B-orange)](https://www.rust-lang.org)

---

## Table of Contents

- [Why Attendance OS?](#why-timekeep)
- [Quick Start (Docker)](#quick-start-docker)
- [Quick Start (Bare Metal)](#quick-start-bare-metal)
- [Features](#features)
- [Architecture](#architecture)
- [Crate Map](#crate-map)
- [Configuration Reference](#configuration-reference)
- [Development Setup](#development-setup)
- [Internationalization (i18n)](#internationalization-i18n)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Why Attendance OS?

Most biometric attendance systems lock you into a single vendor's ecosystem. You either pay for expensive proprietary software, or you're stuck with vendor-provided tools that don't integrate with your stack.

Attendance OS gives you:

- **Vendor independence** — ZKTeco today, Suprema or Anviz tomorrow. The trait-based architecture makes adding new device providers straightforward.
- **Data ownership** — SQLite or PostgreSQL on your own hardware. No cloud, no telemetry, no vendor lock-in.
- **Real integration** — Push attendance events to webhooks, Odoo, or your custom HR system. The event pipeline normalizes, deduplicates, and enriches every punch before distribution.
- **Single binary** — The dashboard SPA is embedded at compile time. One binary = API + dashboard + device server.

---

## Quick Start (Docker)

```bash
# 1. Create your environment file
cat > .env << 'EOF'
TIMEKEEP_JWT_SECRET=a-64-char-random-secret
TIMEKEEP_ADMIN_USER=admin
TIMEKEEP_ADMIN_PASSWORD=a-strong-password
EOF

# 2. Start the container
docker compose up -d

# 3. Open the dashboard
#    http://localhost:3000
#
# Log in with the credentials from .env
```

The same port (3000) serves the REST API (`/api/*`) and the dashboard SPA (`/*`).
Scanner push endpoint is on port 8085 (`/iclock/cdata`).

### Optional: PostgreSQL instead of SQLite

Uncomment the `postgres` service in `docker-compose.yml` and set:

```env
TIMEKEEP_DB_BACKEND=postgres
DATABASE_URL=postgres://attendance:your-password@postgres:5432/attendance
```

---

## Quick Start (Bare Metal)

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Rust | 1.85+ | `rustc --version` |
| Node.js | 22+ | `node --version` |
| pnpm | 11+ | `pnpm --version` |

### Build & Run

```bash
# 1. Build the dashboard (embedded at compile time)
cd dashboard
pnpm install --frozen-lockfile
pnpm build
cd ..

# 2. Build the Rust binary
cargo build --release

# 3. Run
export TIMEKEEP_DB_PATH=./timekeep.db
export TIMEKEEP_JWT_SECRET=a-64-char-random-secret
export TIMEKEEP_ADMIN_USER=admin
export TIMEKEEP_ADMIN_PASSWORD=a-strong-password
./target/release/attendance-app
```

### Using the Makefile

```bash
make help          # Show all available commands
make dev           # Dashboard dev server + Rust backend (hot reload)
make build         # Production build
make test          # Run all tests (Rust + dashboard)
make lint          # Run all linters (clippy + oxlint + fmt)
```

---

## Features

### Data Collection

| Feature | Status |
|---------|--------|
| ADMS push (real-time punch events via HTTP) | ✅ |
| SDK pull (bulk historical data via TCP binary protocol) | ✅ |
| Deduplication across dual data paths | ✅ |
| User table sync from device (PIN → name resolution) | ✅ |
| Multi-vendor trait abstraction (ZKTeco, Suprema, Anviz) | ✅ ZKTeco / 🔴 others planned |

### Storage

| Backend | Status |
|---------|--------|
| SQLite (WAL mode, single file, zero-config) | ✅ |
| PostgreSQL (connection pool, migrations) | ✅ |

### Distribution

| Distributor | Status |
|-------------|--------|
| Webhook (HMAC-signed outbound POST to your URL) | ✅ |
| Odoo (JSON-2 API, employee lookup, check-in/out) | ✅ |

Both are configured through the dashboard (Settings → Endpoints) and stored
in the database. No environment variables required.

### API & Auth

| Feature | Status |
|---------|--------|
| REST API with JWT auth (management) | ✅ |
| API key auth (integration endpoints) | ✅ |
| Role-based access control (admin, operator, viewer) | ✅ |
| Rate limiting (100 req/min management, 300 req/min integration) | ✅ |
| OpenAPI/Swagger docs (`/api/docs`) | ✅ |

### Observability

| Feature | Status |
|---------|--------|
| Structured JSON logging (configurable via `RUST_LOG`) | ✅ |
| Prometheus metrics endpoint (`/metrics`) | ✅ |
| OpenTelemetry distributed tracing (opt-in) | ✅ |
| Health check endpoint (`/api/health`) | ✅ |

### Dashboard

| Feature | Status |
|---------|--------|
| Device management (add/edit/remove scanners) | ✅ |
| Real-time punch feed | ✅ |
| Attendance reports with PDF export | ✅ |
| User management (CRUD, role assignment) | ✅ |
| API key management | ✅ |
| Integration endpoint configuration | ✅ |
| Audit log | ✅ |
| Dark/light theme | ✅ |
| RTL support (Arabic) | ✅ |
| Responsive (desktop + tablet) | ✅ |

---

## Architecture

```
Scanner ──HTTP push──▶ ADMS Server (:8085)
Scanner ◀──TCP pull─── SDK Poller            │
                         │                   │
                  ┌──────▼───────────────────▼──┐
                  │        Event Bus             │
                  │    (tokio::broadcast)        │
                  └──────┬───────────────────┬───┘
                         │                   │
                  ┌──────▼──────┐    ┌───────▼──────────┐
                  │  Pipeline   │    │  Distributors     │
                  │             │    │                   │
                  │ normalize   │    │  Webhook (HMAC)   │
                  │   → dedup   │    │  Odoo (JSON-2)    │
                  │   → enrich  │    │  Custom (trait)   │
                  │   → store   │    │                   │
                  │   → distrib.│    └───────────────────┘
                  └──────┬──────┘
                         │
                  ┌──────▼──────┐
                  │   Storage   │
                  │             │
                  │  SQLite     │
                  │  PostgreSQL │
                  └─────────────┘
```

### Data Flow

Every punch flows through a 5-stage pipeline:

1. **Normalize** — Convert vendor-specific formats into the domain `PunchEvent`
2. **Dedup** — Eliminate duplicates from the dual ADMS+SDK paths using `(device_sn, user_pin, timestamp)`
3. **Enrich** — Resolve PINs to employee names, attach department info
4. **Store** — Persist to SQLite or PostgreSQL
5. **Distribute** — Fan out to all configured distributors (webhooks, Odoo, etc.)

### Dual-Path Collection

ZKTeco scanners provide two independent data paths, both running simultaneously:

| Concern | ADMS Push (real-time) | SDK Pull (bulk) |
|---------|----------------------|-----------------|
| Latency | Sub-second | Up to `poll_interval_secs` |
| Data type | Single punch events | Batches of records |
| Network resilience | ❌ Events lost during outage | ✅ Device buffers records |
| Firewall-friendly | ❌ Device needs outbound HTTP | ✅ Server initiates TCP |
| Configuration | Device-configured ADMS URL | Server-side `poll_interval_secs` |

---

## Crate Map

| Crate | Purpose |
|-------|---------|
| `attendance-core` | Domain model, traits (`BiometricDevice`, `Storage`, `Distributor`), events |
| `attendance-engine` | Event bus, pipeline orchestrator, dedup cache |
| `attendance-circuit` | Circuit breaker for external service calls |
| `attendance-zkteco` | ZKTeco provider — ADMS push server + SDK pull (TCP binary protocol) |
| `attendance-storage-sqlite` | SQLite storage backend with WAL mode |
| `attendance-storage-postgres` | PostgreSQL storage backend with connection pooling |
| `attendance-dist-webhook` | Generic webhook distributor with HMAC signatures |
| `attendance-dist-odoo` | Odoo JSON-2 API distributor |
| `attendance-api` | REST API server (management + integration + Swagger UI) |
| `attendance-app` | Binary entry point that wires everything together |

---

## Configuration Reference

All configuration is via environment variables. No config files.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `TIMEKEEP_JWT_SECRET` | Secret key for JWT token signing (min 32 chars) | `openssl rand -base64 48` |
| `TIMEKEEP_ADMIN_USER` | Initial admin username (only used on first run) | `admin` |
| `TIMEKEEP_ADMIN_PASSWORD` | Initial admin password (only used on first run) | `a-strong-password` |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMEKEEP_DB_PATH` | `./timekeep.db` | SQLite database file path |
| `TIMEKEEP_DB_BACKEND` | `sqlite` | Storage backend: `sqlite` or `postgres` |
| `DATABASE_URL` | — | PostgreSQL connection string (when `postgres` backend) |

### Network

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMEKEEP_API_PORT` | `3000` | Management API + Dashboard port |
| `TIMEKEEP_INTEGRATION_PORT` | `3001` | Integration API port (API key auth) |
| `TIMEKEEP_ADMS_PORT` | `8085` | ADMS push endpoint (scanners push here) |

### ZKTeco SDK

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMEKEEP_POLL_INTERVAL_SECS` | `60` | SDK pull frequency (seconds) |
| `TIMEKEEP_AUTO_DISCOVER` | `false` | UDP broadcast scan for ZKTeco devices on LAN |

### Distribution

Webhook and Odoo endpoints are configured **dynamically through the dashboard**
(Settings → Endpoints) and stored in the database. No environment variables
are needed for distribution. Each endpoint gets a circuit breaker (5 failures
→ open, 30s cooldown) automatically.

- **Webhook** — timekeep POSTs punch events to your configured URL with
  optional HMAC-SHA256 signing (`X-Signature` header). This is an **outbound**
  webhook — timekeep calls you, not the other way around.
- **Odoo** — timekeep calls the Odoo JSON-2 API for employee lookup and
  check-in/check-out creation. Configure URL, API key, and database name
  through the dashboard.

### Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `timekeep=info` | Log level filter ([docs](https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html)) |
| `TIMEKEEP_OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | `timekeep` | Service name in traces |

---

## Development Setup

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Node.js + pnpm
# macOS:  brew install node pnpm
# Linux:  use nvm or your package manager
# Ensure Node ≥ 22 and pnpm ≥ 11

# Optional but recommended
cargo install cargo-deny   # License & security audit
cargo install cargo-watch  # Auto-reload on changes
```

### First-time Setup

```bash
# Clone the repo
git clone https://github.com/bentech/timekeep.git
cd timekeep

# Install dashboard dependencies
cd dashboard && pnpm install && cd ..

# Build everything
make build

# Run the test suite
make test
```

### Development Workflow

```bash
# Start both dashboard dev server + Rust backend
# Dashboard hot-reloads on :5173, API on :3000
make dev

# Or run them separately:
make dev-rust        # Backend only
make dev-dashboard   # Dashboard only (proxies API calls to :3000)
```

### Code Quality

```bash
# Run all checks (typecheck + lint + format + depcruise + size + style + dupes)
cd dashboard && pnpm check

# Rust checks
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings

# Everything at once
make lint
```

### Project Conventions

- **Conventional Commits** — `feat(scope):`, `fix(scope):`, `docs:`, `refactor:`, `test:`, `chore:`
- **No magic constants** — every path, query key, timeout, and port lives in a named constant
- **Design tokens only** — no hardcoded colors/spacing in CSS (`var(--ao-*)`)
- **TODO(ENTERPRISE)** — every known shortcut gets a documented todo
- **TSX files ≤ 250 lines**, pages ≤ 80 lines

---

## Internationalization (i18n)

Attendance OS supports multiple languages with automatic detection and RTL layout.

### Supported Languages

| Language | Code | Direction |
|----------|------|-----------|
| English | `en` | LTR |
| Arabic | `ar` | RTL |
| French | `fr` | LTR |

### How It Works

The dashboard uses [Lingui](https://lingui.dev) for i18n with `.po` (gettext) format catalogs. Locale detection follows this priority:

1. **URL parameter** — `?locale=ar`
2. **localStorage** — persisted user preference
3. **Browser preference** — `navigator.language`
4. **Fallback** — English

### Adding a New Language

1. **Add a locale config** in `dashboard/src/infrastructure/locale/locale.ts`:

```typescript
{
  code: "de",
  nativeLabel: "Deutsch",
  direction: "ltr",
  browserPrefixes: ["de", "de-DE", "de-AT", "de-CH"],
}
```

2. **Extract translatable strings**:

```bash
cd dashboard
pnpm exec lingui extract
```

3. **Translate** the generated `.po` file in `src/locales/de.po`.

4. **Compile**:

```bash
pnpm exec lingui compile
```

That's it — detection, switching, RTL, and the locale picker UI all derive from the single config.

### Usage in Code

```tsx
import { t } from "@lingui/core/macro";

// In components
<h1>{t`Device Management`}</h1>

// With variables
<p>{t`${count} devices connected`}</p>
```

Never hardcode user-facing strings — always use the `t` macro.

---

## Testing

### Rust

```bash
# All workspace tests
cargo test --workspace

# Specific crate
cargo test -p attendance-zkteco

# With output
cargo test -- --nocapture

# Integration tests (require running backend)
cargo test --test api_integration
```

Test counts by crate:

| Crate | Tests |
|-------|-------|
| `attendance-zkteco` | 150 |
| `attendance-storage-sqlite` | 19 |
| `attendance-engine` | 18 |
| `attendance-core` | 17 |
| `attendance-api` | 11 |
| `attendance-dist-webhook` | 11 |

### Dashboard

```bash
cd dashboard

# Unit tests (Vitest)
pnpm test

# Watch mode
pnpm test:watch

# E2E tests (Playwright)
pnpm test:e2e

# E2E with UI
pnpm test:e2e:ui
```

---

## Deployment

### Docker (recommended)

```bash
docker compose up -d
```

Multi-arch images available: `linux/amd64` + `linux/arm64` (Raspberry Pi).

### Systemd (bare metal)

```bash
# Copy the binary
sudo cp target/release/attendance-app /usr/local/bin/

# Install the service
sudo cp deploy/timekeep.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now timekeep

# Check status
sudo systemctl status timekeep
```

The systemd unit includes security hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateDevices`, and more.

### GitHub Actions

The CI pipeline runs on every push to `main`:
- **Format** — `cargo fmt --check`
- **Clippy** — `cargo clippy -- -D warnings`
- **Test** — `cargo test --workspace`
- **License audit** — `cargo deny check`
- **Docs** — `cargo doc --no-deps`

Tagged releases (`v*`) trigger a Docker build + bare-metal binary release with changelog generation.

---

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full roadmap.

| Priority | Feature |
|----------|---------|
| 🔴 P0 | SDK pull loop (continuous background polling), HR enrichment pipeline |
| 🟡 P1 | Odoo distributor hardening, Docker polish |
| 🟢 P2 | Real-time enrollment, API module reorganization |
| 💎 P3 | Multi-vendor (Suprema, Anviz), scanner auto-discovery, anomaly detection |

---

## Documentation

- [OVERVIEW.md](docs/OVERVIEW.md) — Full system overview, domain model, and feature matrix
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Dual-path data collection architecture
- [ROADMAP.md](docs/ROADMAP.md) — Development roadmap and status
- [API-AUDIT.md](docs/API-AUDIT.md) — API endpoint audit
- [docs/adr/](docs/adr/) — Architecture Decision Records (5 ADRs)

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick summary:
- Conventional Commits format
- `cargo fmt` + `cargo clippy` must pass
- Tests must pass
- No magic constants
- All user-facing strings use Lingui i18n

---

## License

**GNU Affero General Public License v3.0** (AGPL-3.0).

This is a strong copyleft license. You can use, modify, and distribute this software for any purpose — including commercially. However, if you modify it and make it available as a network service, you must publish your changes under the same license.

For proprietary/commercial use without the AGPL copyleft obligations (e.g., embedding in a closed-source product, white-labeling, or offering as SaaS without publishing your modifications), a separate commercial license is available.

Contact: **skander@bentech.app**

See [LICENSE](LICENSE) for the full legal text.

---

Built with 🦀 Rust and ⚛️ React
