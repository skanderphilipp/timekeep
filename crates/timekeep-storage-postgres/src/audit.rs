use super::PostgresStorage;
use timekeep_core::Error;

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
}
