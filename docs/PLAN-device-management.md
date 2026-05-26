# Timekeep — Comprehensive Device Management Plan

> **Status:** Planning
> **Date:** 2026-07-10
> **Goal:** Make device management the killer feature — complete device intelligence,
> app-store-like onboarding, zero vendor lock-in through provider abstraction.

---

## 0. Learning From Reference Projects

### What zkteco-adms (Go) Gets Right

| Pattern | What It Is | Why We Copy It |
|---------|-----------|----------------|
| **Device registry with activity tracking** | `last_activity` updated on every HTTP interaction | Enables online/offline detection. We already have partial tracking in `DeviceConnectionState` — but no history. |
| **Online threshold** | 2-minute timeout, configurable | Clean model. Ours is implicit. Make explicit, configurable per-device. |
| **Command queue** | `C:<ID>:<CMD>\n` — queued commands delivered on next poll | We already have `enqueue_device_command` API but queue is in-memory only. Needs persistence. |
| **Device eviction** | Stale devices auto-removed after 24h | Good for auto-discovered devices that never finalize provisioning. |
| **Inspect endpoint** | `/iclock/inspect` returns device snapshot JSON | Extend our `/api/devices/{sn}` to return the same richness. |

### What frappe/biometric-attendance-sync-tool Teaches

| Pattern | What It Is | Why It Matters |
|---------|-----------|----------------|
| **Resumable cursor** | Tracks `last_sync_timestamp` per device, resumes from there | Our `latest_punch_for_device()` already does this — but UI doesn't show it. |
| **Crash-recovery dump files** | JSON snapshots of sync state written to disk | Our DB-backed storage handles this naturally. |
| **Multi-vendor necessity** | The tool exists because ERPNext customers have ZKTeco, Suprema, Anviz, Hikvision all in one deployment | Proves our provider abstraction is the right architecture. |

### What pyzk Teaches

| Pattern | What It Is | Why It Matters |
|---------|-----------|----------------|
| **Rich device info** | `get_device_info()` returns model, firmware, platform, MAC, serial, user/record/fingerprint counts, face capacity | Our `Device` model already captures this. Just need to expose it. |
| **Device config read/write** | ~81 key-value parameters: timezone, network, Wiegand, biometric sensitivity | We should expose these as structured config, not raw KV. |

### What Odoo HR Teaches

| Pattern | What It Is | Why It Matters |
|---------|-----------|----------------|
| **Device as an asset** | Odoo's `hr.attendance` model links punches to employees, not devices. Devices are tracked separately as assets. | We should add device metadata: location, branch, installed date, warranty — enterprise asset management light. |
| **Attendance reason codes** | Employees can tag punches with reason codes (sick, vacation, business trip) | Future enhancement for our enrichment pipeline. |

---

## 1. What "10x Better" Means

### Current State (v0.1)

```text
Device data in system:
  serial_number     ✅
  model             ✅ (in Device model, NOT in API)
  firmware_version  ✅ (in Device model, NOT in API)
  platform          ✅ (in Device model, NOT in API)
  mac_address       ✅ (in Device model, NOT in API)
  ip_address        ✅ (in Device model, NOT in API)
  status            ✅ (Online/Offline/Syncing/Error)
  last_seen         ✅ (in DeviceConnectionState, NOT persisted)
  user_capacity     ✅ (in Device model, NOT in API)
  record_capacity   ✅ (in Device model, NOT in API)
  capacities        ✅ (in Device model, NOT in API)
  counts            ✅ (in Device model, NOT in API)

Device UX:
  List page         ✅ (table with status indicators)
  Add form          ✅ (manual JSON fields)
  Detail page       ❌ (placeholder — just config + status)
  Provisioning      ❌ (curl-only)
  Auto-discovery    ❌ (not implemented)
  Activity history  ❌ (no timeline)
  Storage health    ❌ (not exposed)
  Multi-vendor      ❌ (only ZKTeco)
```

### Target State (v0.3)

```text
Every device has:
  Identity          serial, model, firmware, platform, vendor, MAC, IP, port
  Health            online/offline/syncing/error, last seen, uptime, storage %
  Activity          timeline: connected, disconnected, synced, storage warnings
  Capacity          users (current/max), records (current/max), fingerprints (current/max)
  Configuration     host, port, comm_key, push_enabled, timezone, poll_interval
  Assets            label, location, branch, installed_date, notes
  Provider          ZKTeco / Suprema / Anviz / Hikvision — auto-detected
  Sync status       last sync at, last sync cursor, records pending

UX:
  Add device        App-store-like wizard: discover → test → configure → activate
  Device detail     Full dashboard: health, activity timeline, storage gauge, config panel
  Device list       Search, filter by vendor/status/location, sort, batch actions
  Real-time events  Live status updates via WebSocket
  Export            Device inventory as CSV
```

---

## 2. Domain Model — What Changes

