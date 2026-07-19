use super::SqliteStorage;
use crate::punch::FacetRow;
use timekeep_core::{Error, FacetGroup, FacetKind, FacetOption, FacetQuery};

// ── Employee row types ────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub(super) struct EmployeeRow {
    id: String,
    pin: String,
    name: String,
    department: Option<String>,
    department_id: Option<String>,
    external_id: Option<String>,
    joined_at: Option<String>,
    active: i32,
    created_at: String,
    updated_at: String,
}

impl EmployeeRow {
    fn into_employee(self) -> timekeep_core::Employee {
        let created_at = self
            .created_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);
        let updated_at = self
            .updated_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);
        let joined_at = self
            .joined_at
            .and_then(|s| s.parse::<i64>().ok())
            .and_then(|secs| jiff::Timestamp::from_second(secs).ok());

        timekeep_core::Employee {
            id: timekeep_core::EmployeeId::from(self.id),
            pin: self.pin,
            name: self.name,
            department_id: self.department_id,
            department: self.department,
            external_id: self.external_id,
            joined_at,
            active: self.active != 0,
            created_at,
            updated_at,
        }
    }
}

#[derive(sqlx::FromRow)]
pub(super) struct EnrollmentRow {
    employee_id: String,
    device_sn: String,
    pin: String,
    biometric_types: String,
    fingerprint_count: i32,
    face_enrolled: i32,
    card_number: Option<String>,
    enrolled_at: String,
}

impl EnrollmentRow {
    fn into_enrollment(self) -> Result<timekeep_core::DeviceEnrollment, Error> {
        let biometric_types: Vec<timekeep_core::BiometricType> =
            serde_json::from_str(&self.biometric_types).unwrap_or_default();

        let enrolled_at = self
            .enrolled_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);

        Ok(timekeep_core::DeviceEnrollment {
            employee_id: timekeep_core::EmployeeId::from(self.employee_id),
            device_sn: self.device_sn,
            pin: self.pin,
            biometric_types,
            fingerprint_count: self.fingerprint_count as u32,
            face_enrolled: self.face_enrolled != 0,
            card_number: self.card_number,
            fingerprint_templates: vec![],
            enrolled_at,
        })
    }
}

#[derive(sqlx::FromRow)]
struct FingerprintTemplateRow {
    finger_index: i32,
    template_data: Vec<u8>,
    size_bytes: i32,
    downloaded_at: i64,
}

/// Simple base64 encode an i64 for cursor pagination.
fn base64_encode_i64(value: i64) -> String {
    timekeep_core::encode_offset_cursor(value)
}

/// Simple base64 decode for cursor pagination.
fn base64_decode_i64(encoded: &str) -> Option<i64> {
    let cursor = timekeep_core::Cursor::decode(encoded)?;
    match cursor.values.first()? {
        timekeep_core::CursorValue::Int(i) => Some(*i),
        _ => None,
    }
}

// ── EmployeeStore methods ───────────────────────────────────────

