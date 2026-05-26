# Timekeep — Data Collection Architecture

> **Date:** 2026-07-10
> **Status:** Documenting dual-path collection (ADMS push + SDK pull)

## Dual-Path Data Collection

ZKTeco scanners provide two independent data paths. Both run simultaneously
because they serve different purposes — neither is a "fallback" for the other.

```
┌─────────────────────────────────────────────────────────────┐
│                     ZKTeco Scanner                          │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │   ADMS Push      │    │      SDK Pull                │   │
│  │   (real-time)    │    │      (bulk / historical)     │   │
│  │                  │    │                              │   │
│  │ Device pushes    │    │ Server calls                 │   │
│  │ events as they   │    │ get_attendance(since)        │   │
│  │ happen via HTTP  │    │ to pull batches              │   │
│  └────────┬─────────┘    └──────────────┬───────────────┘   │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────────────────────────────────────────┐
│                    Event Bus (tokio::broadcast)            │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│              Processing Pipeline                          │
│                                                           │
│  normalize → dedup → enrich → store → distribute          │
│                                                           │
│  Dedup prevents duplicates from the two parallel paths.   │
└───────────────────────────────────────────────────────────┘
```

### ADMS Push (Port 8085)

- **What:** Device sends HTTP POST to `/iclock/cdata` with attendance records
  as they are captured. The server runs an embedded ADMS listener.
- **Trigger:** Every punch on the scanner.
- **Data:** Real-time, single-punch events.
- **Latency:** Sub-second.

### SDK Pull (Configurable Interval)

- **What:** Server calls `device.get_attendance(since: last_known_timestamp)`
  to request all records the device has stored since the last pull.
- **Trigger:** Periodic timer (configurable via `poll_interval_secs`).
- **Data:** Bulk batches. Catches anything ADMS missed (network blips,
  device buffer, reboots).
- **Latency:** Up to `poll_interval_secs` seconds.

### Why Both?

| Concern | ADMS Push | SDK Pull |
|---------|-----------|----------|
| Real-time events | ✅ | ❌ (delayed by interval) |
| Bulk historical data | ❌ (single events) | ✅ (batches) |
| Survives network blips | ❌ (events lost during outage) | ✅ (device buffers records) |
| Survives device reboot | ❌ | ✅ (pulls backlog) |
| Firewall-friendly | ❌ (device needs outbound HTTP) | ✅ (server initiates) |

### Poll Interval (`poll_interval_secs`)

Controls how often the SDK pull loop queries each device.

- **Default:** 60 seconds
- **Minimum:** 5 seconds
- **Maximum:** 3600 seconds (1 hour)
- **Trade-off:** Lower = fresher data but more network traffic.
  Higher = less traffic but longer gaps if ADMS push fails.

### Dedup Guarantee

The pipeline's dedup stage uses `(device_sn, user_pin, timestamp)` as the
deduplication key. If the same punch arrives via both ADMS push and SDK pull,
only one copy is stored. This is essential because both paths run concurrently.

## System Settings

These are engine-wide settings persisted in the `settings` table under
the `"system"` key. They control behavior that applies to ALL devices.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `poll_interval_secs` | u32 | 60 | SDK pull frequency for all devices |
| `auto_discover` | bool | false | UDP broadcast scan for new ZKTeco scanners on LAN |

## Current Implementation Status

| Component | Status |
|-----------|--------|
| ADMS push listener | ✅ Implemented (`ZkTecoDevice::connect()` starts ADMS server) |
| Processing pipeline | ✅ Implemented (normalize → dedup → enrich → store → distribute) |
| SDK pull loop | 🔴 NOT wired — `get_attendance()` exists in trait but no periodic caller |
| Poll interval setting | 🟡 Model + API exists, not read by engine |
| Auto-discover | 🔴 Not implemented |
| Dedup (dual-path) | ✅ Implemented via `DedupCache` |
