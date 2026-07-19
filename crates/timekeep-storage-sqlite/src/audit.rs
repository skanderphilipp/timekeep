use super::SqliteStorage;
use crate::punch::FacetRow;
use timekeep_core::{Error, FacetGroup, FacetKind, FacetOption, FacetQuery};

// ─── Row types for sqlx query_as ─────────────────────────────────────

#[derive(sqlx::FromRow)]
pub(super) struct DeviceEventRow {
    id: String,
    device_sn: String,
    timestamp: i64,
    event_type: String,
    metadata_json: String,
}

#[derive(sqlx::FromRow)]
pub(super) struct AuditRow {
    id: String,
    timestamp: i64,
    actor: String,
    action: String,
    resource: String,
    detail_json: Option<String>,
    ip_address: Option<String>,
    status: String,
    error_message: Option<String>,
}

impl AuditRow {
    fn into_audit_event(self) -> Result<timekeep_core::AuditEvent, Error> {
        let detail = self.detail_json.and_then(|s| serde_json::from_str(&s).ok());
        Ok(timekeep_core::AuditEvent {
            id: self.id,
            timestamp: self.timestamp,
            actor: self.actor,
            action: self.action,
            resource: self.resource,
            detail,
            ip_address: self.ip_address,
            status: self.status,
            error_message: self.error_message,
        })
    }
}

impl DeviceEventRow {
    fn into_event(self) -> Result<timekeep_core::DeviceEvent, Error> {
        let ts = jiff::Timestamp::from_second(self.timestamp)
            .map_err(|e| Error::storage(format!("device event timestamp: {e}")))?;
        let metadata: std::collections::HashMap<String, String> =
            serde_json::from_str(&self.metadata_json).unwrap_or_default();
        let event_type = timekeep_core::DeviceEventType::from_key(&self.event_type);
        Ok(timekeep_core::DeviceEvent {
            id: self.id,
            device_sn: self.device_sn,
            timestamp: ts,
            event_type,
            metadata,
        })
    }
}

// ── Audit + Device Event methods ─────────────────────────────────

impl SqliteStorage {
    pub(super) async fn record_audit(
        &self,
        event: &timekeep_core::AuditEvent,
    ) -> Result<(), Error> {
        let detail = event
            .detail
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| Error::storage(format!("serialize audit detail: {e}")))?;

