use super::PostgresStorage;
use timekeep_core::{Error, FacetGroup, FacetKind, FacetOption, FacetQuery};

#[derive(sqlx::FromRow)]
pub(super) struct DeviceEventRowPg {
    id: String,
    device_sn: String,
    timestamp: i64,
    event_type: String,
    metadata_json: serde_json::Value,
}

impl DeviceEventRowPg {
    fn into_event(self) -> timekeep_core::DeviceEvent {
        let ts =
            jiff::Timestamp::from_second(self.timestamp).unwrap_or(jiff::Timestamp::UNIX_EPOCH);
        let metadata: std::collections::HashMap<String, String> =
            serde_json::from_value(self.metadata_json).unwrap_or_default();
        let event_type = timekeep_core::DeviceEventType::from_key(&self.event_type);
        timekeep_core::DeviceEvent {
            id: self.id,
            device_sn: self.device_sn,
            timestamp: ts,
            event_type,
            metadata,
        }
    }
}

#[derive(sqlx::FromRow)]
struct AuditRowPg {
    id: String,
    timestamp: i64,
    actor: String,
    action: String,
    resource: String,
    detail_json: Option<serde_json::Value>,
    ip_address: Option<String>,
    status: String,
    error_message: Option<String>,
}

impl AuditRowPg {
    fn into_audit_event(self) -> timekeep_core::AuditEvent {
        let detail = self.detail_json.and_then(|v| if v.is_null() { None } else { Some(v) });
        timekeep_core::AuditEvent {
            id: self.id,
            timestamp: self.timestamp,
            actor: self.actor,
            action: self.action,
            resource: self.resource,
            detail,
            ip_address: self.ip_address,
            status: self.status,
            error_message: self.error_message,
        }
    }
}

impl PostgresStorage {
    pub(super) async fn record_device_event(
        &self,
        event: &timekeep_core::DeviceEvent,
    ) -> Result<(), Error> {
        let metadata = serde_json::to_value(&event.metadata).unwrap_or_default();
        let ts = event.timestamp.as_second();

        sqlx::query(
            "INSERT INTO device_events (id, device_sn, timestamp, event_type, metadata_json)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&event.id)
        .bind(&event.device_sn)
        .bind(ts)
        .bind(event.event_type.key())
        .bind(&metadata)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("record device event: {e}")))?;

