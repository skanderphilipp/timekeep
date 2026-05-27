# ADR-001: SQLite by Default, PostgreSQL as Upgrade Path

**Status:** Accepted  
**Date:** 2026-07-10  
**Deciders:** Alsabah Technical Team

## Context

timekeep runs on Synology NAS, Raspberry Pi, or any Linux server. We need
a storage backend that works with zero configuration out of the box but can
scale to multi-scanner production deployments.

## Decision

**SQLite (WAL mode) is the default. PostgreSQL is a first-class alternative.**

- The `Storage` trait abstracts all persistence behind a single interface
- `timekeep-storage-sqlite` is always compiled in and used by default
- `timekeep-storage-postgres` is compiled conditionally (feature-gated)
- Switching is done via `TIMEKEEP_DB_BACKEND=postgres` env var at startup

## Rationale

- **SQLite** needs no daemon, no network, no credentials. SSH into a NAS,
  copy the binary, run it. The `TIMEKEEP_DB_PATH` env var points at a file.
- **PostgreSQL** is needed when integrating with Odoo (which also uses
  PostgreSQL), for multi-scanner deployments, and for any scenario requiring
  concurrent writes from multiple processes.
- Both backends share the same SQL schema (with dialect-specific adaptations).
- The `Storage` trait already has 8 methods that both backends implement.

## Consequences

- New storage backends (MySQL? ClickHouse?) can be added behind the same trait
- Integration tests must run against both backends
- Migration tooling will be needed when users upgrade from SQLite → PostgreSQL

## Alternatives Considered

- **PostgreSQL only**: Rejected — too heavy for single-scanner NAS deployments
- **Config file TOML**: Rejected — device config is database-backed via
  `Storage::list_device_configs()`, not a file on disk. See ADR-005.
- **Diesel ORM**: Rejected — `sqlx` provides compile-time checked queries
  without a DSL, matching the project's preference for explicit SQL