### 2.1 Enriched `Device` Model (`timekeep-core/src/model/device.rs`)

```rust
/// A physical biometric attendance device with full metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    // ── Identity ──────────────────────────────────────────────
    pub serial_number: String,
    pub model: String,
    pub firmware_version: String,
    pub platform: String,
    pub vendor: DeviceVendor,
    pub mac_address: String,
    pub ip_address: String,

    // ── Health ────────────────────────────────────────────────
    pub status: DeviceStatus,
    pub last_seen: Option<Timestamp>,
    pub first_seen: Option<Timestamp>,          // NEW: when device was first discovered
    pub uptime_seconds: Option<u64>,            // NEW: device-reported uptime

    // ── Capacity ──────────────────────────────────────────────
    pub user_capacity: u32,
    pub record_capacity: u32,
    pub fingerprint_capacity: u32,
    pub face_capacity: u32,                     // NEW
    pub palm_capacity: u32,                     // NEW
    pub user_count: u32,
    pub record_count: u32,
    pub fingerprint_count: u32,
    pub face_count: u32,                        // NEW
    pub palm_count: u32,                        // NEW

    // ── Sync ──────────────────────────────────────────────────
    pub last_sync_at: Option<Timestamp>,        // NEW: last successful pull
    pub last_sync_cursor: Option<Timestamp>,    // NEW: resume point for next pull

    // ── Metadata ──────────────────────────────────────────────
    pub label: Option<String>,                  // NEW: human-readable name on the Device itself
    pub location: Option<String>,               // NEW: "HQ Floor 1", "Warehouse B"
    pub branch: Option<String>,                 // NEW: organizational branch
    pub installed_at: Option<Timestamp>,        // NEW: when physically installed
    pub notes: Option<String>,                  // NEW: admin notes
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceVendor {
    ZkTeco,
    Suprema,
    Anviz,
    Hikvision,
    Other(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceStatus {
    Online,
    Offline,
    Syncing,
    Error,
    Provisioning,       // NEW: being set up, not yet active
    Decommissioned,     // NEW: removed from service but history kept
}
```

### 2.2 New Model: `DeviceEvent` (`timekeep-core/src/model/device_event.rs`)

```rust
/// A recorded state change for a device — persisted for timeline/audit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEvent {
    pub id: String,                    // UUID
    pub device_sn: String,
    pub timestamp: Timestamp,
    pub event_type: DeviceEventType,
    pub metadata: HashMap<String, String>,  // extensible KV for event-specific data
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceEventType {
    CameOnline,
    WentOffline { reason: String },    // "timeout", "graceful_shutdown", "network_error"
    SyncStarted,
    SyncCompleted { records_synced: u32 },
    SyncFailed { error: String },
    StorageWarning { records_used: u32, records_capacity: u32, percentage: f64 },
    ConfigChanged { field: String, old_value: Option<String>, new_value: Option<String> },
    ProvisioningStarted,
    ProvisioningCompleted,
    Decommissioned,
    FirmwareUpdated { old_version: String, new_version: String },
}
```

### 2.3 New Model: `ProviderInfo` (`timekeep-core/src/model/provider.rs`)

```rust
/// Describes a device provider that the system knows how to communicate with.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    /// Unique provider key (e.g. "zkteco", "suprema", "anviz")
    pub key: String,
    /// Human-readable name
    pub display_name: String,
    /// Supported capabilities (flags)
    pub capabilities: ProviderCapabilities,
    /// Default connection port
    pub default_port: u16,
    /// Whether this provider supports ADMS push
    pub supports_adms: bool,
    /// Whether this provider supports SDK pull
    pub supports_sdk: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub attendance_read: bool,
    pub attendance_clear: bool,
    pub user_read: bool,
    pub user_write: bool,
    pub user_delete: bool,
    pub device_config_read: bool,
    pub device_config_write: bool,
    pub real_time_events: bool,
    pub fingerprint_enroll: bool,
    pub face_enroll: bool,
}
```

---

## 3. New Storage Operations

### 3.1 Add to `Storage` trait (`timekeep-core/src/traits/storage.rs`)

```rust
// ── Device Events (activity timeline) ─────────────────────────

/// Record a device state change event for the activity timeline.
async fn record_device_event(&self, event: &DeviceEvent) -> Result<(), Error>;

/// Query device events with filter, sort, and pagination.
async fn query_device_events(
    &self,
    filter: &DeviceEventFilter,
) -> Result<ListResult<DeviceEvent>, Error>;

// ── Device Metadata (rich device info) ────────────────────────

/// Upsert the full device info (from get_device_info()).
async fn upsert_device_info(&self, device: &Device) -> Result<(), Error>;

/// Get full device info by serial number.
async fn get_device_info(&self, serial_number: &str) -> Result<Option<Device>, Error>;

// ── Provider Registry ─────────────────────────────────────────

/// Register a provider implementation.
async fn register_provider(&self, provider: &ProviderInfo) -> Result<(), Error>;

/// List all registered providers.
async fn list_providers(&self) -> Result<Vec<ProviderInfo>, Error>;
```

