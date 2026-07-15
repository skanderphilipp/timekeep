use super::SqliteStorage;
use timekeep_core::Error;

pub(crate) const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        "CREATE TABLE IF NOT EXISTS attendance_punches (
                id TEXT PRIMARY KEY,
                device_sn TEXT NOT NULL,
                user_pin TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                status INTEGER NOT NULL DEFAULT 0,
                verify_mode INTEGER,
                work_code TEXT,
                raw_data TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
    ),
    (
        1,
        "CREATE INDEX IF NOT EXISTS idx_punches_device_ts
             ON attendance_punches(device_sn, timestamp)",
    ),
    (
        1,
        "CREATE INDEX IF NOT EXISTS idx_punches_user_ts
             ON attendance_punches(user_pin, timestamp)",
    ),
    (
        1,
        "CREATE TABLE IF NOT EXISTS devices (
                serial_number TEXT PRIMARY KEY,
                label TEXT NOT NULL DEFAULT '',
                model TEXT DEFAULT '',
                firmware_version TEXT DEFAULT '',
                platform TEXT DEFAULT '',
                mac_address TEXT DEFAULT '',
                host TEXT NOT NULL DEFAULT '',
                port INTEGER NOT NULL DEFAULT 4370,
                comm_key INTEGER NOT NULL DEFAULT 0,
                push_enabled INTEGER NOT NULL DEFAULT 1,
                timezone TEXT,
                last_seen TEXT,
                user_capacity INTEGER DEFAULT 0,
                record_capacity INTEGER DEFAULT 0,
                user_count INTEGER DEFAULT 0,
                record_count INTEGER DEFAULT 0
            )",
    ),
    (
        2,
        "CREATE TABLE IF NOT EXISTS users (
                pin TEXT NOT NULL,
                device_sn TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                privilege INTEGER,
                synced_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (pin, device_sn)
            )",
    ),
    (2, "CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin)"),
    (
        3,
        "CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key_hash TEXT NOT NULL UNIQUE,
                prefix TEXT NOT NULL,
                permissions TEXT NOT NULL DEFAULT '[]',
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at TEXT,
                expires_at TEXT,
                revoked INTEGER NOT NULL DEFAULT 0
            )",
    ),
    (3, "CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)"),
    (
        4,
        "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL DEFAULT '{}'
                    )",
    ),
    (
        5,
        "CREATE TABLE IF NOT EXISTS integration_endpoints (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        enabled INTEGER NOT NULL DEFAULT 0,
                        config_json TEXT NOT NULL DEFAULT '{}',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )",
    ),
    (5, "CREATE INDEX IF NOT EXISTS idx_endpoints_kind ON integration_endpoints(kind)"),
    (
        6,
        "CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                resource TEXT NOT NULL DEFAULT '',
                detail_json TEXT,
                ip_address TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                error_message TEXT
            )",
    ),
    (6, "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)"),
    (6, "CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor)"),
    (6, "CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"),
    (
        7,
        "CREATE TABLE IF NOT EXISTS dashboard_users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT 'viewer',
                display_name TEXT NOT NULL DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
    ),
    (
        7,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_users_username ON dashboard_users(username)",
    ),
    (8, "ALTER TABLE dashboard_users ADD COLUMN permissions_text TEXT NOT NULL DEFAULT ''"),
    // ── v9: Device management (events, info, providers) ────────────
    (
        9,
        "CREATE TABLE IF NOT EXISTS device_events (
            id TEXT PRIMARY KEY,
            device_sn TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )",
    ),
    (
        9,
        "CREATE INDEX IF NOT EXISTS idx_device_events_sn_time
            ON device_events(device_sn, timestamp)",
    ),
    (9, "CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type)"),
    (
        9,
        "CREATE TABLE IF NOT EXISTS device_info (
            serial_number TEXT PRIMARY KEY,
            vendor TEXT NOT NULL DEFAULT 'zkteco',
            model TEXT NOT NULL DEFAULT '',
            firmware_version TEXT NOT NULL DEFAULT '',
            platform TEXT NOT NULL DEFAULT '',
            mac_address TEXT NOT NULL DEFAULT '',
            ip_address TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'offline',
            last_seen INTEGER,
            first_seen INTEGER,
            uptime_seconds INTEGER,
            user_capacity INTEGER NOT NULL DEFAULT 0,
            record_capacity INTEGER NOT NULL DEFAULT 0,
            fingerprint_capacity INTEGER NOT NULL DEFAULT 0,
            face_capacity INTEGER NOT NULL DEFAULT 0,
            palm_capacity INTEGER NOT NULL DEFAULT 0,
            user_count INTEGER NOT NULL DEFAULT 0,
            record_count INTEGER NOT NULL DEFAULT 0,
            fingerprint_count INTEGER NOT NULL DEFAULT 0,
            face_count INTEGER NOT NULL DEFAULT 0,
            palm_count INTEGER NOT NULL DEFAULT 0,
            last_sync_at INTEGER,
            last_sync_cursor INTEGER,
            label TEXT,
            location TEXT,
            branch TEXT,
            installed_at INTEGER,
            notes TEXT,
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )",
    ),
    // ── v10: Employees and device enrollments ───────────────────
    (
        10,
        "CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            pin TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            department TEXT,
            external_id TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
    ),
    (10, "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_pin ON employees(pin)"),
    (10, "CREATE INDEX IF NOT EXISTS idx_employees_external_id ON employees(external_id)"),
    (
        10,
        "CREATE TABLE IF NOT EXISTS device_enrollments (
            employee_id TEXT NOT NULL,
            device_sn TEXT NOT NULL,
            pin TEXT NOT NULL,
            biometric_types TEXT NOT NULL DEFAULT '[]',
            fingerprint_count INTEGER NOT NULL DEFAULT 0,
            face_enrolled INTEGER NOT NULL DEFAULT 0,
            card_number TEXT,
            enrolled_at TEXT NOT NULL,
            PRIMARY KEY (employee_id, device_sn)
        )",
    ),
    (10, "CREATE INDEX IF NOT EXISTS idx_enrollments_device ON device_enrollments(device_sn)"),
    (
        9,
        "CREATE TABLE IF NOT EXISTS providers (
            key TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            default_port INTEGER NOT NULL,
            supports_adms INTEGER NOT NULL DEFAULT 0,
            supports_sdk INTEGER NOT NULL DEFAULT 0,
            capabilities_json TEXT NOT NULL DEFAULT '{}',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )",
    ),
    // ── v11: Outbox for distributor retry ─────────────────────────
    (
        11,
        "CREATE TABLE IF NOT EXISTS pending_deliveries (
            id TEXT PRIMARY KEY,
            endpoint_id TEXT NOT NULL,
            event_json TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )",
    ),
    (11, "CREATE INDEX IF NOT EXISTS idx_pending_retry ON pending_deliveries(next_retry_at)"),
    (11, "CREATE INDEX IF NOT EXISTS idx_pending_endpoint ON pending_deliveries(endpoint_id)"),
    (
        11,
        "CREATE TABLE IF NOT EXISTS dead_letter_deliveries (
            id TEXT PRIMARY KEY,
            endpoint_id TEXT NOT NULL,
            event_json TEXT NOT NULL,
            attempt_count INTEGER NOT NULL,
            last_error TEXT,
            created_at INTEGER NOT NULL,
            moved_at INTEGER NOT NULL
        )",
    ),
    // v12: Fingerprint templates stored centrally per enrollment
    (
        12,
        "CREATE TABLE IF NOT EXISTS fingerprint_templates (
            employee_id TEXT NOT NULL,
            device_sn TEXT NOT NULL,
            finger_index INTEGER NOT NULL,
            template_data BLOB NOT NULL,
            size_bytes INTEGER NOT NULL,
            downloaded_at INTEGER NOT NULL,
            PRIMARY KEY (employee_id, device_sn, finger_index),
            FOREIGN KEY (employee_id, device_sn) REFERENCES device_enrollments(employee_id, device_sn)
        )",
    ),
    (12, "CREATE INDEX IF NOT EXISTS idx_ft_employee ON fingerprint_templates(employee_id)"),
    (12, "CREATE INDEX IF NOT EXISTS idx_ft_device ON fingerprint_templates(device_sn)"),
];

