use super::PostgresStorage;
use sqlx::QueryBuilder;
use timekeep_core::{
    Cursor, Error, FacetGroup, FacetKind, FacetOption, FacetQuery, PUNCH_SCHEMA, PunchFilter,
    model::AttendancePunch,
};

// ─── Row types for sqlx query_as ────────────────────────────────────

#[derive(sqlx::FromRow)]
pub(super) struct PunchRow {
    id: String,
    device_sn: String,
    user_pin: String,
    timestamp: String,
    local_time: Option<String>,
    time_offset_secs: Option<i32>,
    timezone_name: Option<String>,
    status: i32,
    verify_mode: Option<i32>,
    work_code: Option<String>,
    raw_data: Option<String>,
    employee_name: Option<String>,
    device_label: Option<String>,
    is_anomaly: Option<bool>,
    anomaly_type: Option<String>,
}

impl PunchRow {
    fn into_punch(self) -> Result<AttendancePunch, Error> {
        let ts = self
            .timestamp
            .parse::<i64>()
            .map_err(|e| Error::storage(format!("parse timestamp: {e}")))?;
        let timestamp = jiff::Timestamp::from_second(ts)
            .map_err(|e| Error::storage(format!("timestamp from second: {e}")))?;

        let local_time = self
            .local_time
            .and_then(|s| s.parse::<i64>().ok())
            .and_then(|secs| jiff::Timestamp::from_second(secs).ok());

        Ok(AttendancePunch {
            id: self.id,
            device_sn: self.device_sn,
            user_pin: self.user_pin,
            timestamp,
            local_time,
            time_offset_secs: self.time_offset_secs,
            timezone_name: self.timezone_name,
            status: timekeep_core::PunchStatus::try_from(self.status)
                .unwrap_or(timekeep_core::PunchStatus::CheckIn),
            verify_mode: self
                .verify_mode
                .map(timekeep_core::VerifyMode::from)
                .unwrap_or(timekeep_core::VerifyMode::Fingerprint),
            work_code: self.work_code,
            sub_status: None,
            employee_name: self.employee_name,
            device_label: self.device_label,
            is_anomaly: self.is_anomaly.unwrap_or(false),
            anomaly_type: self.anomaly_type,
            raw_data: self.raw_data,
        })
    }
}

#[derive(sqlx::FromRow)]
pub(super) struct TimestampRow {
    timestamp: String,
}

/// Row type for facet queries (value, label, count).
#[derive(sqlx::FromRow)]
pub(crate) struct FacetRow {
    value: String,
    label: String,
    count: i64,
}

impl FacetRow {
    pub(super) fn into_option(self) -> timekeep_core::FacetOption {
        timekeep_core::FacetOption {
            value: self.value,
            label: self.label,
            count: Some(self.count as u64),
        }
    }
}

// ── Facet helpers ─────────────────────────────────────────────

