//! Network scanner — discovers biometric devices on the local network.
//!
//! Uses TCP connect scanning on the standard ZKTeco port (4370) to find
//! devices, then probes each responsive host to identify vendor and extract
//! device identity. Works across any vendor that listens on a known port.
//!
//! ## Performance
//!
//! A /24 subnet (254 hosts) takes ~10-30 seconds on a local network:
//! - Most IPs return RST immediately (sub-millisecond)
//! - Actual devices accept TCP and get probed (~1-2 seconds each)
//! - Concurrent scanning with a semaphore limits to 64 connections at once

use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;

use crate::Error;
use crate::model::DeviceProbe;
use crate::traits::DeviceProvider;

/// Detect the local /24 subnet(s) from the machine's network interfaces.
///
/// Uses `local-ip-address` which queries OS networking APIs directly —
/// no UDP tricks, no external connections. Returns subnet prefixes like
/// `["192.168.100"]` for scanning.
///
/// For machines with multiple active interfaces (e.g., NAS with Docker
/// bridges, Tailscale), this returns only the primary routable interface.
/// Administrators can always specify a subnet explicitly via the API.
pub fn detect_local_subnets() -> Vec<String> {
    match local_ip_address::local_ip() {
        Ok(ip) => {
            let ip_str = ip.to_string();
            if ip_str == "0.0.0.0" || ip_str.starts_with("127.") {
                tracing::warn!("local IP is loopback/unspecified — cannot auto-detect subnet");
                return vec![];
            }
            if let Some(subnet) = ip_to_subnet_prefix(&ip_str) {
                tracing::info!(
                    local_ip = %ip_str,
                    subnet = %subnet,
                    "auto-detected local subnet from network interface"
                );
                return vec![subnet];
            }
            vec![]
        },
        Err(e) => {
            tracing::warn!(error = %e, "could not detect local IP address");
            vec![]
        },
    }
}

/// Extract the /24 subnet prefix from an IP address string.
/// e.g., "192.168.100.5" → Some("192.168.100")
/// Returns None for loopback or malformed addresses.
fn ip_to_subnet_prefix(ip: &str) -> Option<String> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    for part in &parts {
        let _: u8 = part.parse().ok()?;
    }
    if parts[0] == "127" {
        return None;
    }
    Some(format!("{}.{}.{}", parts[0], parts[1], parts[2]))
}

/// Scan a subnet for biometric devices and return discovered devices.
///
/// `subnet` can be:
/// - "192.168.100" — scans 192.168.100.1 through 192.168.100.254
/// - "192.168.100.0/24" — same as above
/// - "10.0.0" — scans 10.0.0.1 through 10.0.0.254
///
/// `port` is the TCP port to scan (default: 4370 for ZKTeco SDK).
/// `provider` is used to probe responsive hosts and extract identity.
///
/// Returns a list of `DeviceProbe` results for discovered devices.
pub async fn scan_subnet(
    subnet: &str,
    port: u16,
    provider: &Arc<dyn DeviceProvider>,
) -> Result<Vec<DeviceProbe>, Error> {
    let hosts = parse_subnet(subnet)?;

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
        let provider = Arc::clone(provider);
        let sem = Arc::clone(&semaphore);
        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await;
            scan_host(&host, port, provider.as_ref()).await
        });
        handles.push(handle);
    }

    let mut discovered = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(Some(probe)) => discovered.push(probe),
            Ok(None) => {}, // host not a device or unreachable
            Err(e) => {
                tracing::debug!(error = %e, "scan task panicked");
            },
        }
    }

    tracing::info!(discovered = discovered.len(), "network scan complete");

    Ok(discovered)
}

/// Scan a single host: TCP connect → if successful, probe for device identity.
async fn scan_host(host: &str, port: u16, provider: &dyn DeviceProvider) -> Option<DeviceProbe> {
    let addr_str = format!("{host}:{port}");
    let addr: SocketAddr = match addr_str.to_socket_addrs().ok().and_then(|mut a| a.next()) {
        Some(a) => a,
        None => return None,
    };

    // Quick TCP connect with 1-second timeout
    match tokio::time::timeout(Duration::from_secs(1), async {
        TcpStream::connect_timeout(&addr, Duration::from_millis(500))
    })
    .await
    {
        Ok(Ok(_stream)) => {
            // TCP connected — now probe to identify the device
            match provider.probe(host, port).await {
                Ok(probe) => {
                    tracing::info!(
                        host = %host,
                        vendor = %probe.vendor,
                        serial = %probe.serial_number,
                        "device discovered"
                    );
                    Some(probe)
                },
                Err(e) => {
                    tracing::debug!(
                        host = %host,
                        error = %e,
                        "TCP connected but probe failed — not a recognized device"
                    );
                    None
                },
            }
        },
        Ok(Err(_)) => None, // Connection refused or timed out
        Err(_) => None,     // Overall timeout
    }
}

