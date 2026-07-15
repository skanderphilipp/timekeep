//! # timekeep-storage-postgres
//!
//! PostgreSQL storage backend. Recommended for multi-scanner deployments
//! and when integrating with Odoo (which also uses PostgreSQL).
//!
//! ```toml
//! [storage.postgres]
//! url = "postgres://timekeep:password@localhost:5432/timekeep"
//! ```

pub mod api_keys;
pub mod audit;
pub mod dashboard;
pub mod departments;
pub mod device;
pub mod device_users;
pub mod employees;
pub mod migrations;
pub mod outbox;
pub mod punch;
pub mod settings;

use async_trait::async_trait;
use sqlx::postgres::{PgPool, PgPoolOptions};
use timekeep_core::{
    Error, FacetQuery, PunchFilter,
    model::{AttendancePunch, Department},
    traits::Storage,
};

/// PostgreSQL-backed attendance storage.
pub struct PostgresStorage {
    pub(crate) pool: PgPool,
}

impl PostgresStorage {
    /// Create a new PostgreSQL storage backend.
    pub async fn new(database_url: &str) -> Result<Self, Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .map_err(|e| Error::storage(format!("failed to connect to PostgreSQL: {e}")))?;

        let storage = Self { pool };
        storage.run_migrations().await?;

        Ok(storage)
    }
}

// ── Storage trait implementation ───────────────────────────────────
// Delegates to module-level inherent methods.

