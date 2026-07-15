use super::PostgresStorage;
use timekeep_core::Error;

// ─── Row types for sqlx query_as ────────────────────────────────────

#[derive(sqlx::FromRow)]
pub(super) struct DeviceConfigRow {
    serial_number: String,
    label: String,
    host: String,
    port: i32,
    comm_key: i64,
    push_enabled: i32,
    timezone: Option<String>,
}

#[derive(sqlx::FromRow)]
pub(super) struct DeviceInfoRowPg {
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
    user_capacity: i32,
    record_capacity: i32,
    fingerprint_capacity: i32,
    face_capacity: i32,
    palm_capacity: i32,
    user_count: i32,
    record_count: i32,
    fingerprint_count: i32,
    face_count: i32,
    palm_count: i32,
    last_sync_at: Option<i64>,
    last_sync_cursor: Option<i64>,
    label: Option<String>,
    location: Option<String>,
    branch: Option<String>,
    installed_at: Option<i64>,
    notes: Option<String>,
}

impl DeviceInfoRowPg {
    fn into_device(self) -> timekeep_core::Device {
        let vendor = match self.vendor.as_str() {
            "zkteco" => timekeep_core::DeviceVendor::ZkTeco,
            _ => timekeep_core::DeviceVendor::Other(self.vendor),
        };
        let status = match self.status.as_str() {
            "online" => timekeep_core::DeviceStatus::Online,
            "offline" => timekeep_core::DeviceStatus::Offline,
            "syncing" => timekeep_core::DeviceStatus::Syncing,
            "error" => timekeep_core::DeviceStatus::Error,
            _ => timekeep_core::DeviceStatus::Offline,
        };
        timekeep_core::Device {
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

impl PostgresStorage {
    pub(super) async fn upsert_device(&self, device: &timekeep_core::Device) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO devices
             (serial_number, model, firmware_version, platform, mac_address, ip_address, last_seen,
              user_capacity, record_capacity, user_count, record_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (serial_number) DO UPDATE SET
                last_seen = EXCLUDED.last_seen,
                model = EXCLUDED.model,
                firmware_version = EXCLUDED.firmware_version,
                platform = EXCLUDED.platform,
                mac_address = EXCLUDED.mac_address,
                ip_address = EXCLUDED.ip_address,
                user_capacity = EXCLUDED.user_capacity,
                record_capacity = EXCLUDED.record_capacity,
                user_count = EXCLUDED.user_count,
                record_count = EXCLUDED.record_count",
        )
        .bind(&device.serial_number)
        .bind(&device.model)
        .bind(&device.firmware_version)
        .bind(&device.platform)
        .bind(&device.mac_address)
        .bind(&device.ip_address)
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

    pub(super) async fn upsert_device_config(
        &self,
        config: &timekeep_core::DeviceConfig,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO devices
             (serial_number, label, host, port, comm_key, push_enabled, timezone)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (serial_number) DO UPDATE SET
                label = EXCLUDED.label,
                host = EXCLUDED.host,
                port = EXCLUDED.port,
                comm_key = EXCLUDED.comm_key,
                push_enabled = EXCLUDED.push_enabled,
                timezone = EXCLUDED.timezone",
        )
        .bind(&config.serial_number)
        .bind(&config.label)
        .bind(&config.host)
        .bind(config.port as i32)
        .bind(config.comm_key as i64)
        .bind(config.push_enabled as i32)
        .bind(&config.timezone)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert device config: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_device_configs(
        &self,
    ) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
        let rows = sqlx::query_as::<_, DeviceConfigRow>(
            "SELECT serial_number, label, host, port, comm_key, push_enabled, timezone
             FROM devices ORDER BY label",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list device configs: {e}")))?;

        Ok(rows
            .into_iter()
            .map(|r| timekeep_core::DeviceConfig {
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

    pub(super) async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM devices WHERE serial_number = $1")
            .bind(serial_number)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete device config: {e}")))?;

        Ok(())
    }

    pub(super) async fn upsert_device_info(
        &self,
        device: &timekeep_core::Device,
    ) -> Result<(), Error> {
        let status = format!("{:?}", device.status).to_lowercase();
        let vendor = device.vendor.key();
        let now = jiff::Timestamp::now().as_second();

        sqlx::query(
            "INSERT INTO device_info (
                serial_number, vendor, model, firmware_version, platform,
                mac_address, ip_address, status, last_seen, first_seen,
                uptime_seconds, user_capacity, record_capacity, fingerprint_capacity,
                face_capacity, palm_capacity, user_count, record_count,
                fingerprint_count, face_count, palm_count,
                last_sync_at, last_sync_cursor, label, location, branch,
                installed_at, notes, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
                $22,$23,$24,$25,$26,$27,$28,$29
            )
            ON CONFLICT(serial_number) DO UPDATE SET
                vendor=EXCLUDED.vendor, model=EXCLUDED.model,
                firmware_version=EXCLUDED.firmware_version, platform=EXCLUDED.platform,
                mac_address=EXCLUDED.mac_address, ip_address=EXCLUDED.ip_address,
                status=EXCLUDED.status, last_seen=EXCLUDED.last_seen,
                first_seen=COALESCE(device_info.first_seen, EXCLUDED.first_seen),
                uptime_seconds=EXCLUDED.uptime_seconds,
                user_capacity=EXCLUDED.user_capacity, record_capacity=EXCLUDED.record_capacity,
                fingerprint_capacity=EXCLUDED.fingerprint_capacity,
                face_capacity=EXCLUDED.face_capacity, palm_capacity=EXCLUDED.palm_capacity,
                user_count=EXCLUDED.user_count, record_count=EXCLUDED.record_count,
                fingerprint_count=EXCLUDED.fingerprint_count,
                face_count=EXCLUDED.face_count, palm_count=EXCLUDED.palm_count,
                last_sync_at=EXCLUDED.last_sync_at, last_sync_cursor=EXCLUDED.last_sync_cursor,
                label=EXCLUDED.label, location=EXCLUDED.location,
                branch=EXCLUDED.branch, installed_at=EXCLUDED.installed_at,
                notes=EXCLUDED.notes, updated_at=EXCLUDED.updated_at",
        )
        .bind(&device.serial_number)
        .bind(&vendor)
        .bind(&device.model)
        .bind(&device.firmware_version)
        .bind(&device.platform)
        .bind(&device.mac_address)
        .bind(&device.ip_address)
        .bind(&status)
        .bind(device.last_seen.map(|t| t.as_second()))
        .bind(device.first_seen.map(|t| t.as_second()))
        .bind(device.uptime_seconds.map(|v| v as i64))
        .bind(device.user_capacity as i32)
        .bind(device.record_capacity as i32)
        .bind(device.fingerprint_capacity as i32)
        .bind(device.face_capacity as i32)
        .bind(device.palm_capacity as i32)
        .bind(device.user_count as i32)
        .bind(device.record_count as i32)
        .bind(device.fingerprint_count as i32)
        .bind(device.face_count as i32)
        .bind(device.palm_count as i32)
        .bind(device.last_sync_at.map(|t| t.as_second()))
        .bind(device.last_sync_cursor.map(|t| t.as_second()))
        .bind(&device.label)
        .bind(&device.location)
        .bind(&device.branch)
        .bind(device.installed_at.map(|t| t.as_second()))
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
    ) -> Result<Option<timekeep_core::Device>, Error> {
        let row = sqlx::query_as::<_, DeviceInfoRowPg>(
            "SELECT serial_number, vendor, model, firmware_version, platform,
             mac_address, ip_address, status, last_seen, first_seen,
             uptime_seconds, user_capacity, record_capacity, fingerprint_capacity,
             face_capacity, palm_capacity, user_count, record_count,
             fingerprint_count, face_count, palm_count,
             last_sync_at, last_sync_cursor, label, location, branch,
             installed_at, notes
             FROM device_info WHERE serial_number = $1",
        )
        .bind(serial_number)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get device info: {e}")))?;

        Ok(row.map(|r| r.into_device()))
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    async fn get_storage() -> Option<PostgresStorage> {
        crate::test_storage().await
    }

    // ─── Device CRUD ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_device() {
        let Some(storage) = get_storage().await else {
            return;
        };
        let mut device = timekeep_core::model::Device::new("DEV001");
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
        storage.upsert_device(&device).await.expect("should replace");
    }

    #[tokio::test]
    async fn test_device_config_crud() {
        let Some(storage) = get_storage().await else {
            return;
        };

        let config = timekeep_core::DeviceConfig {
            label: "Office Scanner".into(),
            serial_number: "DEV001".into(),
            host: "192.168.1.100".into(),
            port: 4370,
            comm_key: 0,
            timezone: Some("Asia/Riyadh".into()),
            push_enabled: true,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
        };

        storage.upsert_device_config(&config).await.expect("should insert");

        let configs = storage.list_device_configs().await.expect("should list");
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].serial_number, "DEV001");
        assert_eq!(configs[0].label, "Office Scanner");
        assert_eq!(configs[0].host, "192.168.1.100");
        assert_eq!(configs[0].port, 4370);
        assert!(configs[0].push_enabled);
        assert_eq!(configs[0].timezone.as_deref(), Some("Asia/Riyadh"));

        let updated = timekeep_core::DeviceConfig {
            label: "Warehouse Scanner".into(),
            push_enabled: false,
            ..config.clone()
        };
        storage.upsert_device_config(&updated).await.expect("should update");
        let configs = storage.list_device_configs().await.unwrap();
        assert_eq!(configs.len(), 1, "should still be one config");
        assert_eq!(configs[0].label, "Warehouse Scanner");
        assert!(!configs[0].push_enabled);

        storage.delete_device_config("DEV001").await.expect("should delete");
        assert!(storage.list_device_configs().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_delete_device_config_nonexistent_is_noop() {
        let Some(storage) = get_storage().await else {
            return;
        };
        storage.delete_device_config("NONEXISTENT").await.expect("should not error");
    }

    #[tokio::test]
    async fn test_multiple_device_configs() {
        let Some(storage) = get_storage().await else {
            return;
        };

        for i in 1..=3 {
            storage
                .upsert_device_config(&timekeep_core::DeviceConfig {
                    label: format!("Scanner {i}"),
                    serial_number: format!("DEV00{i}"),
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
}
