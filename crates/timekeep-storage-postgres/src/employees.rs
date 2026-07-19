use super::PostgresStorage;
use timekeep_core::{Error, FacetGroup, FacetKind, FacetOption, FacetQuery};

// ── Cursor helpers ────────────────────────────────────────────────

/// Cursor helper: encode an i64 offset as URL-safe base64.
fn base64_encode_i64(value: i64) -> String {
    timekeep_core::encode_offset_cursor(value)
}

/// Cursor helper: decode a URL-safe base64 cursor back to an i64 offset.
fn base64_decode_i64(encoded: &str) -> Option<i64> {
    let cursor = timekeep_core::Cursor::decode(encoded)?;
    match cursor.values.first()? {
        timekeep_core::CursorValue::Int(i) => Some(*i),
        _ => None,
    }
}

// ── Row types ─────────────────────────────────────────────────────

/// Row type for the `employees` table (PostgreSQL).
#[derive(sqlx::FromRow)]
pub(super) struct EmployeeRow {
    id: String,
    pin: String,
    name: String,
    department: Option<String>,
    department_id: Option<String>,
    external_id: Option<String>,
    joined_at: Option<i64>,
    active: i32,
    created_at: i64,
    updated_at: i64,
}

impl EmployeeRow {
    fn into_employee(self) -> timekeep_core::Employee {
        let created_at = jiff::Timestamp::from_second(self.created_at)
            .unwrap_or_else(|_| jiff::Timestamp::now());
        let updated_at = jiff::Timestamp::from_second(self.updated_at)
            .unwrap_or_else(|_| jiff::Timestamp::now());
        let joined_at = self.joined_at.and_then(|secs| jiff::Timestamp::from_second(secs).ok());

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

/// Row type for the `device_enrollments` table (PostgreSQL).
#[derive(sqlx::FromRow)]
pub(super) struct EnrollmentRow {
    employee_id: String,
    device_sn: String,
    pin: String,
    biometric_types: String,
    fingerprint_count: i32,
    face_enrolled: i32,
    card_number: Option<String>,
    enrolled_at: i64,
}

impl EnrollmentRow {
    fn into_enrollment(self) -> Result<timekeep_core::DeviceEnrollment, Error> {
        let biometric_types: Vec<timekeep_core::BiometricType> =
            serde_json::from_str(&self.biometric_types).unwrap_or_default();

        let enrolled_at = jiff::Timestamp::from_second(self.enrolled_at)
            .unwrap_or_else(|_| jiff::Timestamp::now());

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

// ── EmployeeStore inherent methods ────────────────────────────────

impl PostgresStorage {
    pub(super) async fn create_employee(
        &self,
        employee: &timekeep_core::Employee,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO employees (id, pin, name, department, department_id, external_id, joined_at, active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(employee.id.to_string())
        .bind(&employee.pin)
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.department_id)
        .bind(&employee.external_id)
        .bind(employee.joined_at.map(|t| t.as_second()))
        .bind(employee.active as i32)
        .bind(employee.created_at.as_second())
        .bind(employee.updated_at.as_second())
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
             FROM employees WHERE id = $1",
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
             FROM employees WHERE pin = $1",
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
             FROM employees WHERE external_id = $1",
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
             WHERE (pin LIKE $1 ESCAPE '\\' OR name LIKE $2 ESCAPE '\\')
             ORDER BY name ASC
             LIMIT $3 OFFSET $4",
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
            "UPDATE employees SET name = $1, department = $2, department_id = $3, external_id = $4, updated_at = $5
             WHERE id = $6",
        )
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.department_id)
        .bind(&employee.external_id)
        .bind(employee.updated_at.as_second())
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
        let rows = sqlx::query("UPDATE employees SET active = 0, updated_at = $1 WHERE id = $2")
            .bind(jiff::Timestamp::now().as_second())
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("deactivate employee: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("employee {id}")));
        }
        Ok(())
    }

    pub(super) async fn count_employees_in_department(
        &self,
        department_id: &str,
    ) -> Result<u64, Error> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM employees WHERE department_id = $1 AND active = 1",
        )
        .bind(department_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("count employees in department: {e}")))?;

        Ok(count as u64)
    }

    pub(super) async fn count_active_employees(&self) -> Result<u64, Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM employees WHERE active = TRUE")
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
            "INSERT INTO device_enrollments
             (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (employee_id, device_sn) DO UPDATE SET
                 pin = EXCLUDED.pin,
                 biometric_types = EXCLUDED.biometric_types,
                 fingerprint_count = EXCLUDED.fingerprint_count,
                 face_enrolled = EXCLUDED.face_enrolled,
                 card_number = EXCLUDED.card_number,
                 enrolled_at = EXCLUDED.enrolled_at",
        )
        .bind(enrollment.employee_id.to_string())
        .bind(&enrollment.device_sn)
        .bind(&enrollment.pin)
        .bind(&biometric_json)
        .bind(enrollment.fingerprint_count as i32)
        .bind(enrollment.face_enrolled as i32)
        .bind(&enrollment.card_number)
        .bind(enrollment.enrolled_at.as_second())
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
             FROM device_enrollments WHERE employee_id = $1 AND device_sn = $2",
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
             FROM device_enrollments WHERE employee_id = $1",
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
             FROM device_enrollments WHERE device_sn = $1",
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
        sqlx::query("DELETE FROM device_enrollments WHERE employee_id = $1 AND device_sn = $2")
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
            "INSERT INTO fingerprint_templates
             (employee_id, device_sn, finger_index, template_data, size_bytes, downloaded_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (employee_id, device_sn, finger_index) DO UPDATE SET
               template_data = EXCLUDED.template_data,
               size_bytes = EXCLUDED.size_bytes,
               downloaded_at = EXCLUDED.downloaded_at",
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
             WHERE employee_id = $1 AND device_sn = $2
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
            groups.push(self.pg_facet_employee_departments(query).await?);
        }
        if dimension.is_none() || dimension == Some("active") {
            groups.push(self.pg_facet_employee_active(query).await?);
        }

        Ok(groups)
    }

    async fn pg_facet_employee_departments(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT e.department as value, COALESCE(e.department, 'No Department') as label, CAST(COUNT(*) AS BIGINT) as count
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
        self.pg_push_generic_filters(&mut builder, &query.context, "e");
        builder.push(" GROUP BY e.department ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);
        let rows = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet employee departments: {e}")))?;
        let has_more = rows.len() >= query.clamped_limit() as usize;
        Ok(FacetGroup {
            key: "department".into(),
            label: "Department".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(|r: super::punch::FacetRow| r.into_option()).collect(),
            has_more,
            total: None,
        })
    }

    async fn pg_facet_employee_active(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::ACTIVE_VALUES;
        let mut options = Vec::with_capacity(ACTIVE_VALUES.len());
        for (value, label) in ACTIVE_VALUES {
            let bool_val: i32 = if *value == "true" { 1 } else { 0 };
            let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM employees e WHERE e.active = ",
            );
            builder.push_bind(bool_val);
            self.pg_push_generic_filters(&mut builder, &query.context, "e");
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
