use super::SqliteStorage;
use timekeep_core::Error;
use timekeep_core::model::DeviceConfig;
use timekeep_core::model::device_group::DeviceGroup;

/// Row for deserialising a device group from SQLite.
#[derive(sqlx::FromRow)]
struct DeviceGroupRow {
    id: String,
    name: String,
    description: Option<String>,
    department_ids: String,
    created_at: String,
    updated_at: String,
}

/// Row for deserialising a device config with group membership.
#[derive(sqlx::FromRow)]
struct DeviceWithGroupRow {
    serial_number: String,
    label: String,
    host: String,
    port: i32,
    comm_key: i32,
    push_enabled: i32,
    timezone: Option<String>,
    group_id: Option<String>,
}

impl SqliteStorage {
    // ── Group CRUD ───────────────────────────────────────────────

    pub(super) async fn list_groups(&self) -> Result<Vec<DeviceGroup>, Error> {
        let rows = sqlx::query_as::<_, DeviceGroupRow>(
            "SELECT id, name, description, department_ids, created_at, updated_at FROM device_groups ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list device groups: {e}")))?;

        rows.into_iter().map(|r| row_to_group(&r)).collect()
    }

    pub(super) async fn get_group(&self, id: &str) -> Result<Option<DeviceGroup>, Error> {
        let row = sqlx::query_as::<_, DeviceGroupRow>(
            "SELECT id, name, description, department_ids, created_at, updated_at FROM device_groups WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get device group: {e}")))?;

        row.map(|r| row_to_group(&r)).transpose()
    }

    pub(super) async fn get_group_by_name(&self, name: &str) -> Result<Option<DeviceGroup>, Error> {
        let row = sqlx::query_as::<_, DeviceGroupRow>(
            "SELECT id, name, description, department_ids, created_at, updated_at FROM device_groups WHERE name = ?",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get device group by name: {e}")))?;

        row.map(|r| row_to_group(&r)).transpose()
    }

    pub(super) async fn create_group(&self, group: &DeviceGroup) -> Result<(), Error> {
        let dept_ids = group.department_ids.join(",");
        sqlx::query(
            "INSERT INTO device_groups (id, name, description, department_ids, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&group.id.0)
        .bind(&group.name)
        .bind(&group.description)
        .bind(&dept_ids)
        .bind(group.created_at.as_second())
        .bind(group.updated_at.as_second())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create device group: {e}")))?;

        Ok(())
    }

    pub(super) async fn update_group(&self, group: &DeviceGroup) -> Result<(), Error> {
        let dept_ids = group.department_ids.join(",");
        sqlx::query(
            "UPDATE device_groups SET name = ?, description = ?, department_ids = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&group.name)
        .bind(&group.description)
        .bind(&dept_ids)
        .bind(group.updated_at.as_second())
        .bind(&group.id.0)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update device group: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_group(&self, id: &str) -> Result<(), Error> {
        // The FK ON DELETE SET NULL will automatically clear group_id on devices
        sqlx::query("DELETE FROM device_groups WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete device group: {e}")))?;

        Ok(())
    }

    // ── Device membership ────────────────────────────────────────

    pub(super) async fn list_devices_in_group(
        &self,
        group_id: &str,
    ) -> Result<Vec<DeviceConfig>, Error> {
        let rows = sqlx::query_as::<_, DeviceWithGroupRow>(
            "SELECT serial_number, label, host, port, comm_key, push_enabled, timezone, group_id
             FROM devices WHERE group_id = ?
             ORDER BY label",
        )
        .bind(group_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list devices in group: {e}")))?;

        Ok(rows.into_iter().map(|r| row_to_device_config(&r)).collect())
    }

    pub(super) async fn set_device_group(
        &self,
        device_sn: &str,
        group_id: Option<&str>,
    ) -> Result<(), Error> {
        sqlx::query("UPDATE devices SET group_id = ? WHERE serial_number = ?")
            .bind(group_id)
            .bind(device_sn)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("set device group: {e}")))?;

        Ok(())
    }

    pub(super) async fn get_device_group(
        &self,
        device_sn: &str,
    ) -> Result<Option<DeviceGroup>, Error> {
        let row = sqlx::query_as::<_, DeviceGroupRow>(
            "SELECT g.id, g.name, g.description, g.created_at, g.updated_at
             FROM device_groups g
             INNER JOIN devices d ON d.group_id = g.id
             WHERE d.serial_number = ?",
        )
        .bind(device_sn)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("get device group: {e}")))?;

        row.map(|r| row_to_group(&r)).transpose()
    }
}

// ── Row mapping helpers ────────────────────────────────────────────

fn row_to_group(row: &DeviceGroupRow) -> Result<DeviceGroup, Error> {
    let created_at = parse_timestamp_field(&row.created_at, "created_at")?;
    let updated_at = parse_timestamp_field(&row.updated_at, "updated_at")?;

    let department_ids: Vec<String> = if row.department_ids.is_empty() {
        Vec::new()
    } else {
        row.department_ids
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    };

    Ok(DeviceGroup {
        id: timekeep_core::model::device_group::DeviceGroupId(row.id.clone()),
        name: row.name.clone(),
        description: row.description.clone(),
        department_ids,
        created_at,
        updated_at,
    })
}