### 3.2 New `DeviceEventFilter`

```rust
#[derive(Debug, Clone)]
pub struct DeviceEventFilter {
    pub params: ListParams,
    pub device_sn: Option<String>,
    pub event_types: Option<Vec<DeviceEventType>>,
    pub since: Option<Timestamp>,
    pub until: Option<Timestamp>,
}
```

---

## 4. New API Endpoints

### 4.1 Device Detail — Rich Response

```
GET /api/devices/{sn}
→ DeviceDetailResponse (expanded)

{
  "serial_number": "CQZ7232960836",
  "label": "Office Entrance",
  "host": "88.201.39.242",
  "port": 4370,
  "comm_key": 0,
  "push_enabled": true,
  "timezone": "Asia/Riyadh",

  // NEW: Identity
  "vendor": "zkteco",
  "model": "Biopro SA40[ID]",
  "firmware_version": "Ver 6.60",
  "platform": "ZLM60_TFT",
  "mac_address": "00:17:61:XX:XX:XX",

  // NEW: Health
  "status": "online",
  "last_seen_at": 1752129600,
  "first_seen_at": 1748600000,
  "uptime_seconds": 1209600,

  // NEW: Capacity
  "user_count": 116,
  "user_capacity": 3000,
  "record_count": 11489,
  "record_capacity": 100000,
  "record_usage_pct": 11.5,
  "fingerprint_count": 402,
  "fingerprint_capacity": 3000,
  "face_count": 0,
  "face_capacity": 0,

  // NEW: Sync
  "last_sync_at": 1752129500,
  "last_sync_cursor": 1752129000,

  // NEW: Connection
  "adms_active": true,
  "sdk_poll_active": true,
  "poll_interval_secs": 60
}
```

### 4.2 Device Activity Timeline

```
GET /api/devices/{sn}/events?event_types=came_online,went_offline&since=1748600000&limit=50
→ PaginatedList<DeviceEventResponse>
```

### 4.3 Device Search

```
GET /api/devices/search?q=SA40&vendor=zkteco&status=online&location=HQ
→ ListResult<DeviceSummary>
```

Filter params: `q` (full-text search across serial/label/model/mac), `vendor`, `status`, `location`, `branch`.

### 4.4 Provider Discovery

```
GET /api/providers
→ List<ProviderInfo>

[{
  "key": "zkteco",
  "display_name": "ZKTeco",
  "default_port": 4370,
  "supports_adms": true,
  "supports_sdk": true,
  "capabilities": {
    "attendance_read": true,
    "user_read": true,
    "user_write": true,
    "fingerprint_enroll": true,
    ...
  }
}]
```

### 4.5 Device Provisioning Wizard

```
POST /api/devices/discover
→ DeviceDiscoverResponse

{
  "ip": "88.201.39.242",
  "port": 4370,
  "reachable": true,
  "vendor": "zkteco",
  "serial_number": "CQZ7232960836",
  "model": "Biopro SA40[ID]",
  "firmware_version": "Ver 6.60",
  "mac_address": "00:17:61:XX:XX:XX",
  "user_count": 116,
  "record_count": 11489
}
```

This is the "test connection" endpoint. It connects to the device at the given IP, probes for vendor, extracts identity, and returns a summary. The admin then confirms to finalize provisioning.

### 4.6 Device Provision (Finalize)

```
POST /api/devices/provision
{
  "serial_number": "CQZ7232960836",
  "label": "Office Entrance",
  "location": "HQ Floor 1",
  "timezone": "Asia/Riyadh",
  "push_enabled": true
}
→ DeviceResponse (201)
```

### 4.7 Device Health Summary

```
GET /api/devices/health
→ DeviceHealthSummary

{
  "total": 3,
  "online": 2,
  "offline": 1,
  "syncing": 0,
  "errors": 0,
  "devices": [
    { "sn": "...", "status": "online", "record_usage_pct": 11.5, "last_seen_at": ... }
  ]
}
```

### 4.8 Batch Device Actions

```
POST /api/devices/batch
{
  "action": "sync_now",     // sync_now | enable | disable | restart | set_time
  "device_sns": ["SN1", "SN2"]
}
→ BatchActionResponse
```

---

## 5. Backend Architecture — Provider Registry Pattern

### 5.1 The Problem

Currently, `main.rs` hardcodes `timekeep_zkteco::ZkTecoDevice`. Adding Suprema means:

1. Adding a `suprema` crate
2. Wiring it in `main.rs`
3. Recompiling

### 5.2 The Solution: Provider Registry

