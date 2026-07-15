//! Application state and device connection tracking.

use std::collections::HashMap;
use std::sync::Arc;

use timekeep_core::{ProviderRegistry, events::EventBus, traits::Storage};
use timekeep_engine::health::EngineHealth;
use tokio::sync::Mutex as TokioMutex;

/// Tracks which devices are currently connected and how.
/// Built by subscribing to DeviceOnline/DeviceOffline events.
#[derive(Clone, Default)]
pub struct DeviceConnectionState {
    inner: Arc<TokioMutex<HashMap<String, DeviceConnInfo>>>,
}

#[derive(Clone)]
pub struct DeviceConnInfo {
    pub adms_active: bool,
    pub sdk_active: bool,
    pub last_seen: i64,
    pub last_poll: Option<i64>,
}

impl DeviceConnectionState {
    /// Get all device connection states (for dashboard overview).
    pub async fn get_all(&self) -> HashMap<String, DeviceConnInfo> {
        self.inner.lock().await.clone()
    }

    /// Mark a device as connected via ADMS push.
    pub async fn set_adms_connected(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        let entry = guard.entry(sn.to_string()).or_insert(DeviceConnInfo {
            adms_active: false,
            sdk_active: false,
            last_seen: ts,
            last_poll: None,
        });
        entry.adms_active = true;
        entry.last_seen = ts;
    }

    /// Mark a device as disconnected.
    pub async fn set_disconnected(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        if let Some(entry) = guard.get_mut(sn) {
            entry.adms_active = false;
            entry.sdk_active = false;
            entry.last_seen = ts;
        }
    }

    /// Mark SDK poll success.
    pub async fn set_sdk_polled(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        let entry = guard.entry(sn.to_string()).or_insert(DeviceConnInfo {
            adms_active: false,
            sdk_active: false,
            last_seen: ts,
            last_poll: None,
        });
        entry.sdk_active = true;
        entry.last_seen = ts;
        entry.last_poll = Some(ts);
    }

    /// Get connection info for a device.
    pub async fn get(&self, sn: &str) -> Option<DeviceConnInfo> {
        self.inner.lock().await.get(sn).cloned()
    }
}

#[derive(Clone)]
pub struct AppState {
    pub event_bus: EventBus,
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    pub jwt_secret: String,
    pub admin_user: String,
    pub admin_password: String,
    pub api_key: String,
    pub device_state: DeviceConnectionState,
    pub provider_registry: Arc<ProviderRegistry>,
    pub engine_health: EngineHealth,
}
