//! Deduplication stage.
//!
//! Generates a content-addressed ID for each punch and filters out
//! duplicates before they reach storage. Uses an in-memory LRU cache
//! backed by storage lookups for crash recovery.

use std::collections::HashSet;
use std::sync::Arc;

use timekeep_core::model::AttendancePunch;
use timekeep_core::traits::storage::Storage;

/// A sliding-window deduplication cache.
///
/// Holds recently seen dedup IDs in memory to avoid a DB round-trip
/// per punch. Falls back to storage lookup on cache miss (cold start,
/// cache eviction, process restart).
pub struct DedupCache {
    /// Recently seen dedup IDs (content-addressed SHA-256 hashes).
    seen: HashSet<String>,
    /// Maximum number of entries before evicting oldest.
    capacity: usize,
    /// Storage backend for cache-miss lookups.
    storage: Arc<dyn Storage>,
}

impl DedupCache {
    /// Create a new dedup cache.
    ///
    /// `capacity` should be large enough to hold ~2x the expected
    /// daily punch volume. For a typical deployment: 27 punches/day × 3 scanners
    /// × 2x safety = ~200 entries.
    pub fn new(storage: Arc<dyn Storage>, capacity: usize) -> Self {
        Self { seen: HashSet::with_capacity(capacity), capacity, storage }
    }

    /// Check whether a punch has already been seen (duplicate).
    ///
    /// Returns `true` if the punch already exists in the cache or in storage.
    /// Returns `false` if it's a new punch (and adds it to the cache).
    pub async fn is_duplicate(&mut self, punch: &AttendancePunch) -> bool {
        let dedup_id = punch.generate_deduplication_id();

        // Fast path: in-memory cache hit
        if self.seen.contains(&dedup_id) {
            tracing::debug!(
                dedup_id = %dedup_id,
                user_pin = %punch.user_pin,
                "dedup: cache hit (duplicate)"
            );
            return true;
        }

        // Cache miss: check storage
        // Only check if we have storage wired (may be None in test setups)
        match self.storage.punch_exists(&dedup_id).await {
            Ok(true) => {
                tracing::debug!(
                    dedup_id = %dedup_id,
                    "dedup: storage hit (duplicate)"
                );
                // Add to cache for future fast-path hits
                self.insert(dedup_id);
                true
            },
            Ok(false) => {
                self.insert(dedup_id);
                false
            },
            Err(e) => {
                // If storage lookup fails, err on the side of
                // NOT filtering — better duplicate than lost data.
                tracing::warn!(
                    dedup_id = %dedup_id,
                    error = %e,
                    "dedup: storage lookup failed, allowing punch through"
                );
                self.insert(dedup_id);
                false
            },
        }
    }

    /// Add an ID to the cache, evicting oldest if at capacity.
    fn insert(&mut self, dedup_id: String) {
        if self.seen.len() >= self.capacity {
            // Clear oldest entries (simple strategy: clear half)
            let to_remove = self.capacity / 2;
            let ids: Vec<String> = self.seen.iter().take(to_remove).cloned().collect();
            for id in ids {
                self.seen.remove(&id);
            }
            tracing::debug!(
                removed = to_remove,
                remaining = self.seen.len(),
                "dedup cache eviction"
            );
        }
        self.seen.insert(dedup_id);
    }

    /// Current number of entries in the cache.
    pub fn len(&self) -> usize {
        self.seen.len()
    }

    /// Whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.seen.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;
    use timekeep_core::Error;

    /// Fake storage that tracks which IDs it was asked about.
    struct FakeStorage {
        known: Mutex<HashSet<String>>,
        should_fail: bool,
    }

    impl FakeStorage {
        fn new() -> Self {
            Self { known: Mutex::new(HashSet::new()), should_fail: false }
        }

        fn add_known(&self, id: &str) {
            self.known.lock().unwrap().insert(id.to_string());
        }
    }

