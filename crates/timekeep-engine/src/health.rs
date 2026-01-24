//! Shared engine health metrics for the API health endpoint.
//!
//! This module provides an `EngineHealth` struct that is shared between
//! the engine (which writes counters) and the API (which reads them for
//! the `/api/health` endpoint). Everything is atomic so reads never block writes.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use crate::distribution::DistributorSnapshot;

/// Shared engine health state, readable from the health endpoint.
///
/// Created once at startup and passed to both the `Engine` and the API's
/// `AppState`. The engine increments counters; the API reads snapshots.
#[derive(Clone)]
pub struct EngineHealth {
    /// When the process started (for uptime calculation).
    start_time: Instant,
    /// Events processed since startup.
    events_processed: Arc<AtomicU64>,
    /// Events dropped due to dedup or bus lag.
    events_dropped: Arc<AtomicU64>,
    /// Events distributed successfully.
    events_distributed: Arc<AtomicU64>,
    /// Events that failed distribution.
    events_failed: Arc<AtomicU64>,
}

impl EngineHealth {
    /// Create a new engine health tracker starting now.
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            events_processed: Arc::new(AtomicU64::new(0)),
            events_dropped: Arc::new(AtomicU64::new(0)),
            events_distributed: Arc::new(AtomicU64::new(0)),
            events_failed: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Increment the events-processed counter.
    pub fn inc_processed(&self) {
        self.events_processed.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment the events-dropped counter.
    pub fn inc_dropped(&self) {
        self.events_dropped.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment the events-distributed counter.
    pub fn inc_distributed(&self) {
        self.events_distributed.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment the events-distributed counter by a delta.
    pub fn inc_distributed_by(&self, delta: u64) {
        if delta > 0 {
            self.events_distributed.fetch_add(delta, Ordering::Relaxed);
        }
    }

    /// Increment the events-failed counter.
    pub fn inc_failed(&self) {
        self.events_failed.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment the events-failed counter by a delta.
    pub fn inc_failed_by(&self, delta: u64) {
        if delta > 0 {
            self.events_failed.fetch_add(delta, Ordering::Relaxed);
        }
    }

    /// Seconds since process start.
    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Snapshot of engine counters.
    pub fn snapshot(&self) -> EngineHealthSnapshot {
        EngineHealthSnapshot {
            uptime_seconds: self.uptime_seconds(),
            events_processed: self.events_processed.load(Ordering::Relaxed),
            events_dropped: self.events_dropped.load(Ordering::Relaxed),
            events_distributed: self.events_distributed.load(Ordering::Relaxed),
            events_failed: self.events_failed.load(Ordering::Relaxed),
        }
    }
}

impl Default for EngineHealth {
    fn default() -> Self {
        Self::new()
    }
}

/// A point-in-time snapshot of engine health metrics.
#[derive(Debug, Clone)]
pub struct EngineHealthSnapshot {
    pub uptime_seconds: u64,
    pub events_processed: u64,
    pub events_dropped: u64,
    pub events_distributed: u64,
    pub events_failed: u64,
}

/// Complete health report combining engine stats with distributor and device info.
#[derive(Debug, Clone)]
pub struct FullHealthReport {
    /// Overall status: "healthy" | "degraded" | "unhealthy"
    pub status: &'static str,
    pub version: String,
    pub db: String,
    pub uptime_seconds: u64,

    /// Engine pipeline stats.
    pub engine: EngineHealthSnapshot,

    /// Per-distributor stats.
    pub distributors: Vec<(String, DistributorSnapshot)>,

    /// Per-device connection health.
    pub devices: Vec<DeviceHealthInfo>,
}

/// Per-device health info from the connection state tracker.
#[derive(Debug, Clone)]
pub struct DeviceHealthInfo {
    pub serial_number: String,
    pub adms_active: bool,
    pub sdk_active: bool,
    pub last_seen_secs_ago: Option<u64>,
    pub last_poll_secs_ago: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uptime_increases() {
        let health = EngineHealth::new();
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert!(health.uptime_seconds() >= 0, "uptime should be non-negative");
    }

    #[test]
    fn test_counters_increment() {
        let health = EngineHealth::new();
        health.inc_processed();
        health.inc_processed();
        health.inc_dropped();
        health.inc_distributed();
        health.inc_failed();

        let snap = health.snapshot();
        assert_eq!(snap.events_processed, 2);
        assert_eq!(snap.events_dropped, 1);
        assert_eq!(snap.events_distributed, 1);
        assert_eq!(snap.events_failed, 1);
    }

    #[test]
    fn test_snapshot_is_consistent() {
        let health = EngineHealth::new();
        health.inc_processed();
        let snap = health.snapshot();
        assert!(snap.uptime_seconds >= 0);
        assert_eq!(snap.events_processed, 1);
        assert_eq!(snap.events_dropped, 0);
    }
}
