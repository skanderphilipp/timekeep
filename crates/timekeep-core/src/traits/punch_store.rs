//! Persistence for attendance punch records.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).

use async_trait::async_trait;

use crate::Error;
use crate::facet::{FacetGroup, FacetQuery};
use crate::model::AttendancePunch;
use crate::query::filters::PunchFilter;

/// Persists and queries attendance punch records.
///
/// Implementations provide the storage backend (SQLite, PostgreSQL, etc.).
#[async_trait]
pub trait PunchStore: Send + Sync {
    /// Store a single attendance punch. Idempotent — if a punch with
    /// the same deduplication ID already exists, it must not create a duplicate.
    async fn store_punch(&self, punch: &AttendancePunch) -> Result<(), Error>;

    /// Store multiple punches in a batch. Default implementation loops;
    /// override for bulk-insert efficiency.
    async fn store_punches(&self, punches: &[AttendancePunch]) -> Result<u64, Error> {
        let mut count = 0;
        for punch in punches {
            self.store_punch(punch).await?;
            count += 1;
        }
        Ok(count)
    }

    /// Get a single punch by its deduplication ID.
    ///
    /// Used by punch detail views (side panel record detail).
    /// Returns `None` if no punch with that ID exists.
    async fn get_punch(&self, id: &str) -> Result<Option<AttendancePunch>, Error>;

    /// Query punches matching the given filter.
    async fn query_punches(&self, filter: &PunchFilter) -> Result<Vec<AttendancePunch>, Error>;

    /// Return faceted filter metadata for punches.
    ///
    /// Called by `GET /api/punches/filters` to populate the filter bar.
    /// When `query.context` carries date/device/status filters, facet
    /// counts are restricted to matching records (contextual faceting).
    ///
    /// Default implementation returns an error — override in storage
    /// backends to enable the feature.
    async fn punch_facets(&self, _query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        Err(Error::storage("punch facets not implemented for this backend"))
    }

    /// Get the latest punch timestamp for a device.
    /// Used for resumable sync: "give me everything since this timestamp."
    async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error>;

    /// Check if a punch with the given deduplication ID already exists.
    async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error>;

    /// Count how many attendance records are stored for a specific device.
    async fn count_device_records(&self, _device_sn: &str) -> Result<u32, Error> {
        Ok(0)
    }
}
