//! Persistence layer for attendance data — composite trait.
//!
//! This trait bundles all persistence concerns. It is being decomposed into
//! focused `*Store` traits (see ADR-001). During the transition, this trait
//! retains all methods for backward compatibility.
//!
//! # Migration path
//!
//! Phase 1 (now): Focused `*Store` traits exist alongside `Storage`.
//! Phase 3 (next): Storage implementations split per-Store. `Storage` becomes a supertrait.
//!
//! New consumers should depend on specific `*Store` traits. Existing consumers
//! of `Storage` continue to work unchanged.

use async_trait::async_trait;

use crate::Error;
use crate::facet::{FacetGroup, FacetQuery};
use crate::model::audit::AuditEvent;
use crate::model::device_event::DeviceEvent;
use crate::model::pending_delivery::PendingDelivery;
use crate::model::{AttendancePunch, Device, DeviceConfig, ProviderInfo};
use crate::query::ListResult;
use crate::query::filters::{
    DeviceEventFilter, DeviceFilter, EndpointFilter, PunchCriteria, PunchFilter,
};

/// Persistence layer for attendance data.
///
/// Implementations decide *where* data lives:
/// - SQLite (embedded, single-file, zero config)
/// - PostgreSQL (server-grade, Odoo-compatible)
///
/// # Decomposition status
///
/// This trait is being decomposed into focused `*Store` traits.
/// See [`PunchStore`](crate::traits::punch_store::PunchStore),
/// [`DeviceConfigStore`](crate::traits::device_config_store::DeviceConfigStore), etc.
#[async_trait]
#[allow(clippy::too_many_arguments)]
pub trait Storage: Send + Sync {
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

    /// Get a single punch by deduplication ID. Returns `None` if not found.
    async fn get_punch(&self, id: &str) -> Result<Option<AttendancePunch>, Error>;

    /// Query punches matching the given filter with pagination.
    async fn query_punches(&self, filter: &PunchFilter) -> Result<Vec<AttendancePunch>, Error>;

    /// Query ALL punches matching criteria within a date range — no pagination.
    ///
    /// Aggregate endpoints (calendar, reports, dashboard) call this instead of
    /// `query_punches` with `unlimited: true`. The method dispatch itself
    /// expresses the intent — no flag-based behavior switching.
    async fn query_punches_unpaged(
        &self,
        criteria: &PunchCriteria,
        since: Option<jiff::Timestamp>,
        until: Option<jiff::Timestamp>,
    ) -> Result<Vec<AttendancePunch>, Error> {
        let filter = PunchFilter {
            device_sns: Some(criteria.device_sns_vec()).filter(|v| !v.is_empty()),
            user_pins: Some(criteria.user_pins_vec()).filter(|v| !v.is_empty()),
            statuses: criteria.resolved_statuses().filter(|s| !s.is_empty()),
            anomalies_only: if criteria.anomalies_only_bool() { Some(true) } else { None },
            since,
            until,

            params: crate::query::ListParams { limit: 100_000, ..Default::default() },
            ..Default::default()
        };
        self.query_punches(&filter).await
    }

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

    /// Return faceted filter metadata for devices.
    ///
    /// Called by `GET /api/devices/filters`.
    async fn device_facets(&self, _query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        Err(Error::storage("device facets not implemented for this backend"))
    }

    /// Return faceted filter metadata for audit logs.
    ///
    /// Called by `GET /api/audit/filters`.
    async fn audit_facets(&self, _query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        Err(Error::storage("audit facets not implemented for this backend"))
    }

    /// Return faceted filter metadata for employees.
    ///
    /// Called by `GET /api/employees/filters`.
    async fn employee_facets(&self, _query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        Err(Error::storage("employee facets not implemented for this backend"))
    }

    /// Store or update device information.
    async fn upsert_device(&self, device: &Device) -> Result<(), Error>;

    /// Store or update device connection configuration.
    /// Called when an admin adds or updates a scanner from the dashboard.
    async fn upsert_device_config(&self, config: &DeviceConfig) -> Result<(), Error>;

    /// List all registered devices with their connection configs.
    ///
    /// Prefer [`list_device_configs_filtered`] for paginated, searchable listing.
    /// This method remains for backward compatibility.
    async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, Error>;

    /// List devices with search, sort, and pagination.
    async fn list_device_configs_filtered(
        &self,
        _filter: &DeviceFilter,
    ) -> Result<ListResult<DeviceConfig>, Error> {
        // Default: fall back to list_device_configs and wrap in ListResult
        let all = self.list_device_configs().await?;
        Ok(ListResult::single_page(all))
    }

    /// Remove a device from the registry (does not delete attendance data).
    async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error>;

    /// Get the latest punch timestamp for a device.
    /// Used for resumable sync: "give me everything since this timestamp."
    async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error>;

