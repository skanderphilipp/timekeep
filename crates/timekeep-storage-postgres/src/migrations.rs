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

        // v13 — expand users table with device-native fields
        for col in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS card_number TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS group_num INTEGER",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone INTEGER",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
        ] {
            sqlx::query(col)
                .execute(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("users migration v13: {e}")))?;
        }

        // v14 — departments table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                work_policy_json TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("departments table: {e}")))?;

        // v15 — device groups table for organizational device grouping
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS device_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("device_groups table: {e}")))?;

        // v15 — add group_id column to devices
        sqlx::query(
            "ALTER TABLE devices ADD COLUMN IF NOT EXISTS group_id TEXT
             REFERENCES device_groups(id) ON DELETE SET NULL",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("devices group_id column: {e}")))?;

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

        // v16 — add department_id FK to employees (references departments table)
        sqlx::query(
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("employees department_id column: {e}")))?;

        // v17 — Work policy templates table + seed data
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS work_policy_templates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL UNIQUE,
                description TEXT,
                work_start TEXT NOT NULL,
                work_end TEXT NOT NULL,
                late_threshold_secs BIGINT NOT NULL DEFAULT 900,
                min_seconds_for_present BIGINT NOT NULL DEFAULT 14400,
                daily_overtime_after_secs BIGINT NOT NULL DEFAULT 28800,
                working_days TEXT NOT NULL DEFAULT '[true,true,true,true,true,false,false]',
                created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
                updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("work_policy_templates table: {e}")))?;

        // Seed predefined work policy templates (7 common shift patterns)
        let seeds = [
            (
                "seed_standard_mon_fri",
                "Standard (Mon-Fri)",
                "Standard 9-to-5 schedule, Monday through Friday",
                "09:00",
                "17:00",
                900i64,
                14400i64,
                28800i64,
                "[true,true,true,true,true,false,false]",
            ),
            (
                "seed_standard_sun_thu",
                "Standard (Sun-Thu)",
                "Standard schedule Sunday through Thursday (Middle East work week)",
                "08:00",
                "17:00",
                900,
                14400,
                28800,
                "[false,true,true,true,true,true,false]",
            ),
            (
                "seed_night_shift",
                "Night Shift",
                "Overnight shift with next-day end time",
                "22:00",
                "06:00",
                900,
                14400,
                28800,
                "[true,true,true,true,true,false,false]",
            ),
            (
                "seed_flexible",
                "Flexible Hours",
                "No fixed schedule. Late detection disabled.",
                "00:00",
                "23:59",
                0,
                14400,
                86400,
                "[true,true,true,true,true,false,false]",
            ),
            (
                "seed_weekend_shift",
                "Weekend Shift",
                "Day shift covering Saturday and Sunday",
                "08:00",
                "20:00",
                900,
                14400,
                43200,
                "[false,false,false,false,false,true,true]",
            ),
            (
                "seed_12h_day",
                "12-Hour Day Shift",
                "Long day shift, 4 days per week",
                "06:00",
                "18:00",
                900,
                21600,
                43200,
                "[true,true,true,true,false,false,false]",
            ),
            (
                "seed_12h_night",
                "12-Hour Night Shift",
                "Long night shift, 4 nights per week",
                "18:00",
                "06:00",
                900,
                21600,
                43200,
                "[true,true,true,true,false,false,false]",
            ),
        ];

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        for (id, title, desc, start, end, late, min_h, ot, days) in seeds {
            sqlx::query(
                "INSERT INTO work_policy_templates (id, title, description, work_start, work_end, late_threshold_secs, min_seconds_for_present, daily_overtime_after_secs, working_days, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (id) DO NOTHING",
            )
            .bind(id)
            .bind(title)
            .bind(desc)
            .bind(start)
            .bind(end)
            .bind(late)
            .bind(min_h)
            .bind(ot)
            .bind(days)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("seed work policy template '{title}': {e}")))?;
        }

        // v18 — Add work_policy_id FK to departments
        sqlx::query(
            "ALTER TABLE departments ADD COLUMN IF NOT EXISTS work_policy_id TEXT REFERENCES work_policy_templates(id) ON DELETE SET NULL",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("departments work_policy_id column: {e}")))?;

        // ── v13: Audit logs ────────────────────────────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                resource TEXT NOT NULL DEFAULT '',
                detail_json JSONB,
                ip_address TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                error_message TEXT
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("audit_logs table: {e}")))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("idx_audit_timestamp: {e}")))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("idx_audit_actor: {e}")))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("idx_audit_action: {e}")))?;

        // ── v14: Dashboard users ────────────────────────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS dashboard_users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT 'viewer',
                permissions_text TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL DEFAULT '',
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("dashboard_users table: {e}")))?;

        sqlx::query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_users_username ON dashboard_users(username);",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("idx_dashboard_users_username: {e}")))?;

        Ok(())
    }
}
