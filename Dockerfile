# syntax=docker/dockerfile:1

# ─── Stage 1: Build Dashboard (React SPA) ───────────────────────────
FROM node:22-alpine AS dashboard-build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# Install dependencies (pnpm store cached on host)
COPY dashboard/pnpm-lock.yaml dashboard/pnpm-workspace.yaml dashboard/package.json ./
COPY dashboard/packages ./packages
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy remaining source and build
COPY dashboard/tsconfig.json ./
COPY dashboard/vite.config.ts dashboard/vitest.setup.ts ./
COPY dashboard/index.html dashboard/lingui.config.ts dashboard/lint-staged.config.mjs ./
COPY dashboard/.oxlintrc.json ./
COPY dashboard/public ./public
COPY dashboard/src ./src
COPY dashboard/generated ./generated
COPY shared ../shared
RUN pnpm build

# ─── Stage 2: Build Rust Binary ──────────────────────────────────────
FROM rust:1.88-alpine AS rust-build

RUN apk add --no-cache musl-dev sqlite-dev pkgconfig openssl-dev openssl-libs-static curl
ENV OPENSSL_STATIC=1

WORKDIR /app

# Pre-fetch third-party dependencies (leveraging layer + host cache)
COPY Cargo.toml Cargo.lock ./
COPY crates/timekeep-core/Cargo.toml ./crates/timekeep-core/
COPY crates/timekeep-engine/Cargo.toml ./crates/timekeep-engine/
COPY crates/timekeep-zkteco/Cargo.toml ./crates/timekeep-zkteco/
COPY crates/timekeep-storage-sqlite/Cargo.toml ./crates/timekeep-storage-sqlite/
COPY crates/timekeep-storage-postgres/Cargo.toml ./crates/timekeep-storage-postgres/
COPY crates/timekeep-dist-webhook/Cargo.toml ./crates/timekeep-dist-webhook/
COPY crates/timekeep-dist-odoo/Cargo.toml ./crates/timekeep-dist-odoo/
COPY crates/timekeep-circuit/Cargo.toml ./crates/timekeep-circuit/
COPY crates/timekeep-api/Cargo.toml ./crates/timekeep-api/
COPY crates/timekeep-app/Cargo.toml ./crates/timekeep-app/

# Dummy sources — lets cargo download + compile third-party deps once
RUN mkdir -p src && echo "pub fn dummy() {}" > src/lib.rs
RUN mkdir -p crates/timekeep-core/src && echo "pub fn dummy() {}" > crates/timekeep-core/src/lib.rs
RUN mkdir -p crates/timekeep-engine/src && echo "pub fn dummy() {}" > crates/timekeep-engine/src/lib.rs
RUN mkdir -p crates/timekeep-zkteco/src && echo "pub fn dummy() {}" > crates/timekeep-zkteco/src/lib.rs
RUN mkdir -p crates/timekeep-storage-sqlite/src && echo "pub fn dummy() {}" > crates/timekeep-storage-sqlite/src/lib.rs
RUN mkdir -p crates/timekeep-storage-postgres/src && echo "pub fn dummy() {}" > crates/timekeep-storage-postgres/src/lib.rs
RUN mkdir -p crates/timekeep-dist-webhook/src && echo "pub fn dummy() {}" > crates/timekeep-dist-webhook/src/lib.rs
RUN mkdir -p crates/timekeep-dist-odoo/src && echo "pub fn dummy() {}" > crates/timekeep-dist-odoo/src/lib.rs
RUN mkdir -p crates/timekeep-circuit/src && echo "pub fn dummy() {}" > crates/timekeep-circuit/src/lib.rs
RUN mkdir -p crates/timekeep-api/src && echo "pub fn dummy() {}" > crates/timekeep-api/src/lib.rs
RUN mkdir -p crates/timekeep-app/src && echo "fn main() {}" > crates/timekeep-app/src/main.rs

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release 2>/dev/null || true

# Copy real source code
COPY crates ./crates
COPY generated ./generated

# Copy dashboard build output for embedding
COPY --from=dashboard-build /app/dist ./dashboard/dist

# Build with the real source (target/ cache survives between builds on the host)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release -p timekeep && \
    cp /app/target/release/timekeep /app/timekeep

# ─── Stage 3: Minimal Runtime ────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache sqlite-libs ca-certificates tzdata && \
    adduser -D -h /var/lib/timekeep timekeep

# Copy the single binary (dashboard is embedded at compile time)
COPY --from=rust-build /app/timekeep /usr/local/bin/

# Create data directory
RUN mkdir -p /var/lib/timekeep && chown timekeep:timekeep /var/lib/timekeep

USER timekeep
WORKDIR /var/lib/timekeep

# Environment defaults (override via docker-compose or -e flags)
ENV TIMEKEEP_DB_PATH=/var/lib/timekeep/timekeep.db
ENV TIMEKEEP_DB_BACKEND=sqlite
ENV TIMEKEEP_API_PORT=3000
ENV TIMEKEEP_INTEGRATION_PORT=3001
ENV TIMEKEEP_ADMS_PORT=8085
ENV RUST_LOG=timekeep=info

EXPOSE 3000 3001 8085

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["timekeep"]