        sqlx::query(
            "INSERT INTO audit_logs (id, timestamp, actor, action, resource, detail_json, ip_address, status, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&event.id)
        .bind(event.timestamp)
        .bind(&event.actor)
        .bind(&event.action)
        .bind(&event.resource)
        .bind(&detail)
        .bind(&event.ip_address)
        .bind(&event.status)
        .bind(&event.error_message)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("record audit: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_audit_event(
        &self,
        id: &str,
    ) -> Result<Option<timekeep_core::AuditEvent>, Error> {
        let row: Option<AuditRow> = sqlx::query_as(
            "SELECT id, timestamp, actor, action, resource, detail_json, ip_address, status, error_message
             FROM audit_logs WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get audit event: {e}")))?;

        row.map(|r| r.into_audit_event()).transpose()
    }

    pub(super) async fn query_audit_logs(
        &self,
        filter: &timekeep_core::AuditFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::AuditEvent>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = "timestamp"; // only supported sort
        let sort_dir = filter.sort_order.as_sql();
        let limit = filter.limit.clamp(1, 200);

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref actor) = filter.actor {
            where_clauses.push("actor = ?".into());
            where_values.push(actor.clone());
        }
        if let Some(ref action) = filter.action {
            where_clauses.push("action LIKE ? ESCAPE '\\'".into());
            where_values.push(sanitize_search(action));
        }
        if let Some(ref resource) = filter.resource {
            where_clauses.push("resource = ?".into());
            where_values.push(resource.clone());
        }
        if let Some(ref search) = filter.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            where_clauses.push(
                "(actor LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR resource LIKE ? ESCAPE '\\')"
                    .into(),
            );
            where_values.push(pattern.clone());
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }
        if let Some(ref since) = filter.since {
            where_clauses.push("timestamp >= ?".into());
            where_values.push(since.as_second().to_string());
        }
        if let Some(ref until) = filter.until {
            where_clauses.push("timestamp <= ?".into());
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
             FROM audit_logs {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );
        let mut query = sqlx::query_as::<_, AuditRow>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }
        let rows = query
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("query audit: {e}")))?;

        let items: Vec<timekeep_core::AuditEvent> =
            rows.into_iter().map(|r| r.into_audit_event()).collect::<Result<Vec<_>, _>>()?;

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    pub(super) async fn record_device_event(
        &self,
        event: &timekeep_core::DeviceEvent,
    ) -> Result<(), Error> {
        let metadata = serde_json::to_string(&event.metadata).unwrap_or_else(|_| "{}".to_string());
        let ts = event.timestamp.as_second();

        sqlx::query(
            "INSERT OR IGNORE INTO device_events (id, device_sn, timestamp, event_type, metadata_json)
             VALUES (?, ?, ?, ?, ?)",
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
            "SELECT e.id, e.device_sn, e.timestamp, e.event_type, e.metadata_json
             FROM device_events e WHERE 1=1",
        );

        if filter.device_sn.is_some() {
            sql.push_str(" AND e.device_sn = ?");
        }
        if let Some(ref types) = filter.event_types {
            let keys: Vec<&str> = types.iter().map(|t| t.key()).collect();
            let placeholders: Vec<String> =
                keys.iter().enumerate().map(|_| "?".to_string()).collect();
            sql.push_str(&format!(" AND e.event_type IN ({})", placeholders.join(",")));
        }
        if filter.since.is_some() {
            sql.push_str(" AND e.timestamp >= ?");
        }
        if filter.until.is_some() {
            sql.push_str(" AND e.timestamp <= ?");
        }

        // Count total
        let _count_sql = sql.replace(
            "SELECT e.id, e.device_sn, e.timestamp, e.event_type, e.metadata_json",
            "SELECT COUNT(*)",
        );

        let sort_col = filter.params.sort_by.as_deref().unwrap_or("timestamp");
        let sort_dir = match filter.params.sort_order {
            timekeep_core::SortOrder::Asc => "ASC",
            timekeep_core::SortOrder::Desc => "DESC",
        };
        let valid_cols = ["timestamp", "event_type"];
        let col = if valid_cols.contains(&sort_col) { sort_col } else { "timestamp" };
        sql.push_str(&format!(" ORDER BY e.{col} {sort_dir} LIMIT ?"));

        // Build query with dynamic binds
        let mut query = sqlx::query_as::<_, DeviceEventRow>(&sql);

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
        query = query.bind(limit);

        let rows: Vec<DeviceEventRow> = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("query device events: {e}")))?;

        let items: Vec<timekeep_core::DeviceEvent> =
            rows.into_iter().map(|r| r.into_event()).collect::<Result<Vec<_>, _>>()?;

        let total = items.len() as u64;
        let has_more = items.len() >= filter.params.limit.min(200) as usize;

        Ok(timekeep_core::ListResult::paginated(items, total, has_more, None))
    }

    pub(super) async fn count_device_events(
        &self,
        filter: &timekeep_core::DeviceEventFilter,
    ) -> Result<u64, Error> {
        let mut sql = String::from("SELECT COUNT(*) FROM device_events WHERE 1=1");

        if filter.device_sn.is_some() {
            sql.push_str(" AND device_sn = ?");
        }
        if filter.since.is_some() {
            sql.push_str(" AND timestamp >= ?");
        }
        if filter.until.is_some() {
            sql.push_str(" AND timestamp <= ?");
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

    /// Return faceted filter metadata for audit logs.
    pub(super) async fn audit_facets(&self, query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        let dimension = query.dimension.as_deref();
        let mut groups = Vec::new();

        if dimension.is_none() || dimension == Some("actor") {
            groups.push(self.facet_audit_actors(query).await?);
        }
        if dimension.is_none() || dimension == Some("action") {
            groups.push(self.facet_audit_actions(query).await?);
        }
        if dimension.is_none() || dimension == Some("status") {
            groups.push(self.facet_audit_statuses(query).await?);
        }

        Ok(groups)
    }

    async fn facet_audit_actors(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT a.actor as value, a.actor as label, CAST(COUNT(*) AS INTEGER) as count
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

        self.push_generic_filters(&mut builder, &query.context, "a");

        builder.push(" GROUP BY a.actor ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);

        let rows: Vec<FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet audit actors: {e}")))?;

        let has_more = rows.len() >= query.clamped_limit() as usize;

        Ok(FacetGroup {
            key: "actor".into(),
            label: "Actor".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(FacetRow::into_option).collect(),
            has_more,
            total: None,
        })
    }

    async fn facet_audit_actions(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        let limit = query.clamped_limit() as i64;
        let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT a.action as value, a.action as label, CAST(COUNT(*) AS INTEGER) as count
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

        self.push_generic_filters(&mut builder, &query.context, "a");

        builder.push(" GROUP BY a.action ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);

        let rows: Vec<FacetRow> = builder
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("facet audit actions: {e}")))?;

        let has_more = rows.len() >= query.clamped_limit() as usize;

        Ok(FacetGroup {
            key: "action".into(),
            label: "Action".into(),
            kind: FacetKind::Reference,
            options: rows.into_iter().map(FacetRow::into_option).collect(),
            has_more,
            total: None,
        })
    }

    async fn facet_audit_statuses(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::AUDIT_STATUS_VALUES;

        let mut options = Vec::with_capacity(AUDIT_STATUS_VALUES.len());
        for (value, label) in AUDIT_STATUS_VALUES {
            let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM audit_logs a WHERE a.status = ",
            );
            builder.push_bind(value);
            self.push_generic_filters(&mut builder, &query.context, "a");

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

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_record_and_query_device_events() {
        let storage = crate::test_storage().await;
        let sn = "SN001";
        let ts = jiff::Timestamp::now();

        // Record a few events
        let event1 =
            timekeep_core::DeviceEvent::new(sn, ts, timekeep_core::DeviceEventType::CameOnline);
        let event2 = timekeep_core::DeviceEvent::new(
            sn,
            ts,
            timekeep_core::DeviceEventType::SyncCompleted { records_synced: 27, duration_ms: 1200 },
        );
        let event3 = timekeep_core::DeviceEvent::new(
            sn,
            ts,
            timekeep_core::DeviceEventType::WentOffline { reason: "timeout".into() },
        );

        storage.record_device_event(&event1).await.expect("record event1");
        storage.record_device_event(&event2).await.expect("record event2");
        storage.record_device_event(&event3).await.expect("record event3");

        // Query all events for this device
        let filter =
            timekeep_core::DeviceEventFilter { device_sn: Some(sn.into()), ..Default::default() };
        let result = storage.query_device_events(&filter).await.expect("query events");
        assert_eq!(result.items.len(), 3, "should have 3 events");
    }

    #[tokio::test]
    async fn test_device_events_filter_by_type() {
        let storage = crate::test_storage().await;
        let sn = "SN002";
        let ts = jiff::Timestamp::now();

        let online =
            timekeep_core::DeviceEvent::new(sn, ts, timekeep_core::DeviceEventType::CameOnline);
        let offline = timekeep_core::DeviceEvent::new(
            sn,
            ts,
            timekeep_core::DeviceEventType::WentOffline { reason: "timeout".into() },
        );

        storage.record_device_event(&online).await.unwrap();
        storage.record_device_event(&offline).await.unwrap();

        // Filter by type
        use timekeep_core::DeviceEventType;
        let filter = timekeep_core::DeviceEventFilter {
            device_sn: Some(sn.into()),
            event_types: Some(vec![DeviceEventType::CameOnline]),
            ..Default::default()
        };
        let result = storage.query_device_events(&filter).await.unwrap();
        assert_eq!(result.items.len(), 1, "only online events");
        assert_eq!(result.items[0].event_type.key(), "came_online");
    }

    #[tokio::test]
    async fn test_device_events_empty_for_unknown_device() {
        let storage = crate::test_storage().await;
        let filter = timekeep_core::DeviceEventFilter {
            device_sn: Some("NONEXISTENT".into()),
            ..Default::default()
        };
        let result = storage.query_device_events(&filter).await.unwrap();
        assert!(result.items.is_empty());
    }
}