```rust
// timekeep-core/src/traits/provider_registry.rs

/// A factory that creates BiometricDevice instances for a given vendor.
#[async_trait]
pub trait DeviceProvider: Send + Sync {
    /// The vendor key this provider handles (e.g. "zkteco", "suprema").
    fn vendor_key(&self) -> &str;

    /// The provider's capabilities.
    fn capabilities(&self) -> ProviderCapabilities;

    /// Create a new device instance from config + event bus.
    async fn create_device(
        &self,
        config: DeviceConfig,
        event_bus: EventBus,
    ) -> Result<Box<dyn BiometricDevice>, Error>;

    /// Probe an IP:port to detect if this vendor's device is at that address.
    async fn probe(&self, host: &str, port: u16) -> Result<DeviceProbe, Error>;
}

/// Result of probing a device.
pub struct DeviceProbe {
    pub vendor: String,
    pub serial_number: String,
    pub model: String,
    pub firmware_version: String,
    pub mac_address: String,
    pub user_count: u32,
    pub record_count: u32,
}
```

```rust
// timekeep-core/src/provider_registry.rs (or timekeep-core/src/traits/mod.rs)

/// Registry that maps vendor keys to their provider implementations.
pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn DeviceProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self { ... }
    pub fn register(&mut self, provider: Arc<dyn DeviceProvider>) { ... }
    pub fn get(&self, vendor: &str) -> Option<&Arc<dyn DeviceProvider>> { ... }
    pub fn list(&self) -> Vec<&dyn DeviceProvider> { ... }

    /// Probe all registered providers against an IP to auto-detect the vendor.
    pub async fn probe(&self, host: &str, port: u16) -> Result<DeviceProbe, Error> { ... }
}
```

### 5.3 Wiring in `main.rs`

```rust
// Instead of hardcoding ZkTecoDevice:
let mut registry = ProviderRegistry::new();
registry.register(Arc::new(ZkTecoProvider::new()));

// For each device config:
let provider = registry.get(&config.vendor)
    .ok_or_else(|| format!("no provider for vendor: {}", config.vendor))?;
let device = provider.create_device(config, event_bus.clone()).await?;
```

---

## 6. New Events (extend `DomainEvent`)

```rust
pub enum DomainEvent {
    // ... existing ...

    /// A device was probed and identified (step 1 of provisioning).
    DeviceDiscovered { probe: DeviceProbe },

    /// A device completed provisioning and is now active.
    DeviceProvisioned { device_sn: String, provider: String },

    /// A device completed a successful sync cycle.
    DeviceSyncCompleted {
        device_sn: String,
        records_synced: u32,
        duration_ms: u64,
    },

    /// A device sync failed.
    DeviceSyncFailed { device_sn: String, error: String },

    /// Device configuration was changed via the API.
    DeviceConfigChanged {
        device_sn: String,
        changed_fields: Vec<String>,
    },

    /// Device storage warning (extracted from existing DeviceStorageWarning).
    // Already exists as DeviceStorageWarning — but should be PERSISTED.
}
```

---

## 7. Engine Changes

### 7.1 Persist Device Events

The engine already emits `DeviceOnline`, `DeviceOffline`, `DeviceStorageWarning`. These must be **persisted** via `Storage::record_device_event()` so the activity timeline is queryable.

```rust
// In engine/src/handlers/:
async fn handle_device_online(event: &DomainEvent, storage: &dyn Storage) {
    if let DomainEvent::DeviceOnline { device_sn, device_info } = event {
        storage.upsert_device_info(device_info).await?;
        storage.record_device_event(&DeviceEvent {
            id: Uuid::new_v4().to_string(),
            device_sn: device_sn.clone(),
            timestamp: Timestamp::now(),
            event_type: DeviceEventType::CameOnline,
            metadata: HashMap::new(),
        }).await?;
    }
}
```

### 7.2 Device Health Monitor

```rust
// timekeep-engine/src/monitor.rs

/// Periodically checks all registered devices for health:
/// - Updates DeviceConnectionState based on last activity
/// - Emits DeviceOffline if threshold exceeded
/// - Checks storage capacity, emits DeviceStorageWarning if > 80%
pub struct DeviceMonitor {
    storage: Arc<dyn Storage>,
    event_bus: EventBus,
    online_threshold: Duration,    // default: 2 minutes
    storage_warning_pct: f64,      // default: 0.8
}

impl DeviceMonitor {
    pub async fn run(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            let devices = self.storage.list_device_configs().await.unwrap_or_default();
            for config in &devices {
                // Check online/offline
                // Check storage capacity
                // Emit events as needed
            }
        }
    }
}
```

---

## 8. Database Schema Changes

### 8.1 New Table: `device_events`

```sql
CREATE TABLE IF NOT EXISTS device_events (
    id          TEXT PRIMARY KEY,
    device_sn   TEXT NOT NULL REFERENCES device_configs(serial_number),
    timestamp   INTEGER NOT NULL,
    event_type  TEXT NOT NULL,
    metadata    TEXT,  -- JSON blob for event-specific data
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_device_events_sn_time ON device_events(device_sn, timestamp);
CREATE INDEX idx_device_events_type ON device_events(event_type, timestamp);
```

