# ADR-004: Device Configuration is Database-Backed, Not File-Based

**Status:** Accepted
**Date:** 2026-07-10
**Deciders:** Alsabah Technical Team

## Context

timekeep needs to manage device configurations (IP, port, comm key,
timezone, push/pull mode). We considered TOML files, environment variables,
and database storage.

## Decision

**Device configuration is stored in the database via the `Storage` trait.**

- `Storage::upsert_device_config()` persists connection parameters
- `Storage::list_device_configs()` is called at startup to discover devices
- `Storage::delete_device_config()` removes devices
- The REST API (`POST /api/devices`) writes to the database, not a file

## Rationale

- **Dashboard integration**: The admin UI (Phase 3) needs CRUD on devices.
  A database is the natural backing store. A TOML file would require file
  watchers, locking, and conflict resolution.
- **Consistency**: The same storage backend that holds attendance data also
  holds device config. One backup covers everything.
- **Multi-process safety**: SQLite WAL mode + PostgreSQL both handle concurrent
  reads safely. A TOML file does not.
- **No file watchers needed**: Adding a scanner via the API immediately
  persists to DB. No need to detect file changes and reload.

## Consequences

- The `ConfigProvider` trait (in `timekeep-core/src/traits/config_provider.rs`)
  is currently unused. It exists as a future extension point for config sources
  other than the database (e.g., a remote config service).
- The app binary reads `list_device_configs()` at startup — no config file
  parsing needed.
- Migration: moving from one DB backend to another carries device config along
  with attendance data automatically.

## Alternatives Considered

- **TOML config file**: Rejected — requires file I/O, conflict resolution,
  and dashboard wouldn't be able to write to it safely
- **Environment variables per device**: Rejected — doesn't scale beyond 2-3
  devices and can't be managed from a dashboard
- **etcd/consul**: Rejected — operational complexity not justified