    /// Check if a punch with the given deduplication ID already exists.
    async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error>;

    /// Sync a user from the device into the local user table.
    /// PIN is the device's user ID, name is the display name on the device.
    /// privilege is optional (0=normal user, 14=admin, etc.)
    async fn upsert_user(
        &self,
        device_sn: &str,
        pin: &str,
        name: &str,
        privilege: Option<i32>,
        card_number: Option<&str>,
        group_num: Option<i32>,
        timezone: Option<i32>,
        password_hash: Option<&str>,
    ) -> Result<(), Error> {
        let _ = (device_sn, pin, name, privilege, card_number, group_num, timezone, password_hash);
        Ok(())
    }

    /// Look up a user's display name by their device PIN.
    /// Returns None if the user is not in the local table.
    async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let _ = pin;
        Ok(None)
    }

    /// Count how many users are synced from a specific device.
    async fn count_device_users(&self, _device_sn: &str) -> Result<u32, Error> {
        Ok(0)
    }

    /// Count how many attendance records are stored for a specific device.
    async fn count_device_records(&self, _device_sn: &str) -> Result<u32, Error> {
        Ok(0)
    }

    /// List all users synced from a specific device.
    /// Returns (pin, name, privilege) tuples sorted by pin.
    async fn list_device_users(
        &self,
        _device_sn: &str,
    ) -> Result<Vec<(String, String, Option<i32>)>, Error> {
        Ok(vec![])
    }

    /// Health check — ping the database to verify connectivity.
    ///
    /// Implementations should run a lightweight query (e.g. `SELECT 1`)
    /// and return `Ok(())` if the database responds. Returns an error
    /// if the database is unreachable or unhealthy.
    ///
    /// The default implementation returns `Ok(())` — override for
    /// real database backends.
    async fn health_check(&self) -> Result<(), Error> {
        Ok(())
    }

    // ── API Key management (for integration partners) ───────────────

    /// Create a new API key for integration partners.
    /// Returns the full key string (only shown once at creation time).
    async fn create_api_key(&self, _key: &crate::model::iam::ApiKey) -> Result<(), Error> {
        Err(Error::storage("API key storage not implemented for this backend"))
    }

    /// Look up an API key by its SHA-256 hash.
    /// Returns `None` if the key doesn't exist or has been revoked.
    async fn find_api_key_by_hash(
        &self,
        _key_hash: &str,
    ) -> Result<Option<crate::model::iam::ApiKey>, Error> {
        Ok(None)
    }

    /// List all API keys (metadata only — no key hashes returned).
    async fn list_api_keys(&self) -> Result<Vec<crate::model::iam::ApiKey>, Error> {
        Ok(vec![])
    }

    /// Revoke an API key by its ID.
    async fn revoke_api_key(&self, _key_id: &str) -> Result<(), Error> {
        Err(Error::storage("API key storage not implemented for this backend"))
    }

    /// Update the `last_used_at` timestamp on an API key.
    async fn touch_api_key(&self, _key_id: &str) -> Result<(), Error> {
        Ok(())
    }

    // ── Integration Endpoints (tenant-configurable destinations) ────

    /// List all integration endpoints.
    async fn list_endpoints(
        &self,
    ) -> Result<Vec<crate::model::settings::IntegrationEndpoint>, Error> {
        Ok(vec![])
    }

    /// List integration endpoints with search, sort, and pagination.
    async fn list_endpoints_filtered(
        &self,
        _filter: &EndpointFilter,
    ) -> Result<ListResult<crate::model::settings::IntegrationEndpoint>, Error> {
        let all = self.list_endpoints().await?;
        Ok(ListResult::single_page(all))
    }

    /// Create a new integration endpoint.
    async fn create_endpoint(
        &self,
        _endpoint: &crate::model::settings::IntegrationEndpoint,
    ) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }

    /// Update an existing integration endpoint (full replace).
    async fn update_endpoint(
        &self,
        _endpoint: &crate::model::settings::IntegrationEndpoint,
    ) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }

    /// Delete an integration endpoint by ID.
    async fn delete_endpoint(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }

    // ── System Settings (engine-wide) ──────────────────────────────

    /// Load system settings. Returns defaults if none persisted.
    async fn get_system_settings(&self) -> Result<crate::model::settings::SystemSettings, Error> {
        Ok(crate::model::settings::SystemSettings::default())
    }

    /// Persist system settings.
    async fn upsert_system_settings(
        &self,
        _settings: &crate::model::settings::SystemSettings,
    ) -> Result<(), Error> {
        Err(Error::storage("system settings storage not implemented for this backend"))
    }

    // ── Audit Log ────────────────────────────────────────────────

    /// Record an audit event.
    async fn record_audit(&self, _event: &crate::model::audit::AuditEvent) -> Result<(), Error> {
        Ok(()) // default: silently drop (non-critical path)
    }

    /// Get a single audit event by ID.
    async fn get_audit_event(
        &self,
        _id: &str,
    ) -> Result<Option<crate::model::audit::AuditEvent>, Error> {
        Err(Error::storage("audit event storage not implemented for this backend"))
    }

    /// Query audit logs with filter, sort, and pagination.
    async fn query_audit_logs(
        &self,
        _filter: &crate::model::audit::AuditFilter,
    ) -> Result<crate::query::ListResult<crate::model::audit::AuditEvent>, Error> {
        Ok(crate::query::ListResult::single_page(vec![]))
    }

    // ── Dashboard User Management ──────────────────────────────

    /// Create a new dashboard user. Returns an error if the username already exists.
    async fn create_dashboard_user(
        &self,
        _user: &crate::model::DashboardUser,
    ) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Find a dashboard user by username. Returns None if not found or inactive.
    async fn find_dashboard_user_by_username(
        &self,
        _username: &str,
    ) -> Result<Option<crate::model::DashboardUser>, Error> {
        Ok(None)
    }

    /// List all dashboard users with optional search, sort, and pagination.
    async fn list_dashboard_users(
        &self,
        _params: &crate::query::ListParams,
    ) -> Result<crate::query::ListResult<crate::model::DashboardUser>, Error> {
        Ok(crate::query::ListResult::single_page(vec![]))
    }

    /// Update a dashboard user's role, display name, or active status.
    /// Returns an error if the user doesn't exist.
    async fn update_dashboard_user(
        &self,
        _user: &crate::model::DashboardUser,
    ) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Delete a dashboard user by ID. Returns an error if not found.
    async fn delete_dashboard_user(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Update a dashboard user's password (hash + salt).
    async fn update_dashboard_user_password(
        &self,
        _id: &str,
        _password_hash: &str,
        _salt: &str,
    ) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    // ── Device Events (activity timeline) ─────────────────────────────

    /// Record a device lifecycle event for the activity timeline.
    ///
    /// Unlike `DomainEvent` (ephemeral on the event bus), these events are
    /// persisted in the database and queried to build device timelines.
    async fn record_device_event(&self, _event: &DeviceEvent) -> Result<(), Error> {
        Ok(()) // default: silently drop
    }

    /// Query device events with filter, sort, and pagination.
    async fn query_device_events(
        &self,
        _filter: &DeviceEventFilter,
    ) -> Result<ListResult<DeviceEvent>, Error> {
        Ok(ListResult::single_page(vec![]))
    }

    /// Query audit logs related to a specific device.
    ///
    /// Filters audit_logs where the resource path contains the device serial
    /// number (e.g. "/api/devices/JJA12533/sync-users"). Results are merged
    /// with device events to build per-device activity timelines.
    async fn query_device_audit_logs(
        &self,
        _device_sn: &str,
        _limit: u32,
        _offset: u32,
    ) -> Result<ListResult<AuditEvent>, Error> {
        Ok(ListResult { items: vec![], has_more: false, total: None, next_cursor: None })
    }

    /// Count device events matching a filter (for pagination totals).
    async fn count_device_events(&self, _filter: &DeviceEventFilter) -> Result<u64, Error> {
        Ok(0)
    }

    // ── Device Info (enriched device metadata) ────────────────────────

    /// Upsert the full device info (from get_device_info()).
    /// This stores the richer Device model fields separate from DeviceConfig.
    async fn upsert_device_info(&self, _device: &Device) -> Result<(), Error> {
        Ok(()) // default: silently accept
    }

    /// Get full device info by serial number.
    async fn get_device_info(&self, _serial_number: &str) -> Result<Option<Device>, Error> {
        Ok(None)
    }

    // ── Provider Registry ─────────────────────────────────────────────

    /// Persist a provider registration (so it survives restarts).
    async fn register_provider(&self, _provider: &ProviderInfo) -> Result<(), Error> {
        Err(Error::storage("provider storage not implemented for this backend"))
    }

    /// List all persisted providers.
    async fn list_providers(&self) -> Result<Vec<ProviderInfo>, Error> {
        Ok(vec![])
    }

    // ── Outbox (pending delivery) ──────────────────────────────────────

    /// Enqueue a punch delivery that failed to reach an external system.
    /// The worker will pick this up and retry with exponential backoff.
    async fn enqueue_pending_delivery(&self, _delivery: &PendingDelivery) -> Result<(), Error> {
        Err(Error::storage("outbox not implemented for this backend"))
    }

    /// List pending deliveries that are ready for retry (next_retry_at <= now).
    /// Ordered by next_retry_at ascending.
    async fn list_pending_deliveries(&self) -> Result<Vec<PendingDelivery>, Error> {
        Ok(vec![])
    }

    /// Update the attempt count and next_retry_at for a pending delivery.
    async fn update_delivery_retry(
        &self,
        _id: &str,
        _attempt_count: i32,
        _next_retry_at: i64,
    ) -> Result<(), Error> {
        Ok(())
    }

    /// Delete a pending delivery after successful delivery.
    async fn delete_pending_delivery(&self, _id: &str) -> Result<(), Error> {
        Ok(())
    }

    /// Move a delivery that has exhausted retries to the dead letter table.
    async fn move_to_dead_letter(&self, _id: &str, _last_error: Option<&str>) -> Result<(), Error> {
        Ok(())
    }

    // ── Department management ────────────────────────────────────

    /// List all departments.
    async fn list_departments(&self) -> Result<Vec<crate::model::department::Department>, Error> {
        Ok(vec![])
    }

    /// Get a single department by ID.
    async fn get_department(
        &self,
        _id: &str,
    ) -> Result<Option<crate::model::department::Department>, Error> {
        Ok(None)
    }

    /// Get a department by name.
    async fn get_department_by_name(
        &self,
        _name: &str,
    ) -> Result<Option<crate::model::department::Department>, Error> {
        Ok(None)
    }

    /// Create a new department.
    async fn create_department(
        &self,
        _department: &crate::model::department::Department,
    ) -> Result<(), Error> {
        Err(Error::storage("department storage not implemented for this backend"))
    }

    /// Update an existing department.
    async fn update_department(
        &self,
        _department: &crate::model::department::Department,
    ) -> Result<(), Error> {
        Err(Error::storage("department storage not implemented for this backend"))
    }

    /// Delete a department by ID.
    async fn delete_department(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("department storage not implemented for this backend"))
    }

    // ── Device Groups ────────────────────────────────────────────

    /// List all device groups.
    async fn list_device_groups(
        &self,
    ) -> Result<Vec<crate::model::device_group::DeviceGroup>, Error> {
        Ok(vec![])
    }

    /// Get a single device group by ID.
    async fn get_device_group(
        &self,
        _id: &str,
    ) -> Result<Option<crate::model::device_group::DeviceGroup>, Error> {
        Ok(None)
    }

    /// Get a device group by name.
    async fn get_device_group_by_name(
        &self,
        _name: &str,
    ) -> Result<Option<crate::model::device_group::DeviceGroup>, Error> {
        Ok(None)
    }

    /// Create a new device group.
    async fn create_device_group(
        &self,
        _group: &crate::model::device_group::DeviceGroup,
    ) -> Result<(), Error> {
        Err(Error::storage("device group storage not implemented for this backend"))
    }

    /// Update an existing device group.
    async fn update_device_group(
        &self,
        _group: &crate::model::device_group::DeviceGroup,
    ) -> Result<(), Error> {
        Err(Error::storage("device group storage not implemented for this backend"))
    }

    /// Delete a device group by ID.
    async fn delete_device_group(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("device group storage not implemented for this backend"))
    }

    /// List all devices in a group.
    async fn list_devices_in_group(
        &self,
        _group_id: &str,
    ) -> Result<Vec<crate::model::DeviceConfig>, Error> {
        Ok(vec![])
    }

    /// Set a device's group membership (None = remove from group).
    async fn set_device_group_membership(
        &self,
        _device_sn: &str,
        _group_id: Option<&str>,
    ) -> Result<(), Error> {
        Err(Error::storage("device group storage not implemented for this backend"))
    }

    // ── Work Policy Templates ────────────────────────────────────

    /// List all work policy templates.
    async fn list_work_policy_templates(
        &self,
    ) -> Result<Vec<crate::model::WorkPolicyTemplate>, Error> {
        Ok(vec![])
    }

    /// Get a single work policy template by ID.
    async fn get_work_policy_template(
        &self,
        _id: &str,
    ) -> Result<Option<crate::model::WorkPolicyTemplate>, Error> {
        Ok(None)
    }

    /// Get a work policy template by title.
    async fn get_work_policy_template_by_title(
        &self,
        _title: &str,
    ) -> Result<Option<crate::model::WorkPolicyTemplate>, Error> {
        Ok(None)
    }

    /// Create a new work policy template.
    async fn create_work_policy_template(
        &self,
        _template: &crate::model::WorkPolicyTemplate,
    ) -> Result<(), Error> {
        Err(Error::storage("work policy template storage not implemented for this backend"))
    }

    /// Update an existing work policy template.
    async fn update_work_policy_template(
        &self,
        _template: &crate::model::WorkPolicyTemplate,
    ) -> Result<(), Error> {
        Err(Error::storage("work policy template storage not implemented for this backend"))
    }

    /// Delete a work policy template by ID.
    async fn delete_work_policy_template(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("work policy template storage not implemented for this backend"))
    }
}