        Ok(())
    }

    pub(super) async fn query_device_events(
        &self,
        filter: &timekeep_core::DeviceEventFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DeviceEvent>, Error> {
        let limit = filter.params.limit.min(200) as i64;
        let mut sql = String::from(
            "SELECT id, device_sn, timestamp, event_type, metadata_json
             FROM device_events WHERE 1=1",
        );
        let mut param_idx = 1u32;

        if filter.device_sn.is_some() {
            sql.push_str(&format!(" AND device_sn = ${param_idx}"));
            param_idx += 1;
        }
        if let Some(ref types) = filter.event_types {
            let placeholders: Vec<String> = types
                .iter()
                .map(|_| {
                    let p = param_idx;
                    param_idx += 1;
                    format!("${p}")
                })
                .collect();
            sql.push_str(&format!(" AND event_type IN ({})", placeholders.join(",")));
        }
        if filter.since.is_some() {
            sql.push_str(&format!(" AND timestamp >= ${param_idx}"));
            param_idx += 1;
        }
        if filter.until.is_some() {
            sql.push_str(&format!(" AND timestamp <= ${param_idx}"));
        }
        sql.push_str(&format!(" ORDER BY timestamp DESC LIMIT {limit}"));

        let mut query = sqlx::query_as::<_, DeviceEventRowPg>(&sql);
        if let Some(ref sn) = filter.device_sn {
            query = query.bind(sn);
        }
        if let Some(ref types) = filter.event_types {
            for t in types {
                query = query.bind(t.key());
            }
        }
        if let Some(since) = filter.since {
            query = query.bind(since.as_second());
        }
        if let Some(until) = filter.until {
            query = query.bind(until.as_second());
        }

        let rows: Vec<DeviceEventRowPg> = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("query device events: {e}")))?;

        let items: Vec<timekeep_core::DeviceEvent> =
            rows.into_iter().map(|r| r.into_event()).collect();
        let total = items.len() as u64;
        let has_more = items.len() >= filter.params.limit.min(200) as usize;

        Ok(timekeep_core::ListResult::paginated(items, total, has_more, None))
    }

    pub(super) async fn count_device_events(
        &self,
        filter: &timekeep_core::DeviceEventFilter,
    ) -> Result<u64, Error> {
        let mut sql = String::from("SELECT COUNT(*) FROM device_events WHERE 1=1");
        let mut idx = 1u32;

        if filter.device_sn.is_some() {
            sql.push_str(&format!(" AND device_sn = ${idx}"));
            idx += 1;
        }
        if filter.since.is_some() {
            sql.push_str(&format!(" AND timestamp >= ${idx}"));
            idx += 1;
        }
        if filter.until.is_some() {
            sql.push_str(&format!(" AND timestamp <= ${idx}"));
        }

        let mut query = sqlx::query_scalar::<_, i64>(&sql);
        if let Some(ref sn) = filter.device_sn {
            query = query.bind(sn);
        }
        if let Some(since) = filter.since {
            query = query.bind(since.as_second());
        }
        if let Some(until) = filter.until {
            query = query.bind(until.as_second());
        }

        let count: i64 = query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count device events: {e}")))?;

        Ok(count as u64)
    }

    // ── Audit log CRUD ────────────────────────────────────────────

    pub(super) async fn record_audit(
        &self,
        event: &timekeep_core::AuditEvent,
    ) -> Result<(), Error> {
        let detail = event.detail.as_ref();

        sqlx::query(
            "INSERT INTO audit_logs (id, timestamp, actor, action, resource, detail_json, ip_address, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(&event.id)
        .bind(event.timestamp)
        .bind(&event.actor)
        .bind(&event.action)
        .bind(&event.resource)
        .bind(detail)
        .bind(&event.ip_address)
        .bind(&event.status)
        .bind(&event.error_message)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("record audit: {e}")))?;

        Ok(())
    }

    pub(super) async fn query_audit_logs(
        &self,
        filter: &timekeep_core::AuditFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::AuditEvent>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = "timestamp";
        let sort_dir = filter.sort_order.as_sql();
        let limit = filter.limit.clamp(1, 200) as i64;

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref actor) = filter.actor {
            let n = where_values.len() + 1;
            where_clauses.push(format!("actor = ${n}"));
            where_values.push(actor.clone());
        }
        if let Some(ref action) = filter.action {
            let n = where_values.len() + 1;
            where_clauses.push(format!("action LIKE ${n} ESCAPE '\\'"));
            where_values.push(sanitize_search(action));
        }
        if let Some(ref resource) = filter.resource {
            let n = where_values.len() + 1;
            where_clauses.push(format!("resource = ${n}"));
            where_values.push(resource.clone());
        }
        if let Some(ref search) = filter.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            let n = where_values.len() + 1;
            let n2 = n + 1;
            let n3 = n + 2;
            where_clauses.push(format!(
                "(actor LIKE ${n} ESCAPE '\\' OR action LIKE ${n2} ESCAPE '\\' OR resource LIKE ${n3} ESCAPE '\\')"
            ));
            where_values.push(pattern.clone());
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }
        if let Some(ref since) = filter.since {
            let n = where_values.len() + 1;
            where_clauses.push(format!("timestamp >= ${n}"));
            where_values.push(since.as_second().to_string());
        }
        if let Some(ref until) = filter.until {
            let n = where_values.len() + 1;
            where_clauses.push(format!("timestamp <= ${n}"));
            where_values.push(until.as_second().to_string());
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // Count total
        let count_sql = format!("SELECT COUNT(*) FROM audit_logs {where_sql}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        for val in &where_values {
            count_query = count_query.bind(val);
        }
        let total: i64 = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count audit: {e}")))?;

        let query_sql = format!(
            "SELECT id, timestamp, actor, action, resource, detail_json, ip_address, status, error_message
             FROM audit_logs {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT {limit}"
        );
        let mut query = sqlx::query_as::<_, AuditRowPg>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }

        let rows: Vec<AuditRowPg> = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("query audit: {e}")))?;

        let items: Vec<timekeep_core::AuditEvent> =
            rows.into_iter().map(|r| r.into_audit_event()).collect();

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    /// Return faceted filter metadata for audit logs.
    pub(super) async fn audit_facets(&self, query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        let dimension = query.dimension.as_deref();
        let mut groups = Vec::new();

        if dimension.is_none() || dimension == Some("actor") {
            groups.push(self.pg_facet_audit_actors(query).await?);
        }
        if dimension.is_none() || dimension == Some("action") {
            groups.push(self.pg_facet_audit_actions(query).await?);
        }
        if dimension.is_none() || dimension == Some("status") {
            groups.push(self.pg_facet_audit_statuses(query).await?);
        }

        Ok(groups)
    }

    async fn pg_facet_audit_actors(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT a.actor as value, a.actor as label, CAST(COUNT(*) AS BIGINT) as count
             FROM audit_logs a WHERE 1=1",
        );
        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder.push(" AND a.actor LIKE ");
            builder.push_bind(pattern);
            builder.push(" ESCAPE '\\'");
        }
        self.pg_push_generic_filters(&mut builder, &query.context, "a");
        builder.push(" GROUP BY a.actor ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);
        let rows: Vec<crate::punch::FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet audit actors: {e}")))?;
        let has_more = rows.len() >= query.clamped_limit() as usize;
        Ok(FacetGroup {
            key: "actor".into(),
            label: "Actor".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(|r| r.into_option()).collect(),
            has_more,
            total: None,
        })
    }

    async fn pg_facet_audit_actions(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT a.action as value, a.action as label, CAST(COUNT(*) AS BIGINT) as count
             FROM audit_logs a WHERE 1=1",
        );
        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder.push(" AND a.action LIKE ");
            builder.push_bind(pattern);
            builder.push(" ESCAPE '\\'");
        }
        self.pg_push_generic_filters(&mut builder, &query.context, "a");
        builder.push(" GROUP BY a.action ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);
        let rows: Vec<crate::punch::FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet audit actions: {e}")))?;
        let has_more = rows.len() >= query.clamped_limit() as usize;
        Ok(FacetGroup {
            key: "action".into(),
            label: "Action".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(|r| r.into_option()).collect(),
            has_more,
            total: None,
        })
    }

    async fn pg_facet_audit_statuses(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::AUDIT_STATUS_VALUES;
        let mut options = Vec::with_capacity(AUDIT_STATUS_VALUES.len());
        for (value, label) in AUDIT_STATUS_VALUES {
            let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM audit_logs a WHERE a.status = ",
            );
            builder.push_bind(value);
            self.pg_push_generic_filters(&mut builder, &query.context, "a");
            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet audit status {value}: {e}")))?;
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));
        Ok(FacetGroup {
            key: "status".into(),
            label: "Status".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }
}
