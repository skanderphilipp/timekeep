//! Provider registry — maps vendor keys to provider implementations.
//!
//! The registry is the runtime component that routes device creation and
//! probing to the correct vendor-specific `DeviceProvider`.
//!
//! ## Zero Vendor Lock-In
//!
//! Adding a new vendor means:
//! 1. Implement `DeviceProvider` trait
//! 2. Register it via `ProviderRegistry::register()`
//! 3. Device configs set `vendor: "suprema"` — engine routes automatically

use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;

use crate::Error;
use crate::model::{DeviceProbe, ProviderInfo};
use crate::traits::DeviceProvider;

/// Registry that maps vendor keys to their provider implementations.
///
/// Created once at startup and shared across the application.
/// Thread-safe — all methods take `&self`.
pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn DeviceProvider>>,
}

impl ProviderRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self { providers: HashMap::new() }
    }

    /// Register a provider for a specific vendor.
    ///
    /// If a provider with the same key already exists, it is overwritten
    /// (useful for reloading or testing).
    pub fn register(&mut self, provider: Arc<dyn DeviceProvider>) {
        let key = provider.vendor_key().to_string();
        tracing::info!(
            vendor = %key,
            display_name = %provider.display_name(),
            "provider registered"
        );
        self.providers.insert(key, provider);
    }

    /// Get a provider by vendor key.
    pub fn get(&self, vendor: &str) -> Option<&Arc<dyn DeviceProvider>> {
        self.providers.get(vendor)
    }

    /// List all registered providers with their info.
    pub fn list(&self) -> Vec<ProviderInfo> {
        self.providers
            .values()
            .map(|p| ProviderInfo {
                key: p.vendor_key().to_string(),
                display_name: p.display_name().to_string(),
                default_port: p.default_port(),
                supports_adms: p.supports_adms(),
                supports_sdk: p.supports_sdk(),
                capabilities: p.capabilities(),
                enabled: true,
            })
            .collect()
    }

    /// Probe all registered providers against an IP to auto-detect the vendor.
    ///
    /// Tries each provider's `probe()` in sequence. The first provider that
    /// successfully identifies the device wins. If no provider recognizes
    /// the device, returns a not-found error.
    pub async fn probe_all(&self, host: &str, port: u16) -> Result<DeviceProbe, Error> {
        let providers: Vec<_> = self.providers.values().collect();

        if providers.is_empty() {
            return Err(Error::not_found("no providers registered"));
        }

        for provider in &providers {
            match provider.probe(host, port).await {
                Ok(probe) => {
                    tracing::info!(
                        vendor = %probe.vendor,
                        serial = %probe.serial_number,
                        host = %host,
                        port = port,
                        "device identified"
                    );
                    return Ok(probe);
                },
                Err(e) => {
                    tracing::debug!(
                        vendor = %provider.vendor_key(),
                        host = %host,
                        error = %e,
                        "probe failed for provider"
                    );
                },
            }
        }

        Err(Error::not_found(format!("no provider recognized device at {host}:{port}")))
    }

    /// Scan a subnet for biometric devices.
    ///
    /// Performs a TCP connect scan on the given port across all hosts in
    /// the subnet, then probes responsive hosts with all registered providers
    /// to identify vendor and extract device identity.
    ///
    /// See [`crate::network_scanner::scan_subnet`] for subnet format details.
    pub async fn scan_subnet(
        &self,
        subnet: &str,
        port: u16,
    ) -> Result<Vec<crate::model::DeviceProbe>, Error> {
        let providers: Vec<_> = self.providers.values().cloned().collect();
        if providers.is_empty() {
            return Err(Error::not_found("no providers registered for scanning"));
        }

        let hosts = crate::network_scanner::parse_subnet(subnet)?;
        if hosts.is_empty() {
            return Err(Error::validation(format!("no hosts to scan in subnet '{subnet}'")));
        }

        tracing::info!(
            subnet = %subnet,
            port = port,
            host_count = hosts.len(),
            "starting network scan"
        );

        let semaphore = Arc::new(tokio::sync::Semaphore::new(64));
        let mut handles = Vec::with_capacity(hosts.len());

        for host in hosts {
            let providers = providers.clone();
            let sem = Arc::clone(&semaphore);
            let handle = tokio::spawn(async move {
                let _permit = sem.acquire().await;
                scan_and_probe(&host, port, &providers).await
            });
            handles.push(handle);
        }

        let mut discovered = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Some(probe)) => discovered.push(probe),
                Ok(None) => {},
                Err(e) => tracing::debug!(error = %e, "scan task panicked"),
            }
        }

        tracing::info!(discovered = discovered.len(), "network scan complete");
        Ok(discovered)
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Scan a single host: TCP connect → if successful, probe with all providers.
async fn scan_and_probe(
    host: &str,
    port: u16,
    providers: &[Arc<dyn DeviceProvider>],
) -> Option<crate::model::DeviceProbe> {
    let addr_str = format!("{host}:{port}");
    let addr: SocketAddr = match addr_str.to_socket_addrs().ok().and_then(|mut a| a.next()) {
        Some(a) => a,
        None => return None,
    };

    // Quick TCP connect with 1-second timeout
    let connected = tokio::time::timeout(Duration::from_secs(1), async {
        TcpStream::connect_timeout(&addr, Duration::from_millis(500))
    })
    .await
    .ok()
    .and_then(|r| r.ok())
    .is_some();

    if !connected {
        return None;
    }

    // Try each provider to identify the device
    for provider in providers {
        match provider.probe(host, port).await {
            Ok(probe) => {
                tracing::info!(
                    host = %host,
                    vendor = %probe.vendor,
                    serial = %probe.serial_number,
                    "device discovered"
                );
                return Some(probe);
            },
            Err(e) => {
                tracing::debug!(
                    host = %host,
                    vendor = %provider.vendor_key(),
                    error = %e,
                    "probe failed"
                );
            },
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BiometricDevice;
    use crate::events::EventBus;
    use crate::model::{DeviceConfig, DeviceProbe, ProviderCapabilities};
    use async_trait::async_trait;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// A minimal test provider that returns canned data.
    struct TestProvider {
        key: String,
        probe_works: AtomicBool,
    }

    impl TestProvider {
        fn new(key: &str, probe_works: bool) -> Self {
            Self { key: key.to_string(), probe_works: AtomicBool::new(probe_works) }
        }
    }

    #[async_trait]
    impl DeviceProvider for TestProvider {
        fn vendor_key(&self) -> &str {
            &self.key
        }
        fn display_name(&self) -> &str {
            "Test Provider"
        }
        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities::default()
        }
        fn default_port(&self) -> u16 {
            1234
        }
        fn supports_adms(&self) -> bool {
            false
        }
        fn supports_sdk(&self) -> bool {
            true
        }
        async fn create_device(
            &self,
            _config: DeviceConfig,
            _event_bus: EventBus,
        ) -> Result<Box<dyn BiometricDevice>, Error> {
            Err(Error::internal("not implemented in test"))
        }
        async fn probe(&self, host: &str, _port: u16) -> Result<DeviceProbe, Error> {
            if self.probe_works.load(Ordering::Relaxed) {
                Ok(DeviceProbe {
                    vendor: self.key.clone(),
                    serial_number: format!("{host}-serial"),
                    model: "Test Model".into(),
                    firmware_version: "1.0".into(),
                    platform: "test".into(),
                    mac_address: "00:00:00:00:00:00".into(),
                    user_count: 0,
                    record_count: 0,
                })
            } else {
                Err(Error::device("probe failed"))
            }
        }
    }

    #[test]
    fn test_registry_register_and_get() {
        let mut reg = ProviderRegistry::new();
        reg.register(Arc::new(TestProvider::new("test", true)));

        assert!(reg.get("test").is_some());
        assert!(reg.get("nonexistent").is_none());
    }

    #[test]
    fn test_registry_list() {
        let mut reg = ProviderRegistry::new();
        reg.register(Arc::new(TestProvider::new("alpha", true)));
        reg.register(Arc::new(TestProvider::new("beta", false)));

        let list = reg.list();
        assert_eq!(list.len(), 2);
        let keys: Vec<_> = list.iter().map(|p| p.key.clone()).collect();
        assert!(keys.contains(&"alpha".to_string()));
        assert!(keys.contains(&"beta".to_string()));
    }

    #[tokio::test]
    async fn test_probe_all_finds_matching_provider() {
        let mut reg = ProviderRegistry::new();
        reg.register(Arc::new(TestProvider::new("failing", false)));
        reg.register(Arc::new(TestProvider::new("matching", true)));

        let result = reg.probe_all("10.0.0.1", 1234).await.unwrap();
        assert_eq!(result.vendor, "matching");
        assert_eq!(result.serial_number, "10.0.0.1-serial");
    }

    #[tokio::test]
    async fn test_probe_all_no_match() {
        let mut reg = ProviderRegistry::new();
        reg.register(Arc::new(TestProvider::new("failing", false)));

        let result = reg.probe_all("10.0.0.99", 1234).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_probe_all_empty_registry() {
        let reg = ProviderRegistry::new();
        let result = reg.probe_all("10.0.0.1", 1234).await;
        assert!(result.is_err());
    }
}