    #[async_trait]
    impl Storage for FakeStorage {
        async fn store_punch(&self, _punch: &AttendancePunch) -> Result<(), Error> {
            Ok(())
        }
        async fn store_punches(&self, _punches: &[AttendancePunch]) -> Result<u64, Error> {
            Ok(0)
        }
        async fn query_punches(
            &self,
            _filter: &timekeep_core::traits::storage::PunchFilter,
        ) -> Result<Vec<AttendancePunch>, Error> {
            Ok(vec![])
        }
        async fn upsert_device(&self, _device: &timekeep_core::model::Device) -> Result<(), Error> {
            Ok(())
        }
        async fn upsert_device_config(
            &self,
            _config: &timekeep_core::DeviceConfig,
        ) -> Result<(), Error> {
            Ok(())
        }
        async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
            Ok(vec![])
        }
        async fn delete_device_config(&self, _sn: &str) -> Result<(), Error> {
            Ok(())
        }
        async fn latest_punch_for_device(
            &self,
            _device_sn: &str,
        ) -> Result<Option<jiff::Timestamp>, Error> {
            Ok(None)
        }
        async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error> {
            if self.should_fail {
                return Err("simulated storage failure".into());
            }
            Ok(self.known.lock().unwrap().contains(dedup_id))
        }
    }

    fn make_punch(user_pin: &str, device_sn: &str, timestamp_sec: i64) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(timestamp_sec).unwrap();
        let mut punch = AttendancePunch {
            id: String::new(),
            device_sn: device_sn.to_string(),
            user_pin: user_pin.to_string(),
            timestamp: ts,
            status: timekeep_core::PunchStatus::CheckIn,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };
        punch.id = punch.generate_deduplication_id();
        punch
    }

    #[tokio::test]
    async fn test_first_punch_not_duplicate() {
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 100);
        let punch = make_punch("145", "CQZ7232960836", 1752129600);

        assert!(!cache.is_duplicate(&punch).await);
        assert_eq!(cache.len(), 1);
    }

    #[tokio::test]
    async fn test_same_punch_twice_is_duplicate() {
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 100);
        let punch = make_punch("145", "CQZ7232960836", 1752129600);

        assert!(!cache.is_duplicate(&punch).await);
        assert!(cache.is_duplicate(&punch).await); // second time = duplicate
        assert_eq!(cache.len(), 1); // still one entry
    }

    #[tokio::test]
    async fn test_different_punches_not_duplicate() {
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 100);
        let p1 = make_punch("145", "CQZ7232960836", 1752129600);
        let p2 = make_punch("146", "CQZ7232960836", 1752129601);

        assert!(!cache.is_duplicate(&p1).await);
        assert!(!cache.is_duplicate(&p2).await);
        assert_eq!(cache.len(), 2);
    }

    #[tokio::test]
    async fn test_known_in_storage_is_duplicate() {
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 100);
        let punch = make_punch("145", "CQZ7232960836", 1752129600);

        // Pre-populate storage with this punch ID
        storage.add_known(&punch.id);

        // First check should hit storage and find it
        assert!(cache.is_duplicate(&punch).await);
        // But it's still in cache for fast path
        assert_eq!(cache.len(), 1);
    }

    #[tokio::test]
    async fn test_storage_failure_allows_punch() {
        let mut storage = FakeStorage::new();
        storage.should_fail = true;
        let storage = Arc::new(storage);
        let mut cache = DedupCache::new(storage.clone(), 100);
        let punch = make_punch("145", "CQZ7232960836", 1752129600);

        // Storage fails, but we err on the side of NOT filtering
        assert!(!cache.is_duplicate(&punch).await);
        assert_eq!(cache.len(), 1);
    }

    #[tokio::test]
    async fn test_cache_eviction() {
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 4); // tiny capacity

        for i in 0..6 {
            let p = make_punch(&format!("{i}"), "SN", 1752129600 + i as i64);
            cache.is_duplicate(&p).await;
        }

        // Should have evicted roughly half (2 entries), so <= capacity
        assert!(cache.len() <= 4);
    }

    #[tokio::test]
    async fn test_real_world_scenario() {
        // Simulate a real-world scenario: 27 punches/day from a typical office scanner
        let storage = Arc::new(FakeStorage::new());
        let mut cache = DedupCache::new(storage.clone(), 100);

        // 27 users, each punching in the morning
        let mut new_count = 0;
        for i in 0..27 {
            let p = make_punch(
                &format!("EMP{:03}", i + 1),
                "CQZ7232960836",
                1752129600 + i as i64 * 30, // staggered by 30 seconds
            );
            if !cache.is_duplicate(&p).await {
                new_count += 1;
            }
        }
        assert_eq!(new_count, 27);
        assert_eq!(cache.len(), 27);

        // Same 27 users punching out in the afternoon — different timestamps = not duplicate
        let mut new_count = 0;
        for i in 0..27 {
            let p = make_punch(
                &format!("EMP{:03}", i + 1),
                "CQZ7232960836",
                1752157200 + i as i64 * 30, // afternoon
            );
            if !cache.is_duplicate(&p).await {
                new_count += 1;
            }
        }
        assert_eq!(new_count, 27);
        assert_eq!(cache.len(), 54);

        // Replay the morning punches — ALL should be duplicates
        let mut dup_count = 0;
        for i in 0..27 {
            let p = make_punch(
                &format!("EMP{:03}", i + 1),
                "CQZ7232960836",
                1752129600 + i as i64 * 30,
            );
            if cache.is_duplicate(&p).await {
                dup_count += 1;
            }
        }
        assert_eq!(dup_count, 27, "all 27 morning punches should be duplicates");
    }
}