impl SqliteStorage {
    pub(super) async fn create_employee(
        &self,
        employee: &timekeep_core::Employee,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO employees (id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(employee.id.to_string())
        .bind(&employee.pin)
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.department_id)
        .bind(&employee.external_id)
        .bind(employee.joined_at.map(|t| t.as_second().to_string()))
        .bind(employee.active as i32)
        .bind(employee.created_at.as_second().to_string())
        .bind(employee.updated_at.as_second().to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create employee: {e}")))?;
        Ok(())
    }

    pub(super) async fn find_employee(
        &self,
        id: &timekeep_core::EmployeeId,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at
             FROM employees WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    pub(super) async fn find_employee_by_pin(
        &self,
        pin: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at
             FROM employees WHERE pin = ?",
        )
        .bind(pin)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee by pin: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    pub(super) async fn find_employee_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at
             FROM employees WHERE external_id = ?",
        )
        .bind(external_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee by external_id: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    pub(super) async fn list_employees(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::Employee>, Error> {
        let limit = params.clamped_limit() as i64;
        let offset: i64 = params.cursor.as_ref().and_then(|c| base64_decode_i64(c)).unwrap_or(0);

        let search = params.search.as_deref().unwrap_or("");
        let search_pattern = timekeep_core::sanitize_search(search);

        let rows = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at
             FROM employees
             WHERE (pin LIKE ? OR name LIKE ?)
             ORDER BY name ASC
             LIMIT ? OFFSET ?",
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list employees: {e}")))?;

        let has_more = rows.len() >= params.clamped_limit() as usize;
        let next_cursor =
            if has_more { rows.last().map(|_| base64_encode_i64(offset + limit)) } else { None };

        Ok(timekeep_core::ListResult {
            items: rows.into_iter().map(EmployeeRow::into_employee).collect(),
            total: None,
            has_more,
            next_cursor,
        })
    }

    pub(super) async fn update_employee(
        &self,
        employee: &timekeep_core::Employee,
    ) -> Result<(), Error> {
        let rows = sqlx::query(
            "UPDATE employees SET name = ?, department = ?, department_id = ?, external_id = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.department_id)
        .bind(&employee.external_id)
        .bind(employee.updated_at.as_second().to_string())
        .bind(employee.id.to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update employee: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("employee {}", employee.id)));
        }
        Ok(())
    }

    pub(super) async fn deactivate_employee(
        &self,
        id: &timekeep_core::EmployeeId,
    ) -> Result<(), Error> {
        let rows = sqlx::query("UPDATE employees SET active = 0, updated_at = ? WHERE id = ?")
            .bind(jiff::Timestamp::now().as_second().to_string())
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("deactivate employee: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("employee {}", id)));
        }
        Ok(())
    }

    pub(super) async fn count_employees_in_department(
        &self,
        department_id: &str,
    ) -> Result<u64, Error> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM employees WHERE department_id = ? AND active = 1",
        )
        .bind(department_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("count employees in department: {e}")))?;