impl PostgresStorage {
    /// Build the WHERE clause fragment for contextual facet counts (punch-specific).
    fn pg_push_context_clauses<'a>(
        &self,
        builder: &mut QueryBuilder<'a, sqlx::Postgres>,
        context: &'a timekeep_core::FacetContext,
    ) {
        if let Some(ref sns) = context.device_sns
            && !sns.is_empty()
        {
            builder.push(" AND p.device_sn IN (");
            let mut separated = builder.separated(", ");
            for sn in sns {
                separated.push_bind(sn);
            }
            separated.push_unseparated(")");
        }
        if let Some(ref since) = context.since {
            builder.push(" AND p.timestamp >= ");
            builder.push_bind(since.as_second().to_string());
        }
        if let Some(ref until) = context.until {
            builder.push(" AND p.timestamp <= ");
            builder.push_bind(until.as_second().to_string());
        }
        if let Some(ref status) = context.status {
            builder.push(" AND p.status = ");
            builder.push_bind(*status as i32);
        }
        if let Some(ref verify_mode) = context.verify_mode {
            builder.push(" AND p.verify_mode = ");
            builder.push_bind(*verify_mode as i32);
        }
        if context.anomalies_only.unwrap_or(false) {
            builder.push(" AND p.is_anomaly = TRUE");
        }
        // Also apply generic filters
        self.pg_push_generic_filters(builder, context, "p");
    }

    /// Apply generic entity-agnostic context filters as SQL WHERE clauses (Postgres).
    pub(crate) fn pg_push_generic_filters<'a>(
        &self,
        builder: &mut QueryBuilder<'a, sqlx::Postgres>,
        context: &'a timekeep_core::FacetContext,
        table_alias: &str,
    ) {
        let prefix = if table_alias.is_empty() { String::new() } else { format!("{table_alias}.") };

        for (key, values) in &context.filters {
            if values.is_empty() {
                continue;
            }
            if values.len() == 1 {
                builder.push(format!(" AND {prefix}{key} = "));
                builder.push_bind(values[0].clone());
            } else {
                builder.push(format!(" AND {prefix}{key} IN ("));
                let mut separated = builder.separated(", ");
                for v in values {
                    separated.push_bind(v.clone());
                }
                separated.push_unseparated(")");
            }
        }
    }

    pub(super) async fn pg_facet_devices(
        &self,
        query: &FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT d.serial_number as value, COALESCE(d.label, d.serial_number) as label, CAST(COUNT(*) AS BIGINT) as count FROM attendance_punches p LEFT JOIN devices d ON d.serial_number = p.device_sn WHERE 1=1",
        );
        self.pg_push_context_clauses(&mut builder, &query.context);
        builder.push(" GROUP BY d.serial_number ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);
        let rows: Vec<FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet devices: {e}")))?;
        Ok(FacetGroup {
            key: "device_sn".into(),
            label: "Device".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(FacetRow::into_option).collect(),
            has_more: false,
            total: None,
        })
    }

    pub(super) async fn pg_facet_statuses(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::STATUS_VALUES;
        let mut options = Vec::with_capacity(STATUS_VALUES.len());
        for (value, label) in STATUS_VALUES {
            let code = timekeep_core::facet::status_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM attendance_punches p WHERE 1=1 AND p.status = ",
            );
            builder.push_bind(code);
            self.pg_push_context_clauses(&mut builder, &query.context);
            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet status: {e}")))?;
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|b| std::cmp::Reverse(b.count.unwrap_or(0)));
        Ok(FacetGroup {
            key: "status".into(),
            label: "Status".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    pub(super) async fn pg_facet_verify_modes(
        &self,
        query: &FacetQuery,
    ) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::VERIFY_MODE_VALUES;
        let mut options = Vec::with_capacity(VERIFY_MODE_VALUES.len());
        for (value, label) in VERIFY_MODE_VALUES {
            let code = timekeep_core::facet::verify_mode_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM attendance_punches p WHERE 1=1 AND p.verify_mode = ",
            );
            builder.push_bind(code);
            self.pg_push_context_clauses(&mut builder, &query.context);
            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet verify_mode: {e}")))?;
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|b| std::cmp::Reverse(b.count.unwrap_or(0)));
        Ok(FacetGroup {
            key: "verify_mode".into(),
            label: "Method".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    pub(super) async fn pg_facet_employees(
        &self,
        query: &FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT p.user_pin as value, COALESCE(e.name, u.name, p.user_pin) as label, CAST(COUNT(*) AS BIGINT) as count FROM attendance_punches p LEFT JOIN employees e ON e.pin = p.user_pin LEFT JOIN users u ON u.pin = p.user_pin WHERE 1=1",
        );
        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder
                .push(" AND (e.name LIKE ")
                .push_bind(pattern.clone())
                .push(" ESCAPE '\\' OR u.name LIKE ")
                .push_bind(pattern.clone())
                .push(" ESCAPE '\\' OR p.user_pin LIKE ")
                .push_bind(pattern)
                .push(" ESCAPE '\\')");
        }
        self.pg_push_context_clauses(&mut builder, &query.context);
        builder
            .push(" GROUP BY p.user_pin, e.name, u.name ORDER BY count DESC LIMIT ")
            .push_bind(limit);
        let rows: Vec<FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet employees: {e}")))?;
        let has_more = rows.len() >= query.clamped_limit() as usize;
        Ok(FacetGroup {
            key: "employee".into(),
            label: "Employee".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(FacetRow::into_option).collect(),
            has_more,
            total: None,
        })
    }

    // ── Punch storage methods ───────────────────────────────────

    pub(super) async fn get_punch(&self, id: &str) -> Result<Option<AttendancePunch>, Error> {
        let row = sqlx::query_as::<_, PunchRow>(
            "SELECT p.id, p.device_sn, p.user_pin, p.timestamp, p.local_time, p.time_offset_secs, p.timezone_name, p.status, p.verify_mode, p.work_code, p.raw_data,
                    p.is_anomaly, p.anomaly_type,
                    COALESCE(e.name, u.name) as employee_name,
                    d.label as device_label
             FROM attendance_punches p
             LEFT JOIN users u ON u.pin = p.user_pin
             LEFT JOIN employees e ON e.pin = p.user_pin
             LEFT JOIN devices d ON d.serial_number = p.device_sn
             WHERE p.id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get punch: {e}")))?;

        row.map(|r| r.into_punch()).transpose()
    }

    pub(super) async fn store_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        let dedup_id = punch.generate_deduplication_id();
        let ts = punch.timestamp.as_second().to_string();

        sqlx::query(
            "INSERT INTO attendance_punches
             (id, device_sn, user_pin, timestamp, local_time, time_offset_secs, timezone_name, status, verify_mode, work_code, raw_data, is_anomaly, anomaly_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(&dedup_id)
        .bind(&punch.device_sn)
        .bind(&punch.user_pin)
        .bind(&ts)
        .bind(punch.local_time.map(|t| t.as_second().to_string()))
        .bind(punch.time_offset_secs)
        .bind(&punch.timezone_name)
        .bind(punch.status as i32)
        .bind(punch.verify_mode as i32)
        .bind(&punch.work_code)
        .bind(&punch.raw_data)
        .bind(punch.is_anomaly)
        .bind(&punch.anomaly_type)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("insert punch: {e}")))?;

        Ok(())
    }

    pub(super) async fn store_punches(&self, punches: &[AttendancePunch]) -> Result<u64, Error> {
        if punches.is_empty() {
            return Ok(0);
        }

        let mut tx =
            self.pool.begin().await.map_err(|e| Error::storage(format!("begin tx: {e}")))?;

        let mut count = 0u64;
        for punch in punches {
            let dedup_id = punch.generate_deduplication_id();
            let ts = punch.timestamp.as_second().to_string();
            let result = sqlx::query(
                "INSERT INTO attendance_punches
                 (id, device_sn, user_pin, timestamp, local_time, time_offset_secs, timezone_name, status, verify_mode, work_code, raw_data, is_anomaly, anomaly_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO NOTHING",
            )
            .bind(&dedup_id)
            .bind(&punch.device_sn)
            .bind(&punch.user_pin)
            .bind(&ts)
            .bind(punch.local_time.map(|t| t.as_second().to_string()))
            .bind(punch.time_offset_secs)
            .bind(&punch.timezone_name)
            .bind(punch.status as i32)
            .bind(punch.verify_mode as i32)
            .bind(&punch.work_code)
            .bind(&punch.raw_data)
            .bind(punch.is_anomaly)
            .bind(&punch.anomaly_type)
            .execute(&mut *tx)
            .await
            .map_err(|e| Error::storage(format!("batch insert punch: {e}")))?;

            count += result.rows_affected();
        }

        tx.commit().await.map_err(|e| Error::storage(format!("commit tx: {e}")))?;
        Ok(count)
    }

    pub(super) async fn query_punches(
        &self,
        filter: &PunchFilter,
    ) -> Result<Vec<AttendancePunch>, Error> {
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT p.id, p.device_sn, p.user_pin, p.timestamp, p.local_time, p.time_offset_secs, p.timezone_name, p.status, p.verify_mode, p.work_code, p.raw_data,
                    p.is_anomaly, p.anomaly_type,
                    COALESCE(e.name, u.name) as employee_name,
                    d.label as device_label
             FROM attendance_punches p
             LEFT JOIN users u ON u.pin = p.user_pin
             LEFT JOIN employees e ON e.pin = p.user_pin
             LEFT JOIN devices d ON d.serial_number = p.device_sn
             WHERE 1=1",
        );

        if let Some(sns) = &filter.device_sns {
            if !sns.is_empty() {
                builder.push(" AND p.device_sn IN (");
                let mut separated = builder.separated(", ");
                for sn in sns {
                    separated.push_bind(sn);
                }
                separated.push_unseparated(")");
            }
        }
        // ── User PIN filter ─────────────────────────────────────────────
        if let Some(pins) = &filter.user_pins {
            if !pins.is_empty() {
                builder.push(" AND p.user_pin IN (");
                let mut separated = builder.separated(", ");
                for pin in pins {
                    separated.push_bind(pin);
                }
                separated.push_unseparated(")");
            }
        }
        if let Some(since) = &filter.since {
            builder.push(" AND p.timestamp >= ");
            builder.push_bind(since.as_second().to_string());
        }
        if let Some(until) = &filter.until {
            builder.push(" AND p.timestamp <= ");
            builder.push_bind(until.as_second().to_string());
        }
        if let Some(statuses) = &filter.statuses
            && !statuses.is_empty()
        {
            builder.push(" AND p.status IN (");
            let mut separated = builder.separated(", ");
            for s in statuses {
                separated.push_bind(*s as i32);
            }
            separated.push_unseparated(")");
        } else if let Some(status) = &filter.status {
            builder.push(" AND p.status = ");
            builder.push_bind(*status as i32);
        }
        if let Some(verify_mode) = &filter.verify_mode {
            builder.push(" AND p.verify_mode = ");
            builder.push_bind(*verify_mode as i32);
        }
        if filter.anomalies_only.unwrap_or(false) {
            builder.push(" AND p.is_anomaly = TRUE");
        }
        // ── Batch ID lookup (used by Tantivy search cross-reference) ──
        if let Some(ids) = &filter.ids {
            if ids.is_empty() {
                // Empty ID list: return nothing (can't match any punch)
                return Ok(vec![]);
            }
            builder.push(" AND p.id IN (");
            let mut separated = builder.separated(", ");
            for id in ids {
                separated.push_bind(id);
            }
            separated.push_unseparated(")");
        }
        if let Some(search) = &filter.params.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder.push(" AND (p.user_pin LIKE ");
            builder.push_bind(pattern.clone());
            builder.push(" ESCAPE '\\' OR u.name LIKE ");
            builder.push_bind(pattern.clone());
            builder.push(" ESCAPE '\\' OR e.name LIKE ");
            builder.push_bind(pattern);
            builder.push(" ESCAPE '\\')");
        }

        // ── Sort: use schema for column validation ──
        let schema = &PUNCH_SCHEMA;
        let (sort_col, sort_dir) =
            schema.sort_column(filter.params.sort_by.as_deref(), filter.params.sort_order);

        // ── Keyset pagination: WHERE clause for cursor-based pagination ──
        // Prefer pre-decoded cursor_after (set by API route). Fall back to
        // decoding params.cursor so tests and direct callers work.
        let effective_cursor: Option<Cursor> = filter
            .cursor_after
            .clone()
            .or_else(|| filter.params.cursor.as_deref().and_then(Cursor::decode));

        if let Some(cursor) = &effective_cursor {
            let cursor_cols: Vec<(&str, &str, _)> =
                schema.cursor_columns(filter.params.sort_by.as_deref());
            let sql_exprs: Vec<&str> = cursor_cols.iter().map(|(_, sql, _)| *sql).collect();
            let directions: Vec<timekeep_core::SortOrder> = vec![sort_dir; sql_exprs.len()];

            let parts = cursor.keyset_where_parts(&sql_exprs, &directions);
            builder.push(" AND ");
            for fragment in &parts.fragments {
                match fragment {
                    timekeep_core::query::cursor::KeysetFragment::Sql(sql) => {
                        builder.push(sql);
                    },
                    timekeep_core::query::cursor::KeysetFragment::Bind(val) => {
                        builder.push_bind(val.as_bind_value());
                    },
                }
            }
        }

        // ── ORDER BY: sort column + tiebreaker for stable pagination ──
        let tiebreaker_sql = schema.sql_column(schema.tiebreaker);
        let tiebreaker_dir = sort_dir.as_sql();
        builder.push(format!(
            " ORDER BY {sort_col} {tiebreaker_dir}, {tiebreaker_sql} {tiebreaker_dir}"
        ));

        let limit = filter.params.clamped_limit();
        builder.push(" LIMIT ");
        builder.push_bind(limit as i64);

        let rows = builder
            .build_query_as::<PunchRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("query punches: {e}")))?;

        rows.into_iter().map(|r| r.into_punch()).collect::<Result<Vec<_>, _>>()
    }

    pub(super) async fn punch_facets(&self, query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        let limit = query.clamped_limit() as i64;
        let dimensions: Vec<&str> = if let Some(ref dim) = query.dimension {
            if !timekeep_core::FacetDimension::is_valid_punch_dimension(dim) {
                return Err(Error::storage(format!("unknown facet dimension: {dim}")));
            }
            vec![&dim[..]]
        } else {
            vec!["device_sn", "status", "verify_mode", "employee"]
        };

        let mut groups = Vec::with_capacity(dimensions.len());
        for dim_key in dimensions {
            let group = match dim_key {
                "device_sn" => self.pg_facet_devices(query, limit).await?,
                "status" => self.pg_facet_statuses(query).await?,
                "verify_mode" => self.pg_facet_verify_modes(query).await?,
                "employee" => self.pg_facet_employees(query, limit).await?,
                _ => unreachable!(),
            };
            groups.push(group);
        }
        Ok(groups)
    }

    pub(super) async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        let result = sqlx::query_as::<_, TimestampRow>(
            "SELECT timestamp FROM attendance_punches
             WHERE device_sn = $1 ORDER BY timestamp DESC LIMIT 1",
        )
        .bind(device_sn)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("latest punch query: {e}")))?;

        match result {
            Some(row) => {
                let ts = row
                    .timestamp
                    .parse::<i64>()
                    .map_err(|e| Error::storage(format!("parse timestamp: {e}")))?;
                jiff::Timestamp::from_second(ts)
                    .map(Some)
                    .map_err(|e| Error::storage(format!("timestamp conversion: {e}")))
            },
            None => Ok(None),
        }
    }

    pub(super) async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error> {
        let exists =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM attendance_punches WHERE id = $1")
                .bind(dedup_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("punch exists check: {e}")))?;

        Ok(exists > 0)
    }

    pub(super) async fn count_device_records(&self, device_sn: &str) -> Result<u32, Error> {
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM attendance_punches WHERE device_sn = $1")
                .bind(device_sn)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("count device records: {e}")))?;
        Ok(count as u32)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use timekeep_core::model::{PunchStatus, VerifyMode};

    fn test_punch(pin: &str, device_sn: &str, ts_sec: i64, status: PunchStatus) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(ts_sec).unwrap();
        let mut punch = AttendancePunch {
            id: String::new(),
            device_sn: device_sn.to_string(),
            user_pin: pin.to_string(),
            timestamp: ts,
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
            raw_data: None,
        };
        punch.id = punch.generate_deduplication_id();
        punch
    }

    async fn get_storage() -> Option<PostgresStorage> {
        crate::test_storage().await
    }

    // ─── Single Punch Storage ───────────────────────────────────────

    #[tokio::test]
    async fn test_store_punch_inserts() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("should store");

        let filter = PunchFilter::default();
        let results = storage.query_punches(&filter).await.expect("should query");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].user_pin, "145");
        assert_eq!(results[0].device_sn, "DEV001");
        assert_eq!(results[0].status, PunchStatus::CheckIn);
    }

    #[tokio::test]
    async fn test_store_punch_idempotent() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("first insert");
        storage.store_punch(&punch).await.expect("second insert (should be ignored)");

        let results = storage.query_punches(&PunchFilter::default()).await.expect("should query");
        assert_eq!(results.len(), 1, "duplicate should be IGNOREd");
    }

    #[tokio::test]
    async fn test_punch_exists_finds_stored() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);
        let dedup_id = punch.id.clone();

        storage.store_punch(&punch).await.expect("should store");

        assert!(storage.punch_exists(&dedup_id).await.expect("should check"));
    }

    #[tokio::test]
    async fn test_punch_exists_returns_false_for_missing() {
        let Some(storage) = get_storage().await else {
            return;
        };
        assert!(!storage.punch_exists("nonexistent-id").await.expect("should check"));
    }

    // ─── Batch Storage ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_store_punches_batch() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let punches: Vec<_> = (0..10)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "DEV001",
                    1752129600 + i as i64,
                    PunchStatus::CheckIn,
                )
            })
            .collect();

        let stored = storage.store_punches(&punches).await.expect("batch store");
        assert_eq!(stored, 10);

        let results = storage.query_punches(&PunchFilter::default()).await.expect("should query");
        assert_eq!(results.len(), 10);
    }

    #[tokio::test]
    async fn test_store_punches_batch_with_duplicates() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let punches: Vec<_> = (0..5)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "DEV001",
                    1752129600 + i as i64,
                    PunchStatus::CheckIn,
                )
            })
            .collect();

        assert_eq!(storage.store_punches(&punches).await.unwrap(), 5);
        assert_eq!(
            storage.store_punches(&punches).await.unwrap(),
            0,
            "duplicates should not be counted"
        );

        let results = storage.query_punches(&PunchFilter::default()).await.unwrap();
        assert_eq!(results.len(), 5);
    }

    // ─── Query Filters ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_query_filter_by_device() {
        let Some(storage) = get_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV002", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "DEV001", 1752129602, PunchStatus::CheckOut))
            .await
            .unwrap();

        let filter = PunchFilter { device_sns: Some(vec!["DEV001".into()]), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.device_sn, "DEV001");
        }
    }

    #[tokio::test]
    async fn test_query_filter_by_user_pin() {
        let Some(storage) = get_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129602, PunchStatus::CheckOut))
            .await
            .unwrap();

        let filter = PunchFilter { user_pins: Some(vec!["145".into()]), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.user_pin, "145");
        }
    }

    #[tokio::test]
    async fn test_query_filter_by_time_range() {
        let Some(storage) = get_storage().await else {
            return;
        };
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    "145",
                    "DEV001",
                    1752129600 + i as i64 * 60,
                    PunchStatus::CheckIn,
                ))
                .await
                .unwrap();
        }

        let since = jiff::Timestamp::from_second(1752129660).unwrap();
        let until = jiff::Timestamp::from_second(1752129840).unwrap();

        let filter = PunchFilter { since: Some(since), until: Some(until), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 4);
    }

    #[tokio::test]
    async fn test_query_order_desc() {
        let Some(storage) = get_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129700, PunchStatus::CheckIn))
            .await
            .unwrap();

        let filter = PunchFilter::default();
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        // Default sort is timestamp desc
        assert!(results[0].timestamp.as_second() > results[1].timestamp.as_second());
    }

    #[tokio::test]
    async fn test_query_limit() {
        let Some(storage) = get_storage().await else {
            return;
        };
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    &format!("{i}"),
                    "DEV001",
                    1752129600 + i as i64,
                    PunchStatus::CheckIn,
                ))
                .await
                .unwrap();
        }

        let filter = PunchFilter {
            params: timekeep_core::ListParams { limit: 3, ..Default::default() },
            ..Default::default()
        };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 3);
    }

    // ─── Latest Punch ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_latest_punch_for_device() {
        let Some(storage) = get_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129700, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "DEV002", 1752129800, PunchStatus::CheckIn))
            .await
            .unwrap();

        let latest = storage
            .latest_punch_for_device("DEV001")
            .await
            .expect("should query")
            .expect("should have a punch");
        assert_eq!(latest.as_second(), 1752129700);
    }

    #[tokio::test]
    async fn test_latest_punch_for_device_none() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let result = storage.latest_punch_for_device("NONEXISTENT").await.unwrap();
        assert!(result.is_none());
    }
}