/// Parse a subnet string into a list of individual IP addresses.
///
/// Supports:
/// - "192.168.100" → 192.168.100.1 through 192.168.100.254
/// - "10.0.0.0/24" → 10.0.0.1 through 10.0.0.254
/// - "10.0.0.0/28" → 10.0.0.1 through 10.0.0.14
pub fn parse_subnet(subnet: &str) -> Result<Vec<String>, Error> {
    // Try CIDR notation first
    if let Some((base, bits_str)) = subnet.split_once('/') {
        let bits: u8 = bits_str
            .parse()
            .map_err(|_| Error::validation(format!("invalid CIDR bits: '{bits_str}'")))?;
        if bits > 32 {
            return Err(Error::validation(format!("CIDR bits must be <= 32, got {bits}")));
        }
        return generate_hosts_from_cidr(base, bits);
    }

    // Assume it's the first 3 octets (e.g., "192.168.100")
    let parts: Vec<&str> = subnet.trim_end_matches('.').split('.').collect();
    if parts.len() != 3 {
        return Err(Error::validation(format!(
            "invalid subnet format '{subnet}'. Expected: '192.168.100' or '192.168.100.0/24'"
        )));
    }

    // Validate each octet
    for part in &parts {
        let _: u8 = part
            .parse()
            .map_err(|_| Error::validation(format!("invalid octet '{part}' in subnet")))?;
    }

    let base = parts.join(".");
    let hosts: Vec<String> = (1..=254).map(|i| format!("{base}.{i}")).collect();
    Ok(hosts)
}

/// Generate host IPs from CIDR base and prefix length.
fn generate_hosts_from_cidr(base: &str, bits: u8) -> Result<Vec<String>, Error> {
    let parts: Vec<&str> = base.split('.').collect();
    if parts.len() != 4 {
        return Err(Error::validation(format!("invalid CIDR base '{base}'")));
    }

    let octets: Vec<u8> = parts
        .iter()
        .map(|p| p.parse::<u8>().map_err(|_| Error::validation(format!("invalid octet '{p}'"))))
        .collect::<Result<Vec<_>, _>>()?;

    let ip_u32: u32 = (octets[0] as u32) << 24
        | (octets[1] as u32) << 16
        | (octets[2] as u32) << 8
        | octets[3] as u32;

    let mask = if bits == 0 { 0 } else { !0u32 << (32 - bits) };
    let network = ip_u32 & mask;
    let broadcast = network | !mask;

    let start = network + 1;
    let end = broadcast - 1;

    if start >= end {
        return Ok(vec![]);
    }

    let hosts: Vec<String> = (start..=end.min(start + 253))
        .map(|ip| {
            format!(
                "{}.{}.{}.{}",
                (ip >> 24) & 0xFF,
                (ip >> 16) & 0xFF,
                (ip >> 8) & 0xFF,
                ip & 0xFF
            )
        })
        .collect();

    Ok(hosts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_subnet_three_octets() {
        let hosts = parse_subnet("192.168.100").unwrap();
        assert_eq!(hosts.len(), 254);
        assert_eq!(hosts[0], "192.168.100.1");
        assert_eq!(hosts[253], "192.168.100.254");
    }

    #[test]
    fn test_parse_subnet_trailing_dot() {
        let hosts = parse_subnet("10.0.0.").unwrap();
        assert_eq!(hosts.len(), 254);
        assert_eq!(hosts[0], "10.0.0.1");
    }

    #[test]
    fn test_parse_cidr_24() {
        let hosts = parse_subnet("192.168.1.0/24").unwrap();
        assert_eq!(hosts.len(), 254);
        assert_eq!(hosts[0], "192.168.1.1");
        assert_eq!(hosts[253], "192.168.1.254");
    }

    #[test]
    fn test_parse_cidr_28() {
        let hosts = parse_subnet("192.168.1.0/28").unwrap();
        assert_eq!(hosts.len(), 14);
        assert_eq!(hosts[0], "192.168.1.1");
        assert_eq!(hosts[13], "192.168.1.14");
    }

    #[test]
    fn test_parse_invalid_subnet() {
        assert!(parse_subnet("192.168").is_err());
        assert!(parse_subnet("not.an.ip").is_err());
        assert!(parse_subnet("192.168.1.0/33").is_err());
    }

    #[test]
    fn test_ip_to_subnet_prefix() {
        assert_eq!(ip_to_subnet_prefix("192.168.100.5"), Some("192.168.100".into()));
        assert_eq!(ip_to_subnet_prefix("10.0.0.1"), Some("10.0.0".into()));
        assert_eq!(ip_to_subnet_prefix("172.16.0.254"), Some("172.16.0".into()));
        assert_eq!(ip_to_subnet_prefix("127.0.0.1"), None); // loopback
        assert_eq!(ip_to_subnet_prefix("not.an.ip"), None);
        assert_eq!(ip_to_subnet_prefix("192.168"), None);
    }

    #[test]
    fn test_detect_local_subnets_returns_something() {
        // This test verifies the function doesn't panic.
        // Whether it returns subnets depends on the test environment.
        let subnets = detect_local_subnets();
        // On a machine with a real network interface, we should get at least one.
        // In CI/Docker, we might get none — that's acceptable.
        for subnet in &subnets {
            // Verify each detected subnet is parseable
            let hosts = parse_subnet(subnet).unwrap();
            assert!(!hosts.is_empty(), "detected subnet should produce hosts");
        }
    }
}