### 8.2 New Table: `device_info`

```sql
CREATE TABLE IF NOT EXISTS device_info (
    serial_number       TEXT PRIMARY KEY REFERENCES device_configs(serial_number),
    vendor              TEXT NOT NULL DEFAULT 'zkteco',
    model               TEXT NOT NULL DEFAULT '',
    firmware_version    TEXT NOT NULL DEFAULT '',
    platform            TEXT NOT NULL DEFAULT '',
    mac_address         TEXT NOT NULL DEFAULT '',
    ip_address          TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'offline',
    last_seen           INTEGER,
    first_seen          INTEGER,
    uptime_seconds      INTEGER,
    user_capacity       INTEGER NOT NULL DEFAULT 0,
    record_capacity     INTEGER NOT NULL DEFAULT 0,
    fingerprint_capacity INTEGER NOT NULL DEFAULT 0,
    face_capacity       INTEGER NOT NULL DEFAULT 0,
    palm_capacity       INTEGER NOT NULL DEFAULT 0,
    user_count          INTEGER NOT NULL DEFAULT 0,
    record_count        INTEGER NOT NULL DEFAULT 0,
    fingerprint_count   INTEGER NOT NULL DEFAULT 0,
    face_count          INTEGER NOT NULL DEFAULT 0,
    palm_count          INTEGER NOT NULL DEFAULT 0,
    last_sync_at        INTEGER,
    last_sync_cursor    INTEGER,
    label               TEXT,
    location            TEXT,
    branch              TEXT,
    installed_at        INTEGER,
    notes               TEXT,
    updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 8.3 New Table: `providers`

```sql
CREATE TABLE IF NOT EXISTS providers (
    key                 TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    default_port        INTEGER NOT NULL,
    supports_adms       INTEGER NOT NULL DEFAULT 0,
    supports_sdk        INTEGER NOT NULL DEFAULT 0,
    capabilities_json   TEXT NOT NULL DEFAULT '{}',
    enabled             INTEGER NOT NULL DEFAULT 1,
    created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 8.4 Extend: `device_configs`

```sql
ALTER TABLE device_configs ADD COLUMN vendor TEXT NOT NULL DEFAULT 'zkteco';
ALTER TABLE device_configs ADD COLUMN location TEXT DEFAULT NULL;
ALTER TABLE device_configs ADD COLUMN poll_interval_secs INTEGER DEFAULT NULL;
```

---

## 9. Frontend Architecture

### 9.1 New Pages

```
/dashboard                     ✅ Done — today's summary
/devices                       ✅ Done — device list table
/devices/new                   🔴 NEW — provisioning wizard (Step 1: enter IP)
/devices/new/discover          🔴 NEW — provisioning wizard (Step 2: test connection)
/devices/new/configure         🔴 NEW — provisioning wizard (Step 3: configure)
/devices/{sn}                  🔴 NEW — device detail (full dashboard)
/devices/{sn}/activity         🔴 NEW — device activity timeline
/devices/{sn}/config           🔴 NEW — device configuration panel
/devices/{sn}/users            🔴 NEW — device user list
/devices/{sn}/punches          🔴 NEW — device-specific punches (filtered)
/punches                        ✅ Done
/reports                        ✅ Done
/settings                       ✅ Done
/settings/providers             🔴 NEW — provider management
```

### 9.2 Provisioning Wizard — UX Flow (App-Store-Like)

```
Step 1: Enter Device IP
┌────────────────────────────────────────────────┐
│  Add New Device                                │
│                                                │
│  Enter the IP address of your biometric        │
│  scanner to begin setup.                       │
│                                                │
│  Host / IP:  [________________]                │
│  Port:       [4370]                            │
│                                                │
│  [Discover Device]                             │
└────────────────────────────────────────────────┘

Step 2: Device Identified (auto-detected)
┌────────────────────────────────────────────────┐
│  ✅ Device Found                                │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 🖥️ Biopro SA40[ID]                       │  │
│  │ Vendor: ZKTeco                           │  │
│  │ Serial:  CQZ7232960836                    │  │
│  │ Firmware: Ver 6.60                        │  │
│  │ MAC:      00:17:61:XX:XX:XX               │  │
│  │ Users:    116 enrolled                     │  │
│  │ Records:  11,489 stored                    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [← Back]    [Configure →]                     │
└────────────────────────────────────────────────┘

Step 3: Configure
┌────────────────────────────────────────────────┐
│  Configure CQZ7232960836                        │
│                                                │
│  Label:      [Office Entrance          ]       │
│  Location:   [HQ Floor 1               ]       │
│  Timezone:   [Asia/Riyadh         ▼    ]       │
│  Comm Key:   [0                       ]       │
│  ADMS Push:  [✓ Enabled]                       │
│  Sync Every: [60 seconds              ]       │
│                                                │
│  [← Back]    [Activate Device →]               │
└────────────────────────────────────────────────┘

Step 4: Confirmation
┌────────────────────────────────────────────────┐
│  🎉 Device Activated!                           │
│                                                │
│  Office Entrance is now collecting attendance.  │
│  Real-time events are flowing.                  │
│                                                │
│  [View Device]    [Add Another]                 │
└────────────────────────────────────────────────┘
```

### 9.3 Device Detail Page — Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Devices          Office Entrance             │
│                           CQZ7232960836    🟢 Online     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────┐ │
│  │ Users        │ │ Records     │ │ Storage     │ │ FW │ │
│  │ 116 / 3000   │ │ 11,489      │ │ 11.5% used  │ │6.60│ │
│  │ 3.9% used    │ │ +27/day     │ │ 88,511 free │ │    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Activity Timeline                                │   │
│  │                                                  │   │
│  │ 🟢 14:32  Came online                            │   │
│  │ 🔄 14:30  Sync completed (+27 records, 1.2s)     │   │
│  │ 🔴 14:28  Went offline (timeout)                 │   │
│  │ 🟢 10:15  Came online                            │   │
│  │ ⚙️ 10:14  Config changed (push_enabled)          │   │
│  │ 🔄 10:14  Sync completed (+3 records, 0.4s)      │   │
│  │   ...     12 more events                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ Device Info  │ │ Config       │ │ Users on     │    │
│  │ tab          │ │ tab          │ │ Device tab   │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 9.4 New Frontend Molecules

| Component | Purpose | Files |
|-----------|---------|-------|
| `DeviceHealthCard` | Metric card with icon, value, capacity bar | `modules/devices/components/device-health-card.tsx` |
| `DeviceActivityTimeline` | Scrollable event timeline | `modules/devices/components/device-activity-timeline.tsx` |
| `DeviceConfigPanel` | Editable config form in card | `modules/devices/components/device-config-panel.tsx` |
| `ProvisionWizard` | Multi-step modal/section for provisioning | `modules/devices/components/provision-wizard.tsx` |
| `DeviceStatusBadge` | Rich status badge (online/offline/syncing/error/provisioning) | `modules/devices/components/device-status-badge.tsx` |
| `StorageGauge` | Circular/donut gauge for storage % | `components/ui/chart/storage-gauge.tsx` |
| `ProviderCard` | Provider info card for settings page | `modules/settings/components/provider-card.tsx` |

### 9.5 New Hooks

| Hook | Purpose |
|------|---------|
| `useDeviceDetail(sn)` | Fetch full device detail via TanStack Query |
| `useDeviceEvents(sn, filter)` | Fetch device activity timeline |
| `useDeviceHealth()` | Fetch health summary for all devices |
| `useProviders()` | Fetch registered providers |
| `useDeviceDiscover(host, port)` | Mutation for probing a device |
| `useDeviceProvision()` | Mutation for finalizing provisioning |
| `useDeviceBatchAction()` | Mutation for batch sync/enable/disable/restart |

---

## 10. Implementation Phases

### Phase 1 — Backend Foundation (3-4 days)

| # | Task | Crate | Effort |
|---|------|-------|--------|
| 1.1 | Extend `Device` model with new fields | `timekeep-core` | 1h |
| 1.2 | Create `DeviceEvent` + `DeviceEventType` models | `timekeep-core` | 0.5h |
| 1.3 | Create `ProviderInfo` + `ProviderCapabilities` models | `timekeep-core` | 0.5h |
| 1.4 | Extend `Storage` trait: device events, device info, providers | `timekeep-core` | 1h |
| 1.5 | Implement new storage methods in SQLite backend | `timekeep-storage-sqlite` | 2h |
| 1.6 | Implement new storage methods in PostgreSQL backend | `timekeep-storage-postgres` | 2h |
| 1.7 | Add DB migrations for new tables + columns | both storage crates | 1h |
| 1.8 | Create `ProviderRegistry` + `DeviceProvider` trait | `timekeep-core` | 2h |
| 1.9 | Implement `ZkTecoProvider` (wrapping ZkTecoDevice factory) | `timekeep-zkteco` | 2h |
| 1.10 | Add `DeviceDiscovered`, `DeviceProvisioned`, `DeviceSyncCompleted`, `DeviceSyncFailed` events | `timekeep-core` | 0.5h |
| 1.11 | Persistent device event handler in engine | `timekeep-engine` | 2h |
| 1.12 | Device monitor (online/offline detection + storage warning) | `timekeep-engine` | 2h |
| 1.13 | Wire provider registry in `main.rs` (replace hardcoded ZkTecoDevice) | `timekeep` | 1.5h |
| | **Subtotal** | | **18h** |

### Phase 2 — API Layer (2-3 days)

| # | Task | Crate | Effort |
|---|------|-------|--------|
| 2.1 | Expanded `DeviceDetailResponse` DTO | `timekeep-api` | 1h |
| 2.2 | `GET /api/devices/{sn}` → rich detail (with device info + connection state) | `timekeep-api` | 1.5h |
| 2.3 | `GET /api/devices/{sn}/events` → activity timeline | `timekeep-api` | 1h |
| 2.4 | `GET /api/devices/search` → enhanced search with filters | `timekeep-api` | 1.5h |
| 2.5 | `GET /api/providers` → provider list | `timekeep-api` | 0.5h |
| 2.6 | `POST /api/devices/discover` → probe device | `timekeep-api` | 2h |
| 2.7 | `POST /api/devices/provision` → finalize provisioning | `timekeep-api` | 1.5h |
| 2.8 | `GET /api/devices/health` → health summary | `timekeep-api` | 1h |
| 2.9 | `POST /api/devices/batch` → batch actions | `timekeep-api` | 2h |
| 2.10 | Add `PUT /api/devices/{sn}/config` → structured config update | `timekeep-api` | 1h |
| 2.11 | Integration tests for all new endpoints | `timekeep-api` | 3h |
| | **Subtotal** | | **16h** |

### Phase 3 — Frontend Foundation (2-3 days)

| # | Task | Effort |
|---|------|--------|
| 3.1 | `DeviceHealthCard` component | 1.5h |
| 3.2 | `DeviceStatusBadge` component (with provisioning state) | 1h |
| 3.3 | `StorageGauge` component (circular gauge) | 1.5h |
| 3.4 | `DeviceActivityTimeline` component | 2h |
| 3.5 | `DeviceConfigPanel` component (read/edit) | 2h |
| 3.6 | New API client functions for new endpoints | 1.5h |
| 3.7 | New TanStack Query hooks (useDeviceDetail, useDeviceEvents, etc.) | 2h |
| 3.8 | New Jotai atoms for device state | 1h |
| | **Subtotal** | **12.5h** |

### Phase 4 — Frontend Pages (3-4 days)

| # | Task | Effort |
|---|------|--------|
| 4.1 | Device Detail page (`/devices/{sn}`) — full dashboard layout | 4h |
| 4.2 | Device Activity page (`/devices/{sn}/activity`) | 2h |
| 4.3 | Device Config page (`/devices/{sn}/config`) | 2h |
| 4.4 | Device Users page (`/devices/{sn}/users`) | 2h |
| 4.5 | Provisioning Wizard — Step 1 (Enter IP) | 1.5h |
| 4.6 | Provisioning Wizard — Step 2 (Discovery result) | 1.5h |
| 4.7 | Provisioning Wizard — Step 3 (Configure) | 2h |
| 4.8 | Provisioning Wizard — Step 4 (Confirmation) | 1h |
| 4.9 | Enhanced Device List page (add filters, vendor column, richer status) | 3h |
| 4.10 | Provider settings page | 2h |
| 4.11 | MSW handlers for new endpoints | 2h |
| 4.12 | Tests for device components and pages | 3h |
| | **Subtotal** | **26h** |

### Phase 5 — Polish & Real-Time (2 days)

| # | Task | Effort |
|---|------|--------|
| 5.1 | WebSocket integration for live device status updates | 2h |
| 5.2 | i18n for all new strings (EN + AR) | 3h |
| 5.3 | Responsive pass on device detail page | 2h |
| 5.4 | E2E tests (Playwright): provisioning flow, device detail, batch actions | 3h |
| 5.5 | Stories for new components (optional) | 2h |
| | **Subtotal** | **12h** |

---

## 11. Total Estimate

| Phase | Effort |
|-------|--------|
| Phase 1 — Backend Foundation | ~18h (3-4 days) |
| Phase 2 — API Layer | ~16h (2-3 days) |
| Phase 3 — Frontend Foundation | ~12.5h (2-3 days) |
| Phase 4 — Frontend Pages | ~26h (3-4 days) |
| Phase 5 — Polish & Real-Time | ~12h (2 days) |
| **Total** | **~84.5h (12-16 days)** |

---

## 12. Architecture Decision Records Needed

| ADR | Decision |
|-----|----------|
| ADR-006 | Provider Registry pattern (why factory trait, not compile-time features) |
| ADR-007 | Device event persistence (why store events, not compute from state) |
| ADR-008 | Device provisioning flow (why multi-step wizard, not single form) |

---

## 13. Cross-Cutting Concerns

### 13.1 Vendor Lock-In Prevention

Every design decision must be tested against: **"Can a company replace ZKTeco with Suprema in 1 hour?"**

- ✅ Provider registry: swap implementation, not rewrite
- ✅ Device model: vendor-agnostic fields (not ZKTeco-specific)
- ✅ API: no vendor-specific endpoints (all devices use the same `/api/devices/*`)
- ✅ DB schema: `device_info` table is vendor-agnostic
- ✅ Event model: domain events are vendor-agnostic

### 13.2 Offline-First Data

- Devices buffer punches when network is down (device-level, already works)
- SDK pull catches up on reconnect (already implemented)
- Device offline events are persisted so timeline is complete
- Storage warning thresholds prevent data loss before it happens

### 13.3 Security

- `comm_key` is currently exposed in API responses (plain `u32`). Consider `#[serde(skip)]` for read responses.
- Device discovery should be rate-limited (prevent network scanning abuse)
- Batch operations should be admin-only

### 13.4 Observability

- Every new API endpoint gets OTel spans
- Device events feed into Prometheus metrics (device_online, device_offline, sync_duration_seconds)
- Health endpoint shows per-device status

---

## 14. What We Don't Build (Yet)

| Feature | Reason |
|---------|--------|
| UDP auto-discovery | Complex, platform-specific. Phase 5+. |
| Fingerprint template sync | Privacy risk, vendor-locked format. Explicit non-goal. |
| Door/access control | Separate bounded context. |
| Multi-site federation | P3 — future differentiator. |
| IP camera snapshot correlation | P3 — requires camera integration. |
| Anomaly detection (buddy punching) | P3 — needs shift schedules first. |

---

## 15. File Manifest (What Gets Created/Modified)

### New Files

```
crates/
  timekeep-core/src/
    model/
      device_event.rs          ← NEW
      provider.rs              ← NEW
    traits/
      provider_registry.rs     ← NEW (DeviceProvider trait + ProviderRegistry)
    provider_registry.rs       ← NEW (ProviderRegistry impl)

docs/adr/
  006-provider-registry.md     ← NEW
  007-device-event-persistence.md ← NEW
  008-device-provisioning-flow.md ← NEW
```

### Modified Files

```
crates/
  timekeep-core/src/
    model/
      device.rs                ← EXTEND (new fields, DeviceVendor, new status variants)
      mod.rs                   ← EXTEND (re-export new types)
    traits/
      storage.rs               ← EXTEND (new trait methods, new filters)
      mod.rs                   ← EXTEND (new trait)
    events/
      domain_events.rs         ← EXTEND (new event variants)
  timekeep-storage-sqlite/
    src/lib.rs                 ← EXTEND (new method impls, migrations)
  timekeep-storage-postgres/
    src/lib.rs                 ← EXTEND (new method impls, migrations)
  timekeep-zkteco/
    src/lib.rs                 ← EXTEND (ZkTecoProvider impl, probe())
  timekeep-engine/
    src/
      handlers/                ← NEW/EXTEND (persist device events)
      lib.rs                   ← EXTEND (device event handling)
      monitor.rs               ← NEW (DeviceMonitor)
  timekeep-api/
    src/
      lib.rs                   ← EXTEND (new routes)
      dto.rs                   ← EXTEND (new response types)
      request.rs               ← EXTEND (new request types)
      devices.rs               ← NEW (extract device handlers from lib.rs)
  timekeep/
    src/
      main.rs                  ← EXTEND (provider registry wiring)

dashboard/src/
  modules/devices/
    components/
      device-health-card.tsx    ← NEW
      device-activity-timeline.tsx ← NEW
      device-config-panel.tsx   ← NEW
      provision-wizard.tsx      ← NEW
      device-status-badge.tsx   ← NEW
    hooks/
      use-device-detail.ts      ← NEW
      use-device-events.ts      ← NEW
      use-device-health.ts      ← NEW
      use-providers.ts          ← NEW
      use-device-discover.ts    ← NEW
      use-device-provision.ts   ← NEW
    pages/
      DeviceDetailPage.tsx      ← NEW
      DeviceActivityPage.tsx    ← NEW
      DeviceConfigPage.tsx      ← NEW
      DeviceUsersPage.tsx       ← NEW
      ProvisionWizardPage.tsx   ← NEW
    schemas/
      device-schemas.ts         ← NEW (Zod schemas for provision/config forms)
  components/ui/
    chart/
      storage-gauge.tsx         ← NEW
  lib/
    api.ts                      ← EXTEND (new API functions)
```

---

## 16. Success Criteria

A new IT admin with zero prior knowledge should be able to:

1. Open the dashboard
2. Click "Add Device"
3. Enter their scanner's IP address
4. See the device auto-identified (model, firmware, existing users)
5. Set a label and timezone
6. Click "Activate"
7. See real-time punches flowing on the dashboard

**The entire flow must take under 60 seconds and feel like installing an app on a phone.**

After activation, the admin should be able to:

- See complete device information on one page (identity, health, capacity, sync status)
- View the device's activity timeline (when it went online/offline, sync completions, storage warnings)
- Edit device configuration from the UI
- See which users are enrolled on the device
- Filter punches by device
- Get notified when a device goes offline or storage is near capacity
