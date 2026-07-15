use super::SqliteStorage;
use timekeep_core::{
    Error, FacetGroup, FacetKind, FacetOption, FacetQuery,
    model::{Device, DeviceConfig},
};

// ─── Row types for sqlx query_as ────────────────────────────────────

#[derive(sqlx::FromRow)]
pub(super) struct DeviceConfigRow {
    serial_number: String,
    label: String,
    host: String,
    port: i64,
    comm_key: i64,
    push_enabled: i64,
    timezone: Option<String>,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub(super) struct DeviceRow {
    serial_number: String,
    label: String,
    model: String,
    firmware_version: String,
    platform: String,
    mac_address: String,
    host: String,
    port: i64,
    comm_key: i64,
    push_enabled: i64,
    timezone: Option<String>,
    last_seen: Option<String>,
    user_capacity: i64,
    record_capacity: i64,
    user_count: i64,
    record_count: i64,
}

impl DeviceRow {
    #[allow(dead_code)]
    fn into_device(self) -> Device {
        Device {
            serial_number: self.serial_number,
            model: self.model,
            firmware_version: self.firmware_version,
            platform: self.platform,
            vendor: timekeep_core::DeviceVendor::ZkTeco,
            mac_address: self.mac_address,
            ip_address: self.host,
            status: timekeep_core::DeviceStatus::Online,
            last_seen: self
                .last_seen
                .and_then(|s| jiff::Timestamp::from_second(s.parse::<i64>().unwrap_or(0)).ok()),
            first_seen: None,
            uptime_seconds: None,
            user_capacity: self.user_capacity as u32,
            record_capacity: self.record_capacity as u32,
            fingerprint_capacity: 0,
            face_capacity: 0,
            palm_capacity: 0,
            user_count: self.user_count as u32,
            record_count: self.record_count as u32,
            fingerprint_count: 0,
            face_count: 0,
            palm_count: 0,
            last_sync_at: None,
            last_sync_cursor: None,
            label: if self.label.is_empty() { None } else { Some(self.label) },
            location: None,
            branch: None,
            installed_at: None,
            notes: None,
        }
    }
}

#[derive(sqlx::FromRow)]
pub(super) struct DeviceInfoRow {
    serial_number: String,
    vendor: String,
    model: String,
    firmware_version: String,
    platform: String,
    mac_address: String,
    ip_address: String,
    status: String,
    last_seen: Option<i64>,
    first_seen: Option<i64>,
    uptime_seconds: Option<i64>,
    user_capacity: i64,
    record_capacity: i64,
    fingerprint_capacity: i64,
    face_capacity: i64,
    palm_capacity: i64,
    user_count: i64,
    record_count: i64,
    fingerprint_count: i64,
    face_count: i64,
    palm_count: i64,
    last_sync_at: Option<i64>,
    last_sync_cursor: Option<i64>,
    label: Option<String>,
    location: Option<String>,
    branch: Option<String>,
    installed_at: Option<i64>,
    notes: Option<String>,
}

impl DeviceInfoRow {
    fn into_device(self) -> Device {
        let vendor = match self.vendor.as_str() {
            "zkteco" => timekeep_core::DeviceVendor::ZkTeco,
            "suprema" => timekeep_core::DeviceVendor::Suprema,
            "anviz" => timekeep_core::DeviceVendor::Anviz,
            "hikvision" => timekeep_core::DeviceVendor::Hikvision,
            other => timekeep_core::DeviceVendor::Other(other.to_string()),
        };
        let status = match self.status.as_str() {
            "online" => timekeep_core::DeviceStatus::Online,
            "offline" => timekeep_core::DeviceStatus::Offline,
            "syncing" => timekeep_core::DeviceStatus::Syncing,
            "error" => timekeep_core::DeviceStatus::Error,
            "provisioning" => timekeep_core::DeviceStatus::Provisioning,
            "decommissioned" => timekeep_core::DeviceStatus::Decommissioned,
            _ => timekeep_core::DeviceStatus::Offline,
        };
        Device {
            serial_number: self.serial_number,
            model: self.model,
            firmware_version: self.firmware_version,
            platform: self.platform,
            vendor,
            mac_address: self.mac_address,
            ip_address: self.ip_address,
            status,
            last_seen: self.last_seen.and_then(|t| jiff::Timestamp::from_second(t).ok()),
            first_seen: self.first_seen.and_then(|t| jiff::Timestamp::from_second(t).ok()),
            uptime_seconds: self.uptime_seconds.map(|v| v as u64),
            user_capacity: self.user_capacity as u32,
            record_capacity: self.record_capacity as u32,
            fingerprint_capacity: self.fingerprint_capacity as u32,
            face_capacity: self.face_capacity as u32,
            palm_capacity: self.palm_capacity as u32,
            user_count: self.user_count as u32,
            record_count: self.record_count as u32,
            fingerprint_count: self.fingerprint_count as u32,
            face_count: self.face_count as u32,
            palm_count: self.palm_count as u32,
            last_sync_at: self.last_sync_at.and_then(|t| jiff::Timestamp::from_second(t).ok()),
            last_sync_cursor: self
                .last_sync_cursor
                .and_then(|t| jiff::Timestamp::from_second(t).ok()),
            label: self.label,
            location: self.location,
            branch: self.branch,
            installed_at: self.installed_at.and_then(|t| jiff::Timestamp::from_second(t).ok()),
            notes: self.notes,
        }
    }
}

// ── Device methods ──────────────────────────────────────────────

impl SqliteStorage {
    pub(super) async fn upsert_device(&self, device: &Device) -> Result<(), Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO devices
             (serial_number, model, firmware_version, platform, mac_address, last_seen,
              user_capacity, record_capacity, user_count, record_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&device.serial_number)
        .bind(&device.model)
        .bind(&device.firmware_version)
        .bind(&device.platform)
        .bind(&device.mac_address)
        .bind(device.last_seen.map(|t| t.as_second().to_string()))
        .bind(device.user_capacity as i64)
        .bind(device.record_capacity as i64)
        .bind(device.user_count as i64)
        .bind(device.record_count as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert device: {e}")))?;

        Ok(())
    }

