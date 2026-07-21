//! Application state and device connection tracking.

use std::collections::HashMap;
use std::sync::Arc;

use timekeep_core::traits::sync_provider::SyncProvider;
use timekeep_core::{ProviderRegistry, events::EventBus, traits::Storage};
use timekeep_engine::health::EngineHealth;
use tokio::sync::Mutex as TokioMutex;

// ── Device Connection State ─────────────────────────────────────────

/// Tracks which devices are currently connected and how.
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
    pub async fn get_all(&self) -> HashMap<String, DeviceConnInfo> {
        self.inner.lock().await.clone()
    }

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

    pub async fn set_disconnected(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        if let Some(entry) = guard.get_mut(sn) {
            entry.adms_active = false;
            entry.sdk_active = false;
            entry.last_seen = ts;
        }
    }

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

    pub async fn get(&self, sn: &str) -> Option<DeviceConnInfo> {
        self.inner.lock().await.get(sn).cloned()
    }
}

/// Type alias for the sync provider registry.
pub type SyncProviderRegistry = Arc<TokioMutex<HashMap<String, Arc<dyn SyncProvider>>>>;

// ── AppState ────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub event_bus: EventBus,
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    pub onboarding: Option<Arc<dyn timekeep_core::OnboardingSessionStore>>,
    pub search: Option<Arc<dyn timekeep_core::SearchStore>>,
    pub jwt_secret: String,
    pub admin_user: String,
    pub admin_password: String,
    pub api_key: String,
    pub device_state: DeviceConnectionState,
    pub provider_registry: Arc<ProviderRegistry>,
    pub engine_health: EngineHealth,
    /// Registered sync providers (e.g. Odoo, SAP). Keyed by provider key.
    pub sync_providers: SyncProviderRegistry,
}
