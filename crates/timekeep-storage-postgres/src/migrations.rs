use super::PostgresStorage;
use timekeep_core::Error;

impl PostgresStorage {
    pub(super) async fn run_migrations(&self) -> Result<(), Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS attendance_punches (
                id TEXT PRIMARY KEY,
                device_sn TEXT NOT NULL,
                user_pin TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                status INTEGER NOT NULL DEFAULT 0,
                verify_mode INTEGER,
                work_code TEXT,
                raw_data TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("migration failed: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_punches_device_ts
             ON attendance_punches(device_sn, timestamp);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("index creation failed: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_punches_user_ts
             ON attendance_punches(user_pin, timestamp);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("index creation failed: {e}")))?;

        // Devices table stores both device info AND connection config
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS devices (
                serial_number TEXT PRIMARY KEY,
                label TEXT NOT NULL DEFAULT '',
                model TEXT DEFAULT '',
                firmware_version TEXT DEFAULT '',
                platform TEXT DEFAULT '',
                mac_address TEXT DEFAULT '',
                ip_address TEXT DEFAULT '',
                host TEXT NOT NULL DEFAULT '',
                port INTEGER NOT NULL DEFAULT 4370,
                comm_key INTEGER NOT NULL DEFAULT 0,
                push_enabled INTEGER NOT NULL DEFAULT 1,
                timezone TEXT,
                last_seen TIMESTAMPTZ,
                user_capacity INTEGER DEFAULT 0,
                record_capacity INTEGER DEFAULT 0,
                user_count INTEGER DEFAULT 0,
                record_count INTEGER DEFAULT 0
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("devices table migration: {e}")))?;

        // Users table — synced from device user list for PIN → name resolution
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                pin TEXT NOT NULL,
                device_sn TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                privilege INTEGER,
                synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (pin, device_sn)
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("users table migration failed: {e}")))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("users index creation failed: {e}")))?;

        // API keys table — for integration partners (Odoo, Zapier, SAP, etc.)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key_hash TEXT NOT NULL UNIQUE,
                prefix TEXT NOT NULL,
                permissions TEXT NOT NULL DEFAULT '[]',
                created_by TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                last_used_at BIGINT,
                expires_at BIGINT,
                revoked BOOLEAN NOT NULL DEFAULT FALSE
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("api_keys table migration failed: {e}")))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("api_keys index creation failed: {e}")))?;

        // Settings table — key-value store for integration configuration
        sqlx::query(
            r#"
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value_json JSONB NOT NULL DEFAULT '{}'
                    );
                    "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("settings table migration failed: {e}")))?;

        // Integration endpoints table
        sqlx::query(
            r#"
                    CREATE TABLE IF NOT EXISTS integration_endpoints (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        enabled BOOLEAN NOT NULL DEFAULT FALSE,
                        config_json JSONB NOT NULL DEFAULT '{}',
                        created_at BIGINT NOT NULL,
                        updated_at BIGINT NOT NULL
                    );
                    "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("endpoints table migration failed: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_endpoints_kind ON integration_endpoints(kind);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("endpoints index creation failed: {e}")))?;

        // ── v9: Device management tables ──────────────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS device_events (
                id TEXT PRIMARY KEY,
                device_sn TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                event_type TEXT NOT NULL,
                metadata_json JSONB NOT NULL DEFAULT '{}',
                created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_events table: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_device_events_sn_time ON device_events(device_sn, timestamp);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_events idx1: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_events idx2: {e}")))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS device_info (
                serial_number TEXT PRIMARY KEY,
                vendor TEXT NOT NULL DEFAULT 'zkteco',
                model TEXT NOT NULL DEFAULT '',
                firmware_version TEXT NOT NULL DEFAULT '',
                platform TEXT NOT NULL DEFAULT '',
                mac_address TEXT NOT NULL DEFAULT '',
                ip_address TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'offline',
                last_seen BIGINT,
                first_seen BIGINT,
                uptime_seconds BIGINT,
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
                last_sync_at BIGINT,
                last_sync_cursor BIGINT,
                label TEXT,
                location TEXT,
                branch TEXT,
                installed_at BIGINT,
                notes TEXT,
                updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_info table: {e}")))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS providers (
                key TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                default_port INTEGER NOT NULL,
                supports_adms BOOLEAN NOT NULL DEFAULT FALSE,
                supports_sdk BOOLEAN NOT NULL DEFAULT FALSE,
                capabilities_json JSONB NOT NULL DEFAULT '{}',
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("providers table: {e}")))?;

        // ── v11: Outbox for distributor retry ──────────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS pending_deliveries (
                id TEXT PRIMARY KEY,
                endpoint_id TEXT NOT NULL,
                event_json JSONB NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                next_retry_at BIGINT NOT NULL,
                created_at BIGINT NOT NULL
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("pending_deliveries table: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_pd_retry ON pending_deliveries(next_retry_at);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("pending_deliveries idx: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_pd_endpoint ON pending_deliveries(endpoint_id);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("pending_deliveries idx2: {e}")))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS dead_letter_deliveries (
                id TEXT PRIMARY KEY,
                endpoint_id TEXT NOT NULL,
                event_json JSONB NOT NULL,
                attempt_count INTEGER NOT NULL,
                last_error TEXT,
                created_at BIGINT NOT NULL,
                moved_at BIGINT NOT NULL
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("dead_letter_deliveries table: {e}")))?;

        // ── v10: Employees and device enrollments ───────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS employees (
                id TEXT PRIMARY KEY,
                pin TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                department TEXT,
                external_id TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("employees table: {e}")))?;

        sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_pin ON employees(pin);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("idx_employees_pin: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_employees_external_id ON employees(external_id);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("idx_employees_external_id: {e}")))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS device_enrollments (
                employee_id TEXT NOT NULL,
                device_sn TEXT NOT NULL,
                pin TEXT NOT NULL,
                biometric_types TEXT NOT NULL DEFAULT '[]',
                fingerprint_count INTEGER NOT NULL DEFAULT 0,
                face_enrolled INTEGER NOT NULL DEFAULT 0,
                card_number TEXT,
                enrolled_at BIGINT NOT NULL,
                PRIMARY KEY (employee_id, device_sn)
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_enrollments table: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_enrollments_device ON device_enrollments(device_sn);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("idx_enrollments_device: {e}")))?;

        // v12: Fingerprint templates stored centrally per enrollment
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS fingerprint_templates (
                employee_id TEXT NOT NULL,
                device_sn TEXT NOT NULL,
                finger_index INTEGER NOT NULL,
                template_data BYTEA NOT NULL,
                size_bytes INTEGER NOT NULL,
                downloaded_at BIGINT NOT NULL,
                PRIMARY KEY (employee_id, device_sn, finger_index)
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("fingerprint_templates table: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_ft_employee ON fingerprint_templates(employee_id);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("idx_ft_employee: {e}")))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_ft_device ON fingerprint_templates(device_sn);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("idx_ft_device: {e}")))?;

        Ok(())
    }
}