fn row_to_device_config(row: &DeviceWithGroupRow) -> DeviceConfig {
    DeviceConfig {
        serial_number: row.serial_number.clone(),
        label: row.label.clone(),
        host: row.host.clone(),
        port: row.port as u16,
        comm_key: row.comm_key as u32,
        timezone: row.timezone.clone(),
        push_enabled: row.push_enabled != 0,
        vendor: "zkteco".into(),
        location: None,
        poll_interval_secs: None,
        group_id: row.group_id.clone(),
    }
}

fn parse_timestamp_field(s: &str, field: &str) -> Result<jiff::Timestamp, Error> {
    s.parse::<i64>().map_err(|e| Error::storage(format!("parse {field}: {e}"))).and_then(|secs| {
        jiff::Timestamp::from_second(secs)
            .map_err(|e| Error::storage(format!("timestamp {field}: {e}")))
    })
}

#[cfg(test)]
mod tests {
    use timekeep_core::model::DeviceConfig;
    use timekeep_core::model::device_group::DeviceGroup;

    #[tokio::test]
    async fn test_create_and_list_groups() {
        let storage = crate::test_storage().await;

        let group = DeviceGroup::new("onboarding", None);
        storage.create_group(&group).await.expect("should create");

        let list = storage.list_groups().await.expect("should list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "onboarding");
    }

    #[tokio::test]
    async fn test_group_with_description() {
        let storage = crate::test_storage().await;

        let group = DeviceGroup::new("staff", Some("Staff punching terminals".into()));
        storage.create_group(&group).await.expect("should create");

        let fetched =
            storage.get_group(&group.id.0).await.expect("should get").expect("should exist");
        assert_eq!(fetched.name, "staff");
        assert_eq!(fetched.description.as_deref(), Some("Staff punching terminals"));
    }

    #[tokio::test]
    async fn test_get_group_by_name() {
        let storage = crate::test_storage().await;

        let group = DeviceGroup::new("office", None);
        storage.create_group(&group).await.expect("should create");

        let fetched =
            storage.get_group_by_name("office").await.expect("should get").expect("should exist");
        assert_eq!(fetched.id.0, group.id.0);
    }

    #[tokio::test]
    async fn test_update_group() {
        let storage = crate::test_storage().await;

        let mut group = DeviceGroup::new("old-name", None);
        storage.create_group(&group).await.expect("should create");

        group.rename("new-name");
        group.set_description(Some("Updated description".into()));
        storage.update_group(&group).await.expect("should update");

        let fetched =
            storage.get_group(&group.id.0).await.expect("should get").expect("should exist");
        assert_eq!(fetched.name, "new-name");
        assert_eq!(fetched.description.as_deref(), Some("Updated description"));
    }

    #[tokio::test]
    async fn test_delete_group() {
        let storage = crate::test_storage().await;

        let group = DeviceGroup::new("temp", None);
        storage.create_group(&group).await.expect("should create");

        storage.delete_group(&group.id.0).await.expect("should delete");

        let fetched = storage.get_group(&group.id.0).await.expect("should get");
        assert!(fetched.is_none());
    }

    #[tokio::test]
    async fn test_set_and_get_device_group() {
        let storage = crate::test_storage().await;

        // Create a device first
        let cfg = DeviceConfig {
            serial_number: "SN-DEV001".into(),
            label: "Test Device".into(),
            host: "192.168.1.100".into(),
            port: 4370,
            comm_key: 0,
            timezone: None,
            push_enabled: true,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
            group_id: None,
        };
        storage.upsert_device_config(&cfg).await.expect("should create device");

        // Create a group
        let group = DeviceGroup::new("onboarding", None);
        storage.create_group(&group).await.expect("should create group");

        // Assign device to group
        storage.set_device_group("SN-DEV001", Some(&group.id.0)).await.expect("should set");

        // Verify membership
        let fetched =
            storage.get_device_group("SN-DEV001").await.expect("should get").expect("should exist");
        assert_eq!(fetched.name, "onboarding");

        let devices = storage.list_devices_in_group(&group.id.0).await.expect("should list");
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].serial_number, "SN-DEV001");

        // Remove from group
        storage.set_device_group("SN-DEV001", None).await.expect("should unset");

        let after = storage.get_device_group("SN-DEV001").await.expect("should get");
        assert!(after.is_none());
    }

    #[tokio::test]
    async fn test_delete_group_clears_device_membership() {
        let storage = crate::test_storage().await;

        let cfg = DeviceConfig {
            serial_number: "SN-DEV002".into(),
            label: "Test Device 2".into(),
            host: "192.168.1.101".into(),
            port: 4370,
            comm_key: 0,
            timezone: None,
            push_enabled: true,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
            group_id: None,
        };
        storage.upsert_device_config(&cfg).await.expect("should create device");

        let group = DeviceGroup::new("to-delete", None);
        storage.create_group(&group).await.expect("should create group");
        storage.set_device_group("SN-DEV002", Some(&group.id.0)).await.expect("should set");

        storage.delete_group(&group.id.0).await.expect("should delete");

        // Device should no longer be in any group
        let fetched = storage.get_device_group("SN-DEV002").await.expect("should get");
        assert!(fetched.is_none());
    }
}