    pub(super) async fn upsert_device_config(&self, config: &DeviceConfig) -> Result<(), Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO devices
             (serial_number, label, host, port, comm_key, push_enabled, timezone)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&config.serial_number)
        .bind(&config.label)
        .bind(&config.host)
        .bind(config.port as i64)
        .bind(config.comm_key as i64)
        .bind(config.push_enabled as i64)
        .bind(&config.timezone)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert device config: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, Error> {
        let rows = sqlx::query_as::<_, DeviceConfigRow>(
            "SELECT serial_number, label, host, port, comm_key, push_enabled, timezone
             FROM devices ORDER BY label",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list device configs: {e}")))?;

        Ok(rows
            .into_iter()
            .map(|r| DeviceConfig {
                serial_number: r.serial_number,
                label: r.label,
                host: r.host,
                port: r.port as u16,
                comm_key: r.comm_key as u32,
                push_enabled: r.push_enabled != 0,
                timezone: r.timezone,
                vendor: "zkteco".into(),
                location: None,
                poll_interval_secs: None,
            })
            .collect())
    }

    pub(super) async fn list_device_configs_filtered(
        &self,
        filter: &timekeep_core::DeviceFilter,
    ) -> Result<timekeep_core::ListResult<DeviceConfig>, Error> {
        use timekeep_core::sanitize_search;

        // Validate sort column against whitelist
        let sort_col = match filter.params.sort_by.as_deref().unwrap_or("label") {
            "label" => "label",
            "serial_number" => "serial_number",
            "host" => "host",
            "last_seen" => "last_seen",
            _ => "label",
        };
        let sort_dir = filter.params.sort_order.as_sql();
        let limit = filter.params.clamped_limit();

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref search) = filter.params.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            where_clauses
                .push("(label LIKE ? ESCAPE '\\' OR serial_number LIKE ? ESCAPE '\\')".into());
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // Count total
        let count_sql = format!("SELECT COUNT(*) FROM devices {where_sql}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        for val in &where_values {
            count_query = count_query.bind(val);
        }
        let total: i64 = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count devices: {e}")))?;

        // Fetch page
        let query_sql = format!(
            "SELECT serial_number, label, host, port, comm_key, push_enabled, timezone
             FROM devices {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );
        let mut query = sqlx::query_as::<_, DeviceConfigRow>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }
        let rows = query
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("list devices filtered: {e}")))?;

        let items: Vec<DeviceConfig> = rows
            .into_iter()
            .map(|r| DeviceConfig {
                serial_number: r.serial_number,
                label: r.label,
                host: r.host,
                port: r.port as u16,
                comm_key: r.comm_key as u32,
                push_enabled: r.push_enabled != 0,
                timezone: r.timezone,
                vendor: "zkteco".into(),
                location: None,
                poll_interval_secs: None,
            })
            .collect();

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    pub(super) async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM devices WHERE serial_number = ?")
            .bind(serial_number)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete device config: {e}")))?;

        Ok(())
    }

    pub(super) async fn upsert_device_info(&self, device: &Device) -> Result<(), Error> {
        let last_seen = device.last_seen.map(|t| t.as_second());
        let first_seen = device.first_seen.map(|t| t.as_second());
        let last_sync = device.last_sync_at.map(|t| t.as_second());
        let last_sync_cursor = device.last_sync_cursor.map(|t| t.as_second());
        let installed = device.installed_at.map(|t| t.as_second());
        let now = jiff::Timestamp::now().as_second();
        let status = format!("{:?}", device.status).to_lowercase();
        let vendor = device.vendor.key();

        sqlx::query(
            "INSERT INTO device_info (
                serial_number, vendor, model, firmware_version, platform,
                mac_address, ip_address, status, last_seen, first_seen,
                uptime_seconds, user_capacity, record_capacity, fingerprint_capacity,
                face_capacity, palm_capacity, user_count, record_count,
                fingerprint_count, face_count, palm_count,
                last_sync_at, last_sync_cursor, label, location, branch,
                installed_at, notes, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(serial_number) DO UPDATE SET
                vendor=excluded.vendor, model=excluded.model,
                firmware_version=excluded.firmware_version, platform=excluded.platform,
                mac_address=excluded.mac_address, ip_address=excluded.ip_address,
                status=excluded.status, last_seen=excluded.last_seen,
                first_seen=COALESCE(device_info.first_seen, excluded.first_seen),
                uptime_seconds=excluded.uptime_seconds,
                user_capacity=excluded.user_capacity,
                record_capacity=excluded.record_capacity,
                fingerprint_capacity=excluded.fingerprint_capacity,
                face_capacity=excluded.face_capacity,
                palm_capacity=excluded.palm_capacity,
                user_count=excluded.user_count, record_count=excluded.record_count,
                fingerprint_count=excluded.fingerprint_count,
                face_count=excluded.face_count, palm_count=excluded.palm_count,
                last_sync_at=excluded.last_sync_at,
                last_sync_cursor=excluded.last_sync_cursor,
                label=excluded.label, location=excluded.location,
                branch=excluded.branch, installed_at=excluded.installed_at,
                notes=excluded.notes, updated_at=excluded.updated_at",
        )
        .bind(&device.serial_number)
        .bind(&vendor)
        .bind(&device.model)
        .bind(&device.firmware_version)
        .bind(&device.platform)
        .bind(&device.mac_address)
        .bind(&device.ip_address)
        .bind(&status)
        .bind(last_seen)
        .bind(first_seen)
        .bind(device.uptime_seconds.map(|v| v as i64))
        .bind(device.user_capacity as i64)
        .bind(device.record_capacity as i64)
        .bind(device.fingerprint_capacity as i64)
        .bind(device.face_capacity as i64)
        .bind(device.palm_capacity as i64)
        .bind(device.user_count as i64)
        .bind(device.record_count as i64)
        .bind(device.fingerprint_count as i64)
        .bind(device.face_count as i64)
        .bind(device.palm_count as i64)
        .bind(last_sync)
        .bind(last_sync_cursor)
        .bind(&device.label)
        .bind(&device.location)
        .bind(&device.branch)
        .bind(installed)
        .bind(&device.notes)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert device info: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_device_info(
        &self,
        serial_number: &str,
    ) -> Result<Option<Device>, Error> {
        let row = sqlx::query_as::<_, DeviceInfoRow>(
            "SELECT serial_number, vendor, model, firmware_version, platform,
             mac_address, ip_address, status, last_seen, first_seen,
             uptime_seconds, user_capacity, record_capacity, fingerprint_capacity,
             face_capacity, palm_capacity, user_count, record_count,
             fingerprint_count, face_count, palm_count,
             last_sync_at, last_sync_cursor, label, location, branch,
             installed_at, notes
             FROM device_info WHERE serial_number = ?",
        )
        .bind(serial_number)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get device info: {e}")))?;

        Ok(row.map(|r| r.into_device()))
    }

    /// Return faceted filter metadata for devices.
    pub(super) async fn device_facets(&self, query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        let dimension = query.dimension.as_deref();
        let mut groups = Vec::new();

        if dimension.is_none() || dimension == Some("vendor") {
            groups.push(self.facet_device_vendors(query).await?);
        }
        if dimension.is_none() || dimension == Some("status") {
            groups.push(self.facet_device_statuses(query).await?);
        }
        if dimension.is_none() || dimension == Some("push_enabled") {
            groups.push(self.facet_device_push_enabled(query).await?);
        }

        Ok(groups)
    }

    async fn facet_device_vendors(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::DEVICE_VENDOR_VALUES;

        let mut options = Vec::with_capacity(DEVICE_VENDOR_VALUES.len());
        for (value, label) in DEVICE_VENDOR_VALUES {
            let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM device_configs d WHERE d.vendor = ",
            );
            builder.push_bind(value);
            self.push_generic_filters(&mut builder, &query.context, "d");

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet device vendor {value}: {e}")))?;

            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));

        Ok(FacetGroup {
            key: "vendor".into(),
            label: "Vendor".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    async fn facet_device_statuses(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::DEVICE_STATUS_VALUES;

        let mut options = Vec::with_capacity(DEVICE_STATUS_VALUES.len());
        for (value, label) in DEVICE_STATUS_VALUES {
            let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM device_info di WHERE di.status = ",
            );
            builder.push_bind(value);
            self.push_generic_filters(&mut builder, &query.context, "di");

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet device status {value}: {e}")))?;

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

    async fn facet_device_push_enabled(&self, query: &FacetQuery) -> Result<FacetGroup, Error> {
        use timekeep_core::facet::PUSH_ENABLED_VALUES;

        let mut options = Vec::with_capacity(PUSH_ENABLED_VALUES.len());
        for (value, label) in PUSH_ENABLED_VALUES {
            let bool_val: i32 = if *value == "true" { 1 } else { 0 };
            let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM device_configs d WHERE d.push_enabled = ",
            );
            builder.push_bind(bool_val);
            self.push_generic_filters(&mut builder, &query.context, "d");

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet push_enabled {value}: {e}")))?;

            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));

        Ok(FacetGroup {
            key: "push_enabled".into(),
            label: "Push Enabled".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_upsert_device() {
        let storage = crate::test_storage().await;
        let mut device = Device::new("SN001");
        device.model = "Biopro SA40".into();
        device.firmware_version = "Ver 6.60".into();
        device.platform = "ZLM60".into();
        device.mac_address = "00:11:22:33:44:55".into();
        device.ip_address = "192.168.1.100".into();
        device.status = timekeep_core::DeviceStatus::Online;
        device.last_seen = Some(jiff::Timestamp::from_second(1752129600).unwrap());
        device.user_capacity = 5000;
        device.record_capacity = 100000;
        device.fingerprint_capacity = 3000;
        device.user_count = 116;
        device.record_count = 11489;
        device.fingerprint_count = 402;

        storage.upsert_device(&device).await.expect("should upsert");
        // Second upsert should succeed (INSERT OR REPLACE)
        storage.upsert_device(&device).await.expect("should replace");
    }

    #[tokio::test]
    async fn test_device_config_crud() {
        let storage = crate::test_storage().await;

        let config = DeviceConfig {
            label: "Office Scanner".into(),
            serial_number: "SN001".into(),
            host: "192.168.1.100".into(),
            port: 4370,
            comm_key: 0,
            timezone: Some("Asia/Riyadh".into()),
            push_enabled: true,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
        };

        // Create
        storage.upsert_device_config(&config).await.expect("should insert");

        // Read
        let configs = storage.list_device_configs().await.expect("should list");
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].serial_number, "SN001");
        assert_eq!(configs[0].label, "Office Scanner");
        assert_eq!(configs[0].host, "192.168.1.100");
        assert_eq!(configs[0].port, 4370);
        assert!(configs[0].push_enabled);
        assert_eq!(configs[0].timezone.as_deref(), Some("Asia/Riyadh"));

        // Update
        let updated = DeviceConfig {
            label: "Warehouse Scanner".into(),
            push_enabled: false,
            ..config.clone()
        };
        storage.upsert_device_config(&updated).await.expect("should update");
        let configs = storage.list_device_configs().await.unwrap();
        assert_eq!(configs.len(), 1, "should still be one config");
        assert_eq!(configs[0].label, "Warehouse Scanner");
        assert!(!configs[0].push_enabled);

        // Delete
        storage.delete_device_config("SN001").await.expect("should delete");
        assert!(storage.list_device_configs().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_delete_device_config_nonexistent_is_noop() {
        let storage = crate::test_storage().await;
        storage.delete_device_config("NONEXISTENT").await.expect("should not error");
    }

    #[tokio::test]
    async fn test_multiple_device_configs() {
        let storage = crate::test_storage().await;

        for i in 1..=3 {
            storage
                .upsert_device_config(&DeviceConfig {
                    label: format!("Scanner {i}"),
                    serial_number: format!("SN00{i}"),
                    host: format!("192.168.1.10{i}"),
                    port: 4370,
                    comm_key: 0,
                    timezone: None,
                    push_enabled: true,
                    vendor: "zkteco".into(),
                    location: None,
                    poll_interval_secs: None,
                })
                .await
                .unwrap();
        }

        let configs = storage.list_device_configs().await.unwrap();
        assert_eq!(configs.len(), 3);
    }

    // ─── Device Info (enriched metadata) ──────────────────────────────

    #[tokio::test]
    async fn test_upsert_and_get_device_info() {
        let storage = crate::test_storage().await;
        let mut device = Device::new("SN001");
        device.model = "Biopro SA40".into();
        device.firmware_version = "Ver 6.60".into();
        device.mac_address = "00:17:61:10:41:52".into();
        device.ip_address = "192.168.100.83".into();
        device.status = timekeep_core::DeviceStatus::Online;
        device.user_count = 116;
        device.record_count = 11489;
        device.record_capacity = 100000;
        device.user_capacity = 3000;
        device.location = Some("HQ Floor 1".into());

        storage.upsert_device_info(&device).await.expect("upsert device info");

        let retrieved = storage
            .get_device_info("SN001")
            .await
            .expect("get device info")
            .expect("device should exist");

        assert_eq!(retrieved.serial_number, "SN001");
        assert_eq!(retrieved.model, "Biopro SA40");
        assert_eq!(retrieved.firmware_version, "Ver 6.60");
        assert_eq!(retrieved.mac_address, "00:17:61:10:41:52");
        assert_eq!(retrieved.user_count, 116);
        assert_eq!(retrieved.record_count, 11489);
        assert_eq!(retrieved.record_capacity, 100000);
        assert_eq!(retrieved.location.as_deref(), Some("HQ Floor 1"));
    }

    #[tokio::test]
    async fn test_get_device_info_nonexistent() {
        let storage = crate::test_storage().await;
        let result = storage.get_device_info("NONEXISTENT").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_upsert_device_info_updates_existing() {
        let storage = crate::test_storage().await;

        let mut device = Device::new("SN003");
        device.user_count = 100;
        storage.upsert_device_info(&device).await.unwrap();

        // Update with different count
        let mut device2 = Device::new("SN003");
        device2.user_count = 200;
        storage.upsert_device_info(&device2).await.unwrap();

        let retrieved = storage.get_device_info("SN003").await.unwrap().unwrap();
        assert_eq!(retrieved.user_count, 200, "should be updated");
    }
}