impl SqliteStorage {
    /// Apply only pending migrations in version order.
    pub(crate) async fn run_migrations(&self) -> Result<(), Error> {
        // Ensure the version tracking table exists first.
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS _schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("_schema_version table creation failed: {e}")))?;

        // Read current schema version (defaults to 0 if empty).
        let current_version: i64 =
            sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _schema_version")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("failed to read schema version: {e}")))?;

        for &(version, sql) in MIGRATIONS {
            if version <= current_version {
                continue;
            }

            sqlx::query(sql)
                .execute(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("migration v{version} failed: {e}")))?;

            sqlx::query("INSERT OR IGNORE INTO _schema_version (version) VALUES (?)")
                .bind(version)
                .execute(&self.pool)
                .await
                .map_err(|e| {
                    Error::storage(format!("failed to record migration v{version}: {e}"))
                })?;

            tracing::info!(version, "applied migration");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_migrations_idempotent() {
        let storage = crate::test_storage().await;

        // Run migrations a second time — should be a no-op
        storage.run_migrations().await.expect("second run should succeed");

        // Verify tables still exist by inserting a punch
        let punch = crate::punch::tests::test_punch(
            "145",
            "SN001",
            1752129600,
            timekeep_core::PunchStatus::CheckIn,
        );
        storage.store_punch(&punch).await.expect("should still work");
    }
}