#[async_trait]
impl Storage for PostgresStorage {
    // punch.rs
    async fn store_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        self.store_punch(punch).await
    }
    async fn store_punches(&self, punches: &[AttendancePunch]) -> Result<u64, Error> {
        self.store_punches(punches).await
    }
    async fn query_punches(&self, filter: &PunchFilter) -> Result<Vec<AttendancePunch>, Error> {
        self.query_punches(filter).await
    }
    async fn punch_facets(
        &self,
        query: &FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, Error> {
        self.punch_facets(query).await
    }
    async fn device_facets(
        &self,
        query: &FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, Error> {
        self.device_facets(query).await
    }
    async fn employee_facets(
        &self,
        query: &FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, Error> {
        self.employee_facets(query).await
    }
    async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        self.latest_punch_for_device(device_sn).await
    }
    async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error> {
        self.punch_exists(dedup_id).await
    }
    async fn count_device_records(&self, device_sn: &str) -> Result<u32, Error> {
        self.count_device_records(device_sn).await
    }

    // device.rs
    async fn upsert_device(&self, device: &timekeep_core::model::Device) -> Result<(), Error> {
        self.upsert_device(device).await
    }
    async fn upsert_device_config(
        &self,
        config: &timekeep_core::DeviceConfig,
    ) -> Result<(), Error> {
        self.upsert_device_config(config).await
    }
    async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
        self.list_device_configs().await
    }
    async fn list_device_configs_filtered(
        &self,
        filter: &timekeep_core::DeviceFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DeviceConfig>, Error> {
        self.list_device_configs_filtered(filter).await
    }
    async fn upsert_device_info(&self, device: &timekeep_core::Device) -> Result<(), Error> {
        self.upsert_device_info(device).await
    }
    async fn get_device_info(
        &self,
        serial_number: &str,
    ) -> Result<Option<timekeep_core::Device>, Error> {
        self.get_device_info(serial_number).await
    }
    async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error> {
        self.delete_device_config(serial_number).await
    }

    // device_users.rs
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
        self.upsert_user(
            device_sn,
            pin,
            name,
            privilege,
            card_number,
            group_num,
            timezone,
            password_hash,
        )
        .await
    }
    async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        self.get_user_name(pin).await
    }
    async fn count_device_users(&self, device_sn: &str) -> Result<u32, Error> {
        self.count_device_users(device_sn).await
    }
    async fn list_device_users(
        &self,
        device_sn: &str,
    ) -> Result<Vec<(String, String, Option<i32>)>, Error> {
        self.list_device_users(device_sn).await
    }

    // settings.rs
    async fn health_check(&self) -> Result<(), Error> {
        self.health_check().await
    }
    async fn register_provider(&self, provider: &timekeep_core::ProviderInfo) -> Result<(), Error> {
        self.register_provider(provider).await
    }
    async fn list_providers(&self) -> Result<Vec<timekeep_core::ProviderInfo>, Error> {
        self.list_providers().await
    }
    async fn get_system_settings(&self) -> Result<timekeep_core::SystemSettings, Error> {
        self.get_system_settings().await
    }
    async fn upsert_system_settings(
        &self,
        settings: &timekeep_core::SystemSettings,
    ) -> Result<(), Error> {
        self.upsert_system_settings(settings).await
    }
    async fn list_endpoints(&self) -> Result<Vec<timekeep_core::IntegrationEndpoint>, Error> {
        self.list_endpoints().await
    }
    async fn list_endpoints_filtered(
        &self,
        filter: &timekeep_core::EndpointFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::IntegrationEndpoint>, Error> {
        self.list_endpoints_filtered(filter).await
    }
    async fn create_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        self.create_endpoint(endpoint).await
    }
    async fn update_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        self.update_endpoint(endpoint).await
    }
    async fn delete_endpoint(&self, id: &str) -> Result<(), Error> {
        self.delete_endpoint(id).await
    }

    // api_keys.rs
    async fn create_api_key(&self, key: &timekeep_core::ApiKey) -> Result<(), Error> {
        self.create_api_key(key).await
    }
    async fn find_api_key_by_hash(
        &self,
        key_hash: &str,
    ) -> Result<Option<timekeep_core::ApiKey>, Error> {
        self.find_api_key_by_hash(key_hash).await
    }
    async fn list_api_keys(&self) -> Result<Vec<timekeep_core::ApiKey>, Error> {
        self.list_api_keys().await
    }
    async fn revoke_api_key(&self, key_id: &str) -> Result<(), Error> {
        self.revoke_api_key(key_id).await
    }
    async fn touch_api_key(&self, key_id: &str) -> Result<(), Error> {
        self.touch_api_key(key_id).await
    }

    // audit.rs
    async fn record_device_event(&self, event: &timekeep_core::DeviceEvent) -> Result<(), Error> {
        self.record_device_event(event).await
    }
    async fn query_device_events(
        &self,
        filter: &timekeep_core::DeviceEventFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DeviceEvent>, Error> {
        self.query_device_events(filter).await
    }
    async fn count_device_events(
        &self,
        filter: &timekeep_core::DeviceEventFilter,
    ) -> Result<u64, Error> {
        self.count_device_events(filter).await
    }
    async fn record_audit(&self, event: &timekeep_core::AuditEvent) -> Result<(), Error> {
        self.record_audit(event).await
    }
    async fn query_audit_logs(
        &self,
        filter: &timekeep_core::AuditFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::AuditEvent>, Error> {
        self.query_audit_logs(filter).await
    }
    async fn audit_facets(
        &self,
        query: &FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, Error> {
        self.audit_facets(query).await
    }

    // dashboard.rs
    async fn create_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        self.create_dashboard_user(user).await
    }
    async fn find_dashboard_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<timekeep_core::DashboardUser>, Error> {
        self.find_dashboard_user_by_username(username).await
    }
    async fn list_dashboard_users(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DashboardUser>, Error> {
        self.list_dashboard_users(params).await
    }
    async fn update_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        self.update_dashboard_user(user).await
    }
    async fn delete_dashboard_user(&self, id: &str) -> Result<(), Error> {
        self.delete_dashboard_user(id).await
    }
    async fn update_dashboard_user_password(
        &self,
        id: &str,
        password_hash: &str,
        salt: &str,
    ) -> Result<(), Error> {
        self.update_dashboard_user_password(id, password_hash, salt).await
    }

    // outbox.rs
    async fn enqueue_pending_delivery(
        &self,
        delivery: &timekeep_core::PendingDelivery,
    ) -> Result<(), Error> {
        self.enqueue_pending_delivery(delivery).await
    }
    async fn list_pending_deliveries(&self) -> Result<Vec<timekeep_core::PendingDelivery>, Error> {
        self.list_pending_deliveries().await
    }
    async fn update_delivery_retry(
        &self,
        id: &str,
        attempt_count: i32,
        next_retry_at: i64,
    ) -> Result<(), Error> {
        self.update_delivery_retry(id, attempt_count, next_retry_at).await
    }
    async fn delete_pending_delivery(&self, id: &str) -> Result<(), Error> {
        self.delete_pending_delivery(id).await
    }
    async fn move_to_dead_letter(&self, id: &str, last_error: Option<&str>) -> Result<(), Error> {
        self.move_to_dead_letter(id, last_error).await
    }

    // departments.rs
    async fn list_departments(&self) -> Result<Vec<Department>, Error> {
        self.list_departments().await
    }
    async fn get_department(&self, id: &str) -> Result<Option<Department>, Error> {
        self.get_department(id).await
    }
    async fn get_department_by_name(&self, name: &str) -> Result<Option<Department>, Error> {
        self.get_department_by_name(name).await
    }
    async fn create_department(&self, department: &Department) -> Result<(), Error> {
        self.create_department(department).await
    }
    async fn update_department(&self, department: &Department) -> Result<(), Error> {
        self.update_department(department).await
    }
    async fn delete_department(&self, id: &str) -> Result<(), Error> {
        self.delete_department(id).await
    }
}

// ── EmployeeStore trait implementation ────────────────────────────

#[async_trait]
impl timekeep_core::EmployeeStore for PostgresStorage {
    async fn create_employee(&self, employee: &timekeep_core::Employee) -> Result<(), Error> {
        self.create_employee(employee).await
    }
    async fn find_employee(
        &self,
        id: &timekeep_core::EmployeeId,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        self.find_employee(id).await
    }
    async fn find_employee_by_pin(
        &self,
        pin: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        self.find_employee_by_pin(pin).await
    }
    async fn find_employee_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        self.find_employee_by_external_id(external_id).await
    }
    async fn list_employees(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::Employee>, Error> {
        self.list_employees(params).await
    }
    async fn update_employee(&self, employee: &timekeep_core::Employee) -> Result<(), Error> {
        self.update_employee(employee).await
    }
    async fn deactivate_employee(&self, id: &timekeep_core::EmployeeId) -> Result<(), Error> {
        self.deactivate_employee(id).await
    }
    async fn create_enrollment(
        &self,
        enrollment: &timekeep_core::DeviceEnrollment,
    ) -> Result<(), Error> {
        self.create_enrollment(enrollment).await
    }
    async fn find_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<Option<timekeep_core::DeviceEnrollment>, Error> {
        self.find_enrollment(employee_id, device_sn).await
    }
    async fn list_enrollments_for_employee(
        &self,
        employee_id: &timekeep_core::EmployeeId,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        self.list_enrollments_for_employee(employee_id).await
    }
    async fn list_enrollments_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        self.list_enrollments_for_device(device_sn).await
    }
    async fn delete_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<(), Error> {
        self.delete_enrollment(employee_id, device_sn).await
    }

    async fn store_fingerprint_template(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
        template: &timekeep_core::FingerprintTemplate,
    ) -> Result<(), Error> {
        self.store_fingerprint_template(employee_id, device_sn, template).await
    }
    async fn load_fingerprint_templates(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<Vec<timekeep_core::FingerprintTemplate>, Error> {
        self.load_fingerprint_templates(employee_id, device_sn).await
    }
}

#[cfg(test)]
pub(crate) async fn test_storage() -> Option<PostgresStorage> {
    let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://timekeep:password@localhost:5432/timekeep_test".to_string()
    });
    PostgresStorage::new(&url).await.ok()
}