        Ok(count as u64)
    }

    /// Count all active employees with a single `SELECT COUNT(*)`.
    pub(super) async fn count_active_employees(&self) -> Result<u64, Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM employees WHERE active = 1")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count active employees: {e}")))?;
        Ok(count as u64)
    }

    // ── Enrollments ────────────────────────────────────────────────

    pub(super) async fn create_enrollment(
        &self,
        enrollment: &timekeep_core::DeviceEnrollment,
    ) -> Result<(), Error> {
        let biometric_json = serde_json::to_string(&enrollment.biometric_types)
            .map_err(|e| Error::validation(format!("serialize biometric types: {e}")))?;

        sqlx::query(
            "INSERT OR REPLACE INTO device_enrollments
             (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(enrollment.employee_id.to_string())
        .bind(&enrollment.device_sn)
        .bind(&enrollment.pin)
        .bind(&biometric_json)
        .bind(enrollment.fingerprint_count as i32)
        .bind(enrollment.face_enrolled as i32)
        .bind(&enrollment.card_number)
        .bind(enrollment.enrolled_at.as_second().to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create enrollment: {e}")))?;
        Ok(())
    }

    pub(super) async fn find_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<Option<timekeep_core::DeviceEnrollment>, Error> {
        let row = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE employee_id = ? AND device_sn = ?",
        )
        .bind(employee_id.to_string())
        .bind(device_sn)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find enrollment: {e}")))?;
        Ok(row.and_then(|r| r.into_enrollment().ok()))
    }

    pub(super) async fn list_enrollments_for_employee(
        &self,
        employee_id: &timekeep_core::EmployeeId,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        let rows = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE employee_id = ?",
        )
        .bind(employee_id.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list enrollments for employee: {e}")))?;

        rows.into_iter().map(|r| r.into_enrollment()).collect()
    }

    pub(super) async fn list_enrollments_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        let rows = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE device_sn = ?",
        )
        .bind(device_sn)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list enrollments for device: {e}")))?;

        rows.into_iter().map(|r| r.into_enrollment()).collect()
    }

    pub(super) async fn delete_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<(), Error> {
        sqlx::query("DELETE FROM device_enrollments WHERE employee_id = ? AND device_sn = ?")
            .bind(employee_id.to_string())
            .bind(device_sn)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete enrollment: {e}")))?;
        Ok(())
    }

    // Fingerprint Templates

    pub(super) async fn store_fingerprint_template(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
        template: &timekeep_core::FingerprintTemplate,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO fingerprint_templates
             (employee_id, device_sn, finger_index, template_data, size_bytes, downloaded_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(employee_id.to_string())
        .bind(device_sn)
        .bind(template.finger_index as i32)
        .bind(&template.data)
        .bind(template.size_bytes as i32)
        .bind(template.downloaded_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("store fingerprint template: {e}")))?;
        Ok(())
    }

    pub(super) async fn load_fingerprint_templates(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<Vec<timekeep_core::FingerprintTemplate>, Error> {
        let rows = sqlx::query_as::<_, FingerprintTemplateRow>(
            "SELECT finger_index, template_data, size_bytes, downloaded_at
             FROM fingerprint_templates
             WHERE employee_id = ? AND device_sn = ?
             ORDER BY finger_index",
        )
        .bind(employee_id.to_string())
        .bind(device_sn)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("load fingerprint templates: {e}")))?;

        rows.into_iter()
            .map(|row| {
                jiff::Timestamp::from_second(row.downloaded_at)
                    .map(|ts| timekeep_core::FingerprintTemplate {
                        finger_index: row.finger_index as u8,
                        data: row.template_data,
                        size_bytes: row.size_bytes as u32,
                        downloaded_at: ts,
                    })
                    .map_err(|e| Error::storage(format!("invalid timestamp: {e}")))
            })
            .collect()
    }

    /// Return faceted filter metadata for employees.
    pub(super) async fn employee_facets(
        &self,
        query: &FacetQuery,
    ) -> Result<Vec<FacetGroup>, Error> {
        let dimension = query.dimension.as_deref();
        let mut groups = Vec::new();

        if dimension.is_none() || dimension == Some("department") {
            groups.push(self.facet_employee_departments(query).await?);
        }
        if dimension.is_none() || dimension == Some("active") {
            groups.push(self.facet_employee_active(query).await?);
        }

        Ok(groups)
    }

    async fn facet_employee_departments(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT e.department as value, COALESCE(e.department, 'No Department') as label, CAST(COUNT(*) AS INTEGER) as count
             FROM employees e WHERE e.department IS NOT NULL AND e.department != ''",
        );

        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder.push(" AND e.department LIKE ");
            builder.push_bind(pattern);
            builder.push(" ESCAPE '\\'");
        }

        self.push_generic_filters(&mut builder, &query.context, "e");

        builder.push(" GROUP BY e.department ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);

        let rows: Vec<FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet employee departments: {e}")))?;

        let has_more = rows.len() >= query.clamped_limit() as usize;

        Ok(FacetGroup {
            key: "department".into(),
            label: "Department".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(|r| r.into_option()).collect(),
            has_more,
            total: None,
        })
    }

    async fn facet_employee_active(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::ACTIVE_VALUES;

        let mut options = Vec::with_capacity(ACTIVE_VALUES.len());
        for (value, label) in ACTIVE_VALUES {
            let bool_val: i32 = if *value == "true" { 1 } else { 0 };
            let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM employees e WHERE e.active = ",
            );
            builder.push_bind(bool_val);
            self.push_generic_filters(&mut builder, &query.context, "e");

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet employee active {value}: {e}")))?;

            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));

        Ok(FacetGroup {
            key: "active".into(),
            label: "Status".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use timekeep_core::model::department::Department;
    use timekeep_core::{Employee, ListParams};

    #[tokio::test]
    async fn test_create_and_list_employees() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("123", "Ahmed", Some("Engineering".into()), None);
        storage.create_employee(&emp).await.expect("should create");

        let list = storage.list_employees(&ListParams::default()).await.expect("should list");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].name, "Ahmed");
        assert_eq!(list.items[0].pin, "123");
        assert_eq!(list.items[0].department.as_deref(), Some("Engineering"));
    }

    #[tokio::test]
    async fn test_create_multiple_employees() {
        let storage = crate::test_storage().await;

        for (pin, name) in [("101", "Ahmed"), ("102", "Fatima"), ("103", "Omar")] {
            let emp = Employee::new(pin, name, None, None);
            storage.create_employee(&emp).await.expect("should create");
        }

        let list = storage.list_employees(&ListParams::default()).await.expect("should list");
        assert_eq!(list.items.len(), 3);
    }

    #[tokio::test]
    async fn test_find_employee_by_id() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("145", "Ahmed", None, None);
        storage.create_employee(&emp).await.expect("should create");

        let found =
            storage.find_employee(&emp.id).await.expect("should find").expect("should exist");
        assert_eq!(found.name, "Ahmed");
        assert_eq!(found.pin, "145");
    }

    #[tokio::test]
    async fn test_find_employee_not_found() {
        let storage = crate::test_storage().await;

        let found =
            storage.find_employee(&timekeep_core::EmployeeId::new()).await.expect("should query");
        assert!(found.is_none());
    }

    #[tokio::test]
    async fn test_find_employee_by_pin() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("999", "Khalid", None, None);
        storage.create_employee(&emp).await.expect("should create");

        let found =
            storage.find_employee_by_pin("999").await.expect("should find").expect("should exist");
        assert_eq!(found.name, "Khalid");

        // Non-existent PIN returns None
        let missing = storage.find_employee_by_pin("000").await.expect("should query");
        assert!(missing.is_none());
    }

    #[tokio::test]
    async fn test_find_employee_by_external_id() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("200", "Sara", None, Some("ODOO-42".into()));
        storage.create_employee(&emp).await.expect("should create");

        let found = storage
            .find_employee_by_external_id("ODOO-42")
            .await
            .expect("should find")
            .expect("should exist");
        assert_eq!(found.name, "Sara");
        assert_eq!(found.external_id.as_deref(), Some("ODOO-42"));

        // Non-existent external_id returns None
        let missing =
            storage.find_employee_by_external_id("NONEXISTENT").await.expect("should query");
        assert!(missing.is_none());
    }

    #[tokio::test]
    async fn test_update_employee() {
        let storage = crate::test_storage().await;

        let mut emp = Employee::new("300", "Ali", Some("Sales".into()), None);
        storage.create_employee(&emp).await.expect("should create");

        emp.rename("Ali Mohammed");
        emp.department = Some("Marketing".into());
        storage.update_employee(&emp).await.expect("should update");

        let found =
            storage.find_employee(&emp.id).await.expect("should find").expect("should exist");
        assert_eq!(found.name, "Ali Mohammed");
        assert_eq!(found.department.as_deref(), Some("Marketing"));
    }

    #[tokio::test]
    async fn test_update_employee_nonexistent_fails() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("400", "Ghost", None, None);
        let err = storage.update_employee(&emp).await.unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[tokio::test]
    async fn test_deactivate_employee() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("500", "Zaid", None, None);
        storage.create_employee(&emp).await.expect("should create");

        storage.deactivate_employee(&emp.id).await.expect("should deactivate");

        let found = storage
            .find_employee(&emp.id)
            .await
            .expect("should find")
            .expect("should still exist (soft delete)");
        assert!(!found.active);
    }

    #[tokio::test]
    async fn test_deactivate_nonexistent_fails() {
        let storage = crate::test_storage().await;

        let err = storage.deactivate_employee(&timekeep_core::EmployeeId::new()).await.unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[tokio::test]
    async fn test_employee_with_department_id() {
        let storage = crate::test_storage().await;

        // Create a real department first so the FK reference is valid
        let dept = Department::new("Engineering", None);
        storage.create_department(&dept).await.expect("should create department");

        // Simulate what the API does: resolve department → set both id and name
        let mut emp = Employee::new("600", "Noor", Some("Engineering".into()), None);
        emp.department_id = Some(dept.id.0.clone());
        storage.create_employee(&emp).await.expect("should create");

        let found =
            storage.find_employee(&emp.id).await.expect("should find").expect("should exist");
        assert_eq!(found.department_id.as_deref(), Some(dept.id.0.as_str()));
        assert_eq!(found.department.as_deref(), Some("Engineering"));
    }

    #[tokio::test]
    async fn test_employee_without_department() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("700", "Layla", None, None);
        storage.create_employee(&emp).await.expect("should create");

        let found =
            storage.find_employee(&emp.id).await.expect("should find").expect("should exist");
        assert!(found.department_id.is_none());
        assert!(found.department.is_none());
    }

    #[tokio::test]
    async fn test_list_employees_with_search() {
        let storage = crate::test_storage().await;

        for (pin, name) in [("801", "Ahmed"), ("802", "Fatima"), ("803", "Omar")] {
            let emp = Employee::new(pin, name, None, None);
            storage.create_employee(&emp).await.expect("should create");
        }

        // Search by name
        let params = ListParams { search: Some("Fatima".into()), ..ListParams::default() };
        let result = storage.list_employees(&params).await.expect("should list");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "Fatima");

        // Search by PIN
        let params = ListParams { search: Some("801".into()), ..ListParams::default() };
        let result = storage.list_employees(&params).await.expect("should list");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].pin, "801");

        // Search with no match
        let params = ListParams { search: Some("Zargon".into()), ..ListParams::default() };
        let result = storage.list_employees(&params).await.expect("should list");
        assert!(result.items.is_empty());
    }

    #[tokio::test]
    async fn test_list_employees_pagination() {
        let storage = crate::test_storage().await;

        for i in 0..5u8 {
            let emp = Employee::new(format!("90{i}"), format!("Employee {i}"), None, None);
            storage.create_employee(&emp).await.expect("should create");
        }

        // First page: limit 3
        let params = ListParams { limit: 3, ..ListParams::default() };
        let page1 = storage.list_employees(&params).await.expect("should list");
        assert_eq!(page1.items.len(), 3);
        assert!(page1.has_more);
        assert!(page1.next_cursor.is_some());

        // Second page: use cursor
        let params =
            ListParams { limit: 3, cursor: page1.next_cursor.clone(), ..ListParams::default() };
        let page2 = storage.list_employees(&params).await.expect("should list");
        assert_eq!(page2.items.len(), 2);
        assert!(!page2.has_more);

        // Verify no overlap between pages
        let page1_pins: Vec<&str> = page1.items.iter().map(|e| e.pin.as_str()).collect();
        let page2_pins: Vec<&str> = page2.items.iter().map(|e| e.pin.as_str()).collect();
        for pin in &page2_pins {
            assert!(!page1_pins.contains(pin), "page2 pin {pin} should not be in page1");
        }
    }

    #[tokio::test]
    async fn test_create_employee_duplicate_pin() {
        let storage = crate::test_storage().await;

        let emp1 = Employee::new("111", "First", None, None);
        storage.create_employee(&emp1).await.expect("should create");

        let emp2 = Employee::new("111", "Second", None, None);
        let err = storage.create_employee(&emp2).await.unwrap_err();
        assert!(err.to_string().contains("UNIQUE"), "expected UNIQUE constraint error, got: {err}");
    }

    #[tokio::test]
    async fn test_employee_active_default() {
        let storage = crate::test_storage().await;

        let emp = Employee::new("222", "Active", None, None);
        assert!(emp.active, "new employee should be active by default");
        storage.create_employee(&emp).await.expect("should create");

        let found =
            storage.find_employee(&emp.id).await.expect("should find").expect("should exist");
        assert!(found.active);
    }

    // ─── Count Employees in Department ─────────────────────────────

    #[tokio::test]
    async fn test_count_employees_in_department() {
        let storage = crate::test_storage().await;

        // Create department first (FK constraint)
        let dept = timekeep_core::Department::new("Engineering", None);
        storage.create_department(&dept).await.expect("should create dept");
        let dept_id = dept.id.0.clone();

        // Create employees in the department
        let mut emp1 = Employee::new("301", "Alice", None, None);
        emp1.department_id = Some(dept_id.clone());
        let mut emp2 = Employee::new("302", "Bob", None, None);
        emp2.department_id = Some(dept_id.clone());
        // An inactive employee — should not be counted
        let mut emp3 = Employee::new("303", "Charlie", None, None);
        emp3.department_id = Some(dept_id.clone());
        emp3.active = false;

        storage.create_employee(&emp1).await.unwrap();
        storage.create_employee(&emp2).await.unwrap();
        storage.create_employee(&emp3).await.unwrap();

        let count = storage.count_employees_in_department(&dept_id).await.expect("should count");
        assert_eq!(count, 2, "only active employees should be counted");
    }

    #[tokio::test]
    async fn test_count_employees_empty_department() {
        let storage = crate::test_storage().await;
        let count =
            storage.count_employees_in_department("nonexistent-dept").await.expect("should count");
        assert_eq!(count, 0);
    }
}
