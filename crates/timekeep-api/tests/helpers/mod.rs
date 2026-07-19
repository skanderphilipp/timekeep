//! Shared test infrastructure for timekeep-api integration tests.
//!
//! Uses the public `management_router()` and `integration_router()`
//! functions from `timekeep_api` to build realistic test apps.

use async_trait::async_trait;
use std::sync::{Arc, Mutex as StdMutex};

use axum::Router;
use timekeep_api::RouterConfig;
use timekeep_api::app_state::DeviceConnectionState;
use timekeep_core::events::EventBus;
use timekeep_core::model::{
    AttendancePunch, AuditEvent, AuditFilter, DashboardUser, Device, DeviceConfig, DeviceEvent,
    IntegrationEndpoint, PendingDelivery, ProviderInfo,
};
use timekeep_core::traits::Storage;
use timekeep_engine::health::EngineHealth;

// ═══════════════════════════════════════════════════════════════════════
// FakeStorage
// ═══════════════════════════════════════════════════════════════════════

pub struct FakeStorage {
    pub punches: StdMutex<Vec<AttendancePunch>>,
    pub devices: StdMutex<Vec<DeviceConfig>>,
    pub api_keys: StdMutex<Vec<timekeep_core::model::ApiKey>>,
    pub departments: StdMutex<Vec<timekeep_core::model::Department>>,
    pub device_groups: StdMutex<Vec<timekeep_core::model::DeviceGroup>>,
    pub settings: StdMutex<Option<timekeep_core::model::SystemSettings>>,
    pub work_policy_templates: StdMutex<Vec<timekeep_core::model::WorkPolicyTemplate>>,
    pub audit_logs: StdMutex<Vec<AuditEvent>>,
    pub dashboard_users: StdMutex<Vec<DashboardUser>>,
}

impl FakeStorage {
    pub fn new() -> Self {
        Self {
            punches: StdMutex::new(Vec::new()),
            devices: StdMutex::new(Vec::new()),
            api_keys: StdMutex::new(Vec::new()),
            departments: StdMutex::new(Vec::new()),
            device_groups: StdMutex::new(Vec::new()),
            settings: StdMutex::new(Some(timekeep_core::model::SystemSettings::default())),
            work_policy_templates: StdMutex::new(Vec::new()),
            audit_logs: StdMutex::new(Vec::new()),
            dashboard_users: StdMutex::new(Vec::new()),
        }
    }

    pub fn seed_department(&self, dept: timekeep_core::model::Department) -> String {
        let id = dept.id.0.clone();
        self.departments.lock().unwrap().push(dept);
        id
    }

    pub fn seed_employee_with_dept(
        employees: &FakeEmployeeStore,
        pin: &str,
        name: &str,
        department_name: &str,
        department_id: &str,
    ) {
        let mut emp =
            timekeep_core::model::Employee::new(pin, name, Some(department_name.into()), None);
        emp.department_id = Some(department_id.to_string());
        employees.seed(emp);
    }
}

#[async_trait]
impl Storage for FakeStorage {
    async fn store_punch(&self, p: &AttendancePunch) -> Result<(), timekeep_core::Error> {
        self.punches.lock().unwrap().push(p.clone());
        Ok(())
    }
    async fn store_punches(&self, p: &[AttendancePunch]) -> Result<u64, timekeep_core::Error> {
        let mut g = self.punches.lock().unwrap();
        g.extend_from_slice(p);
        Ok(p.len() as u64)
    }
    async fn get_punch(&self, id: &str) -> Result<Option<AttendancePunch>, timekeep_core::Error> {
        Ok(self.punches.lock().unwrap().iter().find(|p| p.id == id).cloned())
    }
    async fn query_punches(
        &self,
        filter: &timekeep_core::PunchFilter,
    ) -> Result<Vec<AttendancePunch>, timekeep_core::Error> {
        let punches = self.punches.lock().unwrap();
        let mut result: Vec<AttendancePunch> = punches
            .iter()
            .filter(|p| {
                if let Some(ref ids) = filter.ids {
                    if ids.is_empty() {
                        return false;
                    }
                    return ids.contains(&p.id);
                }
                if let Some(ref sns) = filter.device_sns {
                    if !sns.is_empty() && !sns.iter().any(|sn| sn == &p.device_sn) {
                        return false;
                    }
                }
                if let Some(ref pins) = filter.user_pins {
                    if !pins.is_empty() && !pins.iter().any(|pin| pin == &p.user_pin) {
                        return false;
                    }
                }
                if let Some(ref since) = filter.since {
                    if p.timestamp < *since {
                        return false;
                    }
                }
                if let Some(ref until) = filter.until {
                    if p.timestamp > *until {
                        return false;
                    }
                }
                if let Some(ref statuses) = filter.statuses {
                    if !statuses.is_empty() && !statuses.iter().any(|s| s == &p.status) {
                        return false;
                    }
                } else if let Some(ref status) = filter.status {
                    if p.status != *status {
                        return false;
                    }
                }
                if let Some(ref mode) = filter.verify_mode {
                    if p.verify_mode != *mode {
                        return false;
                    }
                }
                if filter.anomalies_only.unwrap_or(false) && !p.is_anomaly {
                    return false;
                }
                true
            })
            .cloned()
            .collect();
        if filter.params.sort_by.as_deref() == Some("timestamp") {
            result.sort_by(|a, b| match filter.params.sort_order {
                timekeep_core::SortOrder::Asc => a.timestamp.cmp(&b.timestamp),
                timekeep_core::SortOrder::Desc => b.timestamp.cmp(&a.timestamp),
            });
        }
        let max_limit = if filter.unlimited { timekeep_core::REPORT_MAX_ROWS } else { 10_000 };
        let limit = filter.params.limit.min(max_limit) as usize;
        result.truncate(limit);
        Ok(result)
    }
    async fn punch_facets(
        &self,
        _: &timekeep_core::FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn device_facets(
        &self,
        _: &timekeep_core::FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn audit_facets(
        &self,
        _: &timekeep_core::FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn employee_facets(
        &self,
        _: &timekeep_core::FacetQuery,
    ) -> Result<Vec<timekeep_core::FacetGroup>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn upsert_device(&self, _: &Device) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn upsert_device_config(&self, c: &DeviceConfig) -> Result<(), timekeep_core::Error> {
        let mut d = self.devices.lock().unwrap();
        if let Some(e) = d.iter_mut().find(|x| x.serial_number == c.serial_number) {
            *e = c.clone();
        } else {
            d.push(c.clone());
        }
        Ok(())
    }
    async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, timekeep_core::Error> {
        Ok(self.devices.lock().unwrap().clone())
    }
    async fn list_device_configs_filtered(
        &self,
        _: &timekeep_core::query::DeviceFilter,
    ) -> Result<timekeep_core::query::ListResult<DeviceConfig>, timekeep_core::Error> {
        let items = self.devices.lock().unwrap().clone();
        Ok(timekeep_core::query::ListResult::single_page(items))
    }
    async fn delete_device_config(&self, sn: &str) -> Result<(), timekeep_core::Error> {
        self.devices.lock().unwrap().retain(|d| d.serial_number != sn);
        Ok(())
    }
    async fn latest_punch_for_device(
        &self,
        _: &str,
    ) -> Result<Option<jiff::Timestamp>, timekeep_core::Error> {
        Ok(None)
    }
    async fn punch_exists(&self, id: &str) -> Result<bool, timekeep_core::Error> {
        Ok(self.punches.lock().unwrap().iter().any(|p| p.id == id))
    }
    async fn get_user_name(&self, _: &str) -> Result<Option<String>, timekeep_core::Error> {
        Ok(None)
    }
    async fn count_device_users(&self, _: &str) -> Result<u32, timekeep_core::Error> {
        Ok(0)
    }
    async fn count_device_records(&self, _: &str) -> Result<u32, timekeep_core::Error> {
        Ok(0)
    }
    async fn list_device_users(
        &self,
        _: &str,
    ) -> Result<Vec<(String, String, Option<i32>)>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn health_check(&self) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn create_api_key(
        &self,
        key: &timekeep_core::model::ApiKey,
    ) -> Result<(), timekeep_core::Error> {
        self.api_keys.lock().unwrap().push(key.clone());
        Ok(())
    }
    async fn find_api_key_by_hash(
        &self,
        hash: &str,
    ) -> Result<Option<timekeep_core::model::ApiKey>, timekeep_core::Error> {
        Ok(self.api_keys.lock().unwrap().iter().find(|k| k.key_hash == hash).cloned())
    }
    async fn list_api_keys(
        &self,
    ) -> Result<Vec<timekeep_core::model::ApiKey>, timekeep_core::Error> {
        Ok(self.api_keys.lock().unwrap().clone())
    }
    async fn revoke_api_key(&self, id: &str) -> Result<(), timekeep_core::Error> {
        if let Some(k) = self.api_keys.lock().unwrap().iter_mut().find(|k| k.id == id) {
            k.revoked = true;
        }
        Ok(())
    }
    async fn touch_api_key(&self, _: &str) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn list_endpoints(&self) -> Result<Vec<IntegrationEndpoint>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn list_endpoints_filtered(
        &self,
        _: &timekeep_core::query::EndpointFilter,
    ) -> Result<timekeep_core::query::ListResult<IntegrationEndpoint>, timekeep_core::Error> {
        Ok(timekeep_core::query::ListResult::single_page(vec![]))
    }
    async fn create_endpoint(&self, _: &IntegrationEndpoint) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn update_endpoint(&self, _: &IntegrationEndpoint) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn delete_endpoint(&self, _: &str) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn get_system_settings(
        &self,
    ) -> Result<timekeep_core::model::SystemSettings, timekeep_core::Error> {
        Ok(self.settings.lock().unwrap().clone().unwrap_or_default())
    }
    async fn upsert_system_settings(
        &self,
        s: &timekeep_core::model::SystemSettings,
    ) -> Result<(), timekeep_core::Error> {
        *self.settings.lock().unwrap() = Some(s.clone());
        Ok(())
    }
    async fn record_audit(&self, entry: &AuditEvent) -> Result<(), timekeep_core::Error> {
        self.audit_logs.lock().unwrap().push(entry.clone());
        Ok(())
    }
    async fn query_audit_logs(
        &self,
        _: &AuditFilter,
    ) -> Result<timekeep_core::query::ListResult<AuditEvent>, timekeep_core::Error> {
        let items = self.audit_logs.lock().unwrap().clone();
        let len = items.len();
        Ok(timekeep_core::query::ListResult::paginated(items, len as u64, false, None))
    }
    async fn record_device_event(&self, _: &DeviceEvent) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn query_device_events(
        &self,
        _: &timekeep_core::query::DeviceEventFilter,
    ) -> Result<timekeep_core::query::ListResult<DeviceEvent>, timekeep_core::Error> {
        Ok(timekeep_core::query::ListResult::single_page(vec![]))
    }
    async fn query_device_audit_logs(
        &self,
        _device_sn: &str,
        _limit: u32,
        _offset: u32,
    ) -> Result<timekeep_core::query::ListResult<AuditEvent>, timekeep_core::Error> {
        Ok(timekeep_core::query::ListResult {
            items: vec![],
            has_more: false,
            total: None,
            next_cursor: None,
        })
    }
    async fn count_device_events(
        &self,
        _: &timekeep_core::query::DeviceEventFilter,
    ) -> Result<u64, timekeep_core::Error> {
        Ok(0)
    }
    async fn upsert_device_info(&self, _: &Device) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn get_device_info(&self, _: &str) -> Result<Option<Device>, timekeep_core::Error> {
        Ok(None)
    }
    async fn register_provider(&self, _: &ProviderInfo) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn list_providers(&self) -> Result<Vec<ProviderInfo>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn enqueue_pending_delivery(
        &self,
        _: &PendingDelivery,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn list_pending_deliveries(&self) -> Result<Vec<PendingDelivery>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn update_delivery_retry(
        &self,
        _id: &str,
        _attempt_count: i32,
        _next_retry_at: i64,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn delete_pending_delivery(&self, _: &str) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn move_to_dead_letter(
        &self,
        _id: &str,
        _last_error: Option<&str>,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }

    // ── Departments ────────────────────────────────────────────────
    async fn list_departments(
        &self,
    ) -> Result<Vec<timekeep_core::model::Department>, timekeep_core::Error> {
        Ok(self.departments.lock().unwrap().clone())
    }
    async fn get_department(
        &self,
        id: &str,
    ) -> Result<Option<timekeep_core::model::Department>, timekeep_core::Error> {
        Ok(self.departments.lock().unwrap().iter().find(|d| d.id.0 == id).cloned())
    }
    async fn get_department_by_name(
        &self,
        name: &str,
    ) -> Result<Option<timekeep_core::model::Department>, timekeep_core::Error> {
        Ok(self.departments.lock().unwrap().iter().find(|d| d.name == name).cloned())
    }
    async fn create_department(
        &self,
        d: &timekeep_core::model::Department,
    ) -> Result<(), timekeep_core::Error> {
        self.departments.lock().unwrap().push(d.clone());
        Ok(())
    }
    async fn update_department(
        &self,
        d: &timekeep_core::model::Department,
    ) -> Result<(), timekeep_core::Error> {
        let mut depts = self.departments.lock().unwrap();
        if let Some(e) = depts.iter_mut().find(|x| x.id.0 == d.id.0) {
            *e = d.clone();
        }
        Ok(())
    }
    async fn delete_department(&self, id: &str) -> Result<(), timekeep_core::Error> {
        self.departments.lock().unwrap().retain(|d| d.id.0 != id);
        Ok(())
    }

    // ── Device Groups ──────────────────────────────────────────────
    async fn list_device_groups(
        &self,
    ) -> Result<Vec<timekeep_core::model::DeviceGroup>, timekeep_core::Error> {
        Ok(self.device_groups.lock().unwrap().clone())
    }
    async fn get_device_group(
        &self,
        id: &str,
    ) -> Result<Option<timekeep_core::model::DeviceGroup>, timekeep_core::Error> {
        Ok(self.device_groups.lock().unwrap().iter().find(|g| g.id.0 == id).cloned())
    }
    async fn get_device_group_by_name(
        &self,
        name: &str,
    ) -> Result<Option<timekeep_core::model::DeviceGroup>, timekeep_core::Error> {
        Ok(self.device_groups.lock().unwrap().iter().find(|g| g.name == name).cloned())
    }
    async fn create_device_group(
        &self,
        g: &timekeep_core::model::DeviceGroup,
    ) -> Result<(), timekeep_core::Error> {
        self.device_groups.lock().unwrap().push(g.clone());
        Ok(())
    }
    async fn update_device_group(
        &self,
        g: &timekeep_core::model::DeviceGroup,
    ) -> Result<(), timekeep_core::Error> {
        let mut groups = self.device_groups.lock().unwrap();
        if let Some(e) = groups.iter_mut().find(|x| x.id.0 == g.id.0) {
            *e = g.clone();
        }
        Ok(())
    }
    async fn delete_device_group(&self, id: &str) -> Result<(), timekeep_core::Error> {
        self.device_groups.lock().unwrap().retain(|g| g.id.0 != id);
        Ok(())
    }
    async fn list_devices_in_group(
        &self,
        group_id: &str,
    ) -> Result<Vec<DeviceConfig>, timekeep_core::Error> {
        Ok(self
            .devices
            .lock()
            .unwrap()
            .iter()
            .filter(|d| d.group_id.as_deref() == Some(group_id))
            .cloned()
            .collect())
    }
    async fn set_device_group_membership(
        &self,
        device_sn: &str,
        group_id: Option<&str>,
    ) -> Result<(), timekeep_core::Error> {
        let mut devices = self.devices.lock().unwrap();
        if let Some(d) = devices.iter_mut().find(|d| d.serial_number == device_sn) {
            d.group_id = group_id.map(String::from);
        }
        Ok(())
    }

    // ── Work Policy Templates ──────────────────────────────────────
    async fn list_work_policy_templates(
        &self,
    ) -> Result<Vec<timekeep_core::model::WorkPolicyTemplate>, timekeep_core::Error> {
        Ok(self.work_policy_templates.lock().unwrap().clone())
    }
    async fn get_work_policy_template(
        &self,
        id: &str,
    ) -> Result<Option<timekeep_core::model::WorkPolicyTemplate>, timekeep_core::Error> {
        Ok(self.work_policy_templates.lock().unwrap().iter().find(|t| t.id == id).cloned())
    }
    async fn get_work_policy_template_by_title(
        &self,
        title: &str,
    ) -> Result<Option<timekeep_core::model::WorkPolicyTemplate>, timekeep_core::Error> {
        Ok(self.work_policy_templates.lock().unwrap().iter().find(|t| t.title == title).cloned())
    }
    async fn create_work_policy_template(
        &self,
        tpl: &timekeep_core::model::WorkPolicyTemplate,
    ) -> Result<(), timekeep_core::Error> {
        self.work_policy_templates.lock().unwrap().push(tpl.clone());
        Ok(())
    }
    async fn update_work_policy_template(
        &self,
        tpl: &timekeep_core::model::WorkPolicyTemplate,
    ) -> Result<(), timekeep_core::Error> {
        let mut templates = self.work_policy_templates.lock().unwrap();
        if let Some(e) = templates.iter_mut().find(|t| t.id == tpl.id) {
            *e = tpl.clone();
        }
        Ok(())
    }
    async fn delete_work_policy_template(&self, id: &str) -> Result<(), timekeep_core::Error> {
        self.work_policy_templates.lock().unwrap().retain(|t| t.id != id);
        Ok(())
    }

    // ── Dashboard Users ────────────────────────────────────────────
    async fn create_dashboard_user(
        &self,
        user: &DashboardUser,
    ) -> Result<(), timekeep_core::Error> {
        self.dashboard_users.lock().unwrap().push(user.clone());
        Ok(())
    }
    async fn find_dashboard_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<DashboardUser>, timekeep_core::Error> {
        if username == "admin" {
            // Pre-computed: SHA-256("test-salt:admin")
            let hash = "7ef9cc5c2bfabf3f40da2aaa8ad91ec2a82b4f056a3c717e1f1f6ec9f9d2dfa5";
            return Ok(Some(DashboardUser {
                id: "test-admin".into(),
                username: "admin".into(),
                password_hash: hash.to_string(),
                salt: "test-salt".into(),
                role: timekeep_core::model::Role::Admin,
                permissions: timekeep_core::model::PermissionSet::all(),
                display_name: "Admin".into(),
                active: true,
                created_at: 0,
                updated_at: 0,
            }));
        }
        Ok(self.dashboard_users.lock().unwrap().iter().find(|u| u.username == username).cloned())
    }
    async fn list_dashboard_users(
        &self,
        _: &timekeep_core::query::ListParams,
    ) -> Result<timekeep_core::query::ListResult<DashboardUser>, timekeep_core::Error> {
        let items = self.dashboard_users.lock().unwrap().clone();
        let len = items.len();
        Ok(timekeep_core::query::ListResult::paginated(items, len as u64, false, None))
    }
    async fn update_dashboard_user(
        &self,
        user: &DashboardUser,
    ) -> Result<(), timekeep_core::Error> {
        let mut users = self.dashboard_users.lock().unwrap();
        if let Some(e) = users.iter_mut().find(|u| u.id == user.id) {
            *e = user.clone();
        }
        Ok(())
    }
    async fn delete_dashboard_user(&self, id: &str) -> Result<(), timekeep_core::Error> {
        self.dashboard_users.lock().unwrap().retain(|u| u.id != id);
        Ok(())
    }
    async fn update_dashboard_user_password(
        &self,
        _: &str,
        _: &str,
        _: &str,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════
// FakeEmployeeStore
// ═══════════════════════════════════════════════════════════════════════

pub struct FakeEmployeeStore {
    pub employees: StdMutex<Vec<timekeep_core::model::Employee>>,
}

impl FakeEmployeeStore {
    pub fn new() -> Self {
        Self { employees: StdMutex::new(Vec::new()) }
    }

    pub fn seed(&self, emp: timekeep_core::model::Employee) {
        self.employees.lock().unwrap().push(emp);
    }
}

#[async_trait]
impl timekeep_core::traits::employee_store::EmployeeStore for FakeEmployeeStore {
    async fn create_employee(
        &self,
        employee: &timekeep_core::model::Employee,
    ) -> Result<(), timekeep_core::Error> {
        self.employees.lock().unwrap().push(employee.clone());
        Ok(())
    }
    async fn find_employee(
        &self,
        _: &timekeep_core::model::EmployeeId,
    ) -> Result<Option<timekeep_core::model::Employee>, timekeep_core::Error> {
        Ok(None)
    }
    async fn find_employee_by_pin(
        &self,
        pin: &str,
    ) -> Result<Option<timekeep_core::model::Employee>, timekeep_core::Error> {
        Ok(self.employees.lock().unwrap().iter().find(|e| e.pin == pin).cloned())
    }
    async fn find_employee_by_external_id(
        &self,
        _: &str,
    ) -> Result<Option<timekeep_core::model::Employee>, timekeep_core::Error> {
        Ok(None)
    }
    async fn list_employees(
        &self,
        _: &timekeep_core::query::ListParams,
    ) -> Result<
        timekeep_core::query::ListResult<timekeep_core::model::Employee>,
        timekeep_core::Error,
    > {
        let items = self.employees.lock().unwrap().clone();
        let len = items.len();
        Ok(timekeep_core::query::ListResult::paginated(items, len as u64, false, None))
    }
    async fn update_employee(
        &self,
        _: &timekeep_core::model::Employee,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn deactivate_employee(
        &self,
        _: &timekeep_core::model::EmployeeId,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn count_employees_in_department(
        &self,
        department_id: &str,
    ) -> Result<u64, timekeep_core::Error> {
        Ok(self
            .employees
            .lock()
            .unwrap()
            .iter()
            .filter(|e| e.department_id.as_deref() == Some(department_id) && e.active)
            .count() as u64)
    }
    async fn count_active_employees(&self) -> Result<u64, timekeep_core::Error> {
        Ok(self.employees.lock().unwrap().iter().filter(|e| e.active).count() as u64)
    }
    async fn create_enrollment(
        &self,
        _: &timekeep_core::model::DeviceEnrollment,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
    async fn find_enrollment(
        &self,
        _: &timekeep_core::model::EmployeeId,
        _: &str,
    ) -> Result<Option<timekeep_core::model::DeviceEnrollment>, timekeep_core::Error> {
        Ok(None)
    }
    async fn list_enrollments_for_employee(
        &self,
        _: &timekeep_core::model::EmployeeId,
    ) -> Result<Vec<timekeep_core::model::DeviceEnrollment>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn list_enrollments_for_device(
        &self,
        _: &str,
    ) -> Result<Vec<timekeep_core::model::DeviceEnrollment>, timekeep_core::Error> {
        Ok(vec![])
    }
    async fn delete_enrollment(
        &self,
        _: &timekeep_core::model::EmployeeId,
        _: &str,
    ) -> Result<(), timekeep_core::Error> {
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════
// App Builder
// ═══════════════════════════════════════════════════════════════════════

/// Build the full management API router using the public `management_router()`.
/// Returns (router, storage) for pre-seeding data.
pub fn test_app() -> (Router, Arc<FakeStorage>) {
    let storage = Arc::new(FakeStorage::new());
    let storage_clone = storage.clone();
    let router = timekeep_api::management_router(RouterConfig {
        event_bus: EventBus::default(),
        storage: storage as Arc<dyn Storage>,
        employees: None,
        onboarding: None,
        search: None,
        device_state: DeviceConnectionState::default(),
        provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
        engine_health: EngineHealth::default(),
    });
    (router, storage_clone)
}

/// Build a management router with an employee store.
pub fn test_app_with_employees(
    storage: Arc<FakeStorage>,
    employees: Arc<FakeEmployeeStore>,
) -> Router {
    timekeep_api::management_router(RouterConfig {
        event_bus: EventBus::default(),
        storage: storage as Arc<dyn Storage>,
        employees: Some(employees as Arc<dyn timekeep_core::traits::employee_store::EmployeeStore>),
        onboarding: None,
        search: None,
        device_state: DeviceConnectionState::default(),
        provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
        engine_health: EngineHealth::default(),
    })
}

// ═══════════════════════════════════════════════════════════════════════
// Auth Helpers
// ═══════════════════════════════════════════════════════════════════════

pub async fn login_as_admin(app: &Router) -> String {
    let body = serde_json::json!({"username": "admin", "password": "admin"});
    let req = axum::http::Request::post("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();
    let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
    let body_bytes = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    v["data"]["token"].as_str().unwrap().to_string()
}

pub fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

// ═══════════════════════════════════════════════════════════════════════
// Punch Factory
// ═══════════════════════════════════════════════════════════════════════

pub fn make_punch(
    pin: &str,
    device_sn: &str,
    ts_epoch: i64,
    status: timekeep_core::model::PunchStatus,
) -> AttendancePunch {
    let ts = jiff::Timestamp::from_second(ts_epoch).unwrap();
    let mut p = AttendancePunch {
        id: String::new(),
        device_sn: device_sn.into(),
        user_pin: pin.into(),
        timestamp: ts,
        local_time: None,
        time_offset_secs: None,
        timezone_name: None,
        status,
        verify_mode: timekeep_core::model::VerifyMode::Fingerprint,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        is_anomaly: false,
        anomaly_type: None,
        raw_data: None,
    };
    p.id = p.generate_deduplication_id();
    p
}

pub fn check_in(pin: &str, device: &str, ts_epoch: i64) -> AttendancePunch {
    make_punch(pin, device, ts_epoch, timekeep_core::model::PunchStatus::CheckIn)
}

pub fn check_out(pin: &str, device: &str, ts_epoch: i64) -> AttendancePunch {
    make_punch(pin, device, ts_epoch, timekeep_core::model::PunchStatus::CheckOut)
}

pub fn today_at(hour: i8, minute: i8) -> i64 {
    let now = jiff::Timestamp::now();
    let z = now.to_zoned(jiff::tz::TimeZone::UTC);
    let today = z.datetime().date();
    jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(hour, minute, 0, 0).unwrap())
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
        .as_second()
}

// ═══════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════

pub async fn send(
    app: &Router,
    req: axum::http::Request<axum::body::Body>,
) -> (axum::http::StatusCode, serde_json::Value) {
    let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
    let status = resp.status();
    let body_bytes = axum::body::to_bytes(resp.into_body(), 20_480).await.unwrap();
    let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap_or_default();
    (status, body)
}

pub fn get_authed(path: &str, token: &str) -> axum::http::Request<axum::body::Body> {
    axum::http::Request::get(path)
        .header("Authorization", auth_header(token))
        .body(axum::body::Body::empty())
        .unwrap()
}

pub fn post_authed(
    path: &str,
    token: &str,
    body: serde_json::Value,
) -> axum::http::Request<axum::body::Body> {
    axum::http::Request::post(path)
        .header("content-type", "application/json")
        .header("Authorization", auth_header(token))
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

pub fn put_authed(
    path: &str,
    token: &str,
    body: serde_json::Value,
) -> axum::http::Request<axum::body::Body> {
    axum::http::Request::put(path)
        .header("content-type", "application/json")
        .header("Authorization", auth_header(token))
        .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

pub fn delete_authed(path: &str, token: &str) -> axum::http::Request<axum::body::Body> {
    axum::http::Request::delete(path)
        .header("Authorization", auth_header(token))
        .body(axum::body::Body::empty())
        .unwrap()
}

pub fn assert_success(body: &serde_json::Value) {
    assert!(body["error"].is_null(), "expected no error, got: {:?}", body["error"]);
    assert!(!body["data"].is_null(), "expected data to be present");
}

pub fn assert_error(body: &serde_json::Value, expected_code: &str) {
    assert!(!body["error"].is_null(), "expected error to be present");
    assert_eq!(body["error"]["code"], expected_code);
    assert!(body["data"].is_null(), "expected data to be null on error");
}
