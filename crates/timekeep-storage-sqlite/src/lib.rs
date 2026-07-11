//! # timekeep-storage-sqlite
//!
//! SQLite storage backend for timekeep. Uses WAL mode for
//! concurrent reads during writes. Single-file, zero-configuration.

use async_trait::async_trait;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use timekeep_core::{
    Error, FacetGroup, FacetKind, FacetOption, FacetQuery,
    model::{AttendancePunch, Device, DeviceConfig},
    traits::storage::{PunchFilter, Storage},
};

/// SQLite-backed attendance storage.
pub struct SqliteStorage {
    pool: SqlitePool,
}

impl SqliteStorage {
    /// Create a new SQLite storage backend.
    pub async fn new(database_url: &str) -> Result<Self, Error> {
        // Use SqliteConnectOptions to avoid URL-parsing ambiguities.
        // sqlx 0.8 interprets sqlite:// differently on different platforms;
        // passing a raw filename is more robust.
        let options = if database_url == ":memory:" {
            SqliteConnectOptions::new().in_memory(true).shared_cache(true).filename(":memory:")
        } else if database_url.starts_with("sqlite:") {
            // Strip the sqlite: prefix for the raw filename
            let path = database_url
                .strip_prefix("sqlite://")
                .or_else(|| database_url.strip_prefix("sqlite:"))
                .unwrap_or(database_url);
            SqliteConnectOptions::new().filename(path).create_if_missing(true)
        } else if database_url.starts_with('/') {
            SqliteConnectOptions::new().filename(database_url).create_if_missing(true)
        } else {
            let cwd = std::env::current_dir()
                .map_err(|e| Error::storage(format!("failed to get current directory: {e}")))?;
            let absolute = cwd.join(database_url);
            SqliteConnectOptions::new()
                .filename(absolute.to_str().unwrap_or(database_url))
                .create_if_missing(true)
        };

        let pool = SqlitePoolOptions::new()
            .max_connections(if database_url == ":memory:" { 1 } else { 5 })
            .connect_with(options)
            .await
            .map_err(|e| {
                Error::storage(format!("failed to open SQLite at '{database_url}': {e}"))
            })?;

        // Enable WAL mode for better concurrent read performance
        sqlx::query("PRAGMA journal_mode=WAL;")
            .execute(&pool)
            .await
            .map_err(|e| Error::storage(format!("failed to enable WAL: {e}")))?;

        let storage = Self { pool };
        storage.run_migrations().await?;

        Ok(storage)
    }

    /// Apply only pending migrations in version order.
    async fn run_migrations(&self) -> Result<(), Error> {
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

    // ── Facet helpers ───────────────────────────────────────────────

    /// Build the WHERE clause fragment for contextual facet counts.
    fn push_context_clauses<'a>(
        &self,
        builder: &mut sqlx::QueryBuilder<'a, sqlx::Sqlite>,
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
            builder
                .push(" AND EXISTS (SELECT 1 FROM attendance_anomalies a WHERE a.punch_id = p.id)");
        }
    }

    async fn facet_devices(
        &self,
        query: &timekeep_core::FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;

        let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT d.serial_number as value, COALESCE(d.label, d.serial_number) as label, CAST(COUNT(*) AS INTEGER) as count
             FROM attendance_punches p
             LEFT JOIN devices d ON d.serial_number = p.device_sn
             WHERE 1=1",
        );
        self.push_context_clauses(&mut builder, &query.context);
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

    async fn facet_statuses(&self, query: &timekeep_core::FacetQuery) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        use timekeep_core::facet::STATUS_VALUES;

        let mut options = Vec::with_capacity(STATUS_VALUES.len());

        for (value, label) in STATUS_VALUES {
            let code = timekeep_core::facet::status_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM attendance_punches p WHERE 1=1 AND p.status = ",
            );
            builder.push_bind(code);
            self.push_context_clauses(&mut builder, &query.context);

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet status {value}: {e}")))?;

            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }

        // Sort by count descending
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

    async fn facet_verify_modes(
        &self,
        query: &timekeep_core::FacetQuery,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        use timekeep_core::facet::VERIFY_MODE_VALUES;

        let mut options = Vec::with_capacity(VERIFY_MODE_VALUES.len());

        for (value, label) in VERIFY_MODE_VALUES {
            let code = timekeep_core::facet::verify_mode_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
                "SELECT CAST(COUNT(*) AS INTEGER) FROM attendance_punches p WHERE 1=1 AND p.verify_mode = ",
            );
            builder.push_bind(code);
            self.push_context_clauses(&mut builder, &query.context);

            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet verify_mode {value}: {e}")))?;

            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }

        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));

        Ok(FacetGroup {
            key: "verify_mode".into(),
            label: "Method".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    async fn facet_employees(
        &self,
        query: &timekeep_core::FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;

        let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT p.user_pin as value, COALESCE(e.name, u.name, p.user_pin) as label, CAST(COUNT(*) AS INTEGER) as count
             FROM attendance_punches p
             LEFT JOIN employees e ON e.pin = p.user_pin
             LEFT JOIN users u ON u.pin = p.user_pin
             WHERE 1=1",
        );

        // Apply search filter on employee/user name
        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder.push(" AND (e.name LIKE ");
            builder.push_bind(pattern.clone());
            builder.push(" ESCAPE '\\' OR u.name LIKE ");
            builder.push_bind(pattern.clone());
            builder.push(" ESCAPE '\\' OR p.user_pin LIKE ");
            builder.push_bind(pattern);
            builder.push(" ESCAPE '\\')");
        }

        self.push_context_clauses(&mut builder, &query.context);
        builder.push(" GROUP BY p.user_pin ORDER BY count DESC LIMIT ");
        builder.push_bind(limit);

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
}

/// Ordered migrations. Each tuple is (version, SQL).
/// Version numbers need not be sequential — gaps are fine.
/// New migrations are appended; only versions > current are applied.
const MIGRATIONS: &[(i64, &str)] = &[
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
];

#[async_trait]
impl Storage for SqliteStorage {
    async fn store_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        let dedup_id = punch.generate_deduplication_id();

        sqlx::query(
            "INSERT OR IGNORE INTO attendance_punches
             (id, device_sn, user_pin, timestamp, status, verify_mode, work_code, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&dedup_id)
        .bind(&punch.device_sn)
        .bind(&punch.user_pin)
        .bind(punch.timestamp.as_second().to_string())
        .bind(punch.status as i32)
        .bind(punch.verify_mode as i32)
        .bind(&punch.work_code)
        .bind(&punch.raw_data)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("insert punch: {e}")))?;

        Ok(())
    }

    async fn store_punches(&self, punches: &[AttendancePunch]) -> Result<u64, Error> {
        let mut tx =
            self.pool.begin().await.map_err(|e| Error::storage(format!("begin tx: {e}")))?;

        let mut count = 0u64;
        for punch in punches {
            let dedup_id = punch.generate_deduplication_id();
            let result = sqlx::query(
                "INSERT OR IGNORE INTO attendance_punches
                 (id, device_sn, user_pin, timestamp, status, verify_mode, work_code, raw_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&dedup_id)
            .bind(&punch.device_sn)
            .bind(&punch.user_pin)
            .bind(punch.timestamp.as_second().to_string())
            .bind(punch.status as i32)
            .bind(punch.verify_mode as i32)
            .bind(&punch.work_code)
            .bind(&punch.raw_data)
            .execute(&mut *tx)
            .await
            .map_err(|e| Error::storage(format!("batch insert punch: {e}")))?;

            count += result.rows_affected();
        }

        tx.commit().await.map_err(|e| Error::storage(format!("commit tx: {e}")))?;
        Ok(count)
    }

    async fn query_punches(&self, filter: &PunchFilter) -> Result<Vec<AttendancePunch>, Error> {
        use sqlx::QueryBuilder;

        let mut builder = QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT p.id, p.device_sn, p.user_pin, p.timestamp, p.status, p.verify_mode, p.work_code, p.raw_data,
                    COALESCE(e.name, u.name) as employee_name,
                    d.label as device_label
             FROM attendance_punches p
             LEFT JOIN users u ON u.pin = p.user_pin
             LEFT JOIN employees e ON e.pin = p.user_pin
             LEFT JOIN devices d ON d.serial_number = p.device_sn
             WHERE 1=1",
        );

        // ── Device filter (multi-select takes precedence; single is backward compat) ──
        if let Some(sns) = &filter.device_sns {
            if !sns.is_empty() {
                builder.push(" AND p.device_sn IN (");
                let mut separated = builder.separated(", ");
                for sn in sns {
                    separated.push_bind(sn);
                }
                separated.push_unseparated(")");
            }
        } else if let Some(sn) = &filter.device_sn {
            builder.push(" AND p.device_sn = ");
            builder.push_bind(sn);
        }
        if let Some(pin) = &filter.user_pin {
            builder.push(" AND p.user_pin = ");
            builder.push_bind(pin);
        }
        if let Some(since) = &filter.since {
            builder.push(" AND p.timestamp >= ");
            builder.push_bind(since.as_second().to_string());
        }
        if let Some(until) = &filter.until {
            builder.push(" AND p.timestamp <= ");
            builder.push_bind(until.as_second().to_string());
        }
        if let Some(status) = &filter.status {
            builder.push(" AND p.status = ");
            builder.push_bind(*status as i32);
        }
        if let Some(verify_mode) = &filter.verify_mode {
            builder.push(" AND p.verify_mode = ");
            builder.push_bind(*verify_mode as i32);
        }
        if filter.anomalies_only.unwrap_or(false) {
            builder
                .push(" AND EXISTS (SELECT 1 FROM attendance_anomalies a WHERE a.punch_id = p.id)");
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

        let sort_col = match filter.params.sort_by.as_deref().unwrap_or("timestamp") {
            "timestamp" => "timestamp",
            "user_pin" => "user_pin",
            "device_sn" => "device_sn",
            "status" => "status",
            _ => "timestamp",
        };
        let sort_dir = filter.params.sort_order.as_sql();
        builder.push(format!(" ORDER BY p.{sort_col} {sort_dir}"));

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

    async fn punch_facets(&self, query: &FacetQuery) -> Result<Vec<FacetGroup>, Error> {
        let limit = query.clamped_limit() as i64;
        let dimensions: Vec<&str> = if let Some(ref dim) = query.dimension {
            if !timekeep_core::FacetDimension::is_valid_punch_dimension(dim) {
                return Err(Error::storage(format!("unknown facet dimension: {dim}")));
            }
            vec![dim.as_str()]
        } else {
            vec!["device_sn", "status", "verify_mode", "employee"]
        };

        let mut groups = Vec::with_capacity(dimensions.len());

        for dim_key in dimensions {
            let group = match dim_key {
                "device_sn" => self.facet_devices(query, limit).await?,
                "status" => self.facet_statuses(query).await?,
                "verify_mode" => self.facet_verify_modes(query).await?,
                "employee" => self.facet_employees(query, limit).await?,
                _ => unreachable!(),
            };
            groups.push(group);
        }

        Ok(groups)
    }

    async fn upsert_device(&self, device: &Device) -> Result<(), Error> {
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

    async fn upsert_device_config(&self, config: &DeviceConfig) -> Result<(), Error> {
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

    async fn list_device_configs(&self) -> Result<Vec<DeviceConfig>, Error> {
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

    async fn list_device_configs_filtered(
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

    async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM devices WHERE serial_number = ?")
            .bind(serial_number)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete device config: {e}")))?;

        Ok(())
    }

    async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        let result = sqlx::query_as::<_, TimestampRow>(
            "SELECT timestamp FROM attendance_punches
             WHERE device_sn = ? ORDER BY timestamp DESC LIMIT 1",
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

    async fn punch_exists(&self, dedup_id: &str) -> Result<bool, Error> {
        let exists =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM attendance_punches WHERE id = ?")
                .bind(dedup_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("punch exists check: {e}")))?;

        Ok(exists > 0)
    }

    async fn upsert_user(
        &self,
        device_sn: &str,
        pin: &str,
        name: &str,
        privilege: Option<i32>,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO users (pin, device_sn, name, privilege, synced_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(pin, device_sn) DO UPDATE SET
                name = EXCLUDED.name,
                privilege = EXCLUDED.privilege,
                synced_at = datetime('now')",
        )
        .bind(pin)
        .bind(device_sn)
        .bind(name)
        .bind(privilege)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert user: {e}")))?;

        Ok(())
    }

    async fn get_user_name(&self, pin: &str) -> Result<Option<String>, Error> {
        let result =
            sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE pin = ? LIMIT 1")
                .bind(pin)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("get user name: {e}")))?;

        Ok(result)
    }

    async fn health_check(&self) -> Result<(), Error> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("health check: {e}")))?;
        Ok(())
    }

    // ── API Key management ──────────────────────────────────────

    async fn create_api_key(&self, key: &timekeep_core::ApiKey) -> Result<(), Error> {
        let perms_json = key.permissions.to_json_array();
        let created_at = key.created_at.as_second().to_string();
        let last_used = key.last_used_at.map(|t| t.as_second().to_string());
        let expires = key.expires_at.map(|t| t.as_second().to_string());

        sqlx::query(
            "INSERT INTO api_keys (id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&key.id)
        .bind(&key.name)
        .bind(&key.key_hash)
        .bind(&key.prefix)
        .bind(&perms_json)
        .bind(&key.created_by)
        .bind(&created_at)
        .bind(&last_used)
        .bind(&expires)
        .bind(key.revoked as i32)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create api key: {e}")))?;

        Ok(())
    }

    async fn find_api_key_by_hash(
        &self,
        key_hash: &str,
    ) -> Result<Option<timekeep_core::ApiKey>, Error> {
        let row = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked
             FROM api_keys WHERE key_hash = ? AND revoked = 0",
        )
        .bind(key_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find api key: {e}")))?;

        row.map(|r| r.into_api_key()).transpose()
    }

    async fn list_api_keys(&self) -> Result<Vec<timekeep_core::ApiKey>, Error> {
        let rows = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked
             FROM api_keys ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list api keys: {e}")))?;

        rows.into_iter().map(|r| r.into_api_key()).collect()
    }

    async fn revoke_api_key(&self, key_id: &str) -> Result<(), Error> {
        let affected = sqlx::query("UPDATE api_keys SET revoked = 1 WHERE id = ?")
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("revoke api key: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("api key '{key_id}' not found")));
        }
        Ok(())
    }

    async fn touch_api_key(&self, key_id: &str) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second().to_string();
        sqlx::query("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
            .bind(&now)
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("touch api key: {e}")))?;
        Ok(())
    }

    // ── Integration Endpoints ─────────────────────────────────

    async fn list_endpoints(&self) -> Result<Vec<timekeep_core::IntegrationEndpoint>, Error> {
        let rows: Vec<EndpointRow> = sqlx::query_as(
            "SELECT id, name, kind, enabled, config_json, created_at, updated_at
             FROM integration_endpoints ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list endpoints: {e}")))?;

        rows.into_iter().map(|r| r.into_endpoint()).collect()
    }

    async fn list_endpoints_filtered(
        &self,
        filter: &timekeep_core::EndpointFilter,
    ) -> Result<timekeep_core::ListResult<timekeep_core::IntegrationEndpoint>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = match filter.params.sort_by.as_deref().unwrap_or("created_at") {
            "name" => "name",
            "kind" => "kind",
            "created_at" => "created_at",
            "updated_at" => "updated_at",
            _ => "created_at",
        };
        let sort_dir = filter.params.sort_order.as_sql();
        let limit = filter.params.clamped_limit();

        let mut where_clauses: Vec<String> = Vec::new();
        let mut where_values: Vec<String> = Vec::new();

        if let Some(ref search) = filter.params.search
            && !search.is_empty()
        {
            let pattern = sanitize_search(search);
            where_clauses.push("(name LIKE ? ESCAPE '\\' OR kind LIKE ? ESCAPE '\\')".into());
            where_values.push(pattern.clone());
            where_values.push(pattern);
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM integration_endpoints {where_sql}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        for val in &where_values {
            count_query = count_query.bind(val);
        }
        let total: i64 = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count endpoints: {e}")))?;

        let query_sql = format!(
            "SELECT id, name, kind, enabled, config_json, created_at, updated_at
             FROM integration_endpoints {where_sql} ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );
        let mut query = sqlx::query_as::<_, EndpointRow>(&query_sql);
        for val in &where_values {
            query = query.bind(val);
        }
        let rows = query
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("list endpoints filtered: {e}")))?;

        let items: Vec<timekeep_core::IntegrationEndpoint> =
            rows.into_iter().map(|r| r.into_endpoint()).collect::<Result<_, _>>()?;

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    async fn create_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        let config = serde_json::to_string(&endpoint.config)
            .map_err(|e| Error::storage(format!("serialize endpoint config: {e}")))?;
        let kind = endpoint.kind.to_string();

        sqlx::query(
            "INSERT INTO integration_endpoints (id, name, kind, enabled, config_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&endpoint.id)
        .bind(&endpoint.name)
        .bind(&kind)
        .bind(endpoint.enabled as i32)
        .bind(&config)
        .bind(endpoint.created_at)
        .bind(endpoint.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create endpoint: {e}")))?;

        tracing::info!(name = %endpoint.name, kind = %kind, "integration endpoint created");
        Ok(())
    }

    async fn update_endpoint(
        &self,
        endpoint: &timekeep_core::IntegrationEndpoint,
    ) -> Result<(), Error> {
        let config = serde_json::to_string(&endpoint.config)
            .map_err(|e| Error::storage(format!("serialize endpoint config: {e}")))?;
        let kind = endpoint.kind.to_string();

        let affected = sqlx::query(
            "UPDATE integration_endpoints
             SET name = ?, kind = ?, enabled = ?, config_json = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&endpoint.name)
        .bind(&kind)
        .bind(endpoint.enabled as i32)
        .bind(&config)
        .bind(endpoint.updated_at)
        .bind(&endpoint.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update endpoint: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("endpoint '{}' not found", endpoint.id)));
        }

        tracing::info!(name = %endpoint.name, "integration endpoint updated");
        Ok(())
    }

    async fn delete_endpoint(&self, id: &str) -> Result<(), Error> {
        let affected = sqlx::query("DELETE FROM integration_endpoints WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete endpoint: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("endpoint '{id}' not found")));
        }

        tracing::info!(id = %id, "integration endpoint deleted");
        Ok(())
    }

    // ── System Settings ───────────────────────────────────────

    async fn get_system_settings(&self) -> Result<timekeep_core::SystemSettings, Error> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value_json FROM settings WHERE key = 'system'")
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("get system settings: {e}")))?;

        match row {
            Some((json,)) => serde_json::from_str(&json)
                .map_err(|e| Error::storage(format!("deserialize system settings: {e}"))),
            None => Ok(timekeep_core::SystemSettings::default()),
        }
    }

    async fn upsert_system_settings(
        &self,
        settings: &timekeep_core::SystemSettings,
    ) -> Result<(), Error> {
        let json = serde_json::to_string(settings)
            .map_err(|e| Error::storage(format!("serialize system settings: {e}")))?;

        sqlx::query(
            "INSERT INTO settings (key, value_json) VALUES ('system', ?)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        )
        .bind(&json)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("upsert system settings: {e}")))?;

        tracing::info!("system settings updated");
        Ok(())
    }

    // ── Audit Log ────────────────────────────────────────────

    async fn record_audit(&self, event: &timekeep_core::AuditEvent) -> Result<(), Error> {
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

    async fn query_audit_logs(
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
            where_clauses.push("(actor LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR resource LIKE ? ESCAPE '\\')".into());
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
            rows.into_iter().map(|r| r.into_event()).collect();

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;

        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    // ── Dashboard User Management ──────────────────────────

    async fn create_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.to_string();
        let perms_text = user.permissions.to_space_separated();
        sqlx::query(
            "INSERT INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&user.id)
        .bind(&user.username)
        .bind(&user.password_hash)
        .bind(&user.salt)
        .bind(&role_str)
        .bind(&user.display_name)
        .bind(user.active as i32)
        .bind(user.created_at)
        .bind(user.updated_at)
        .bind(&perms_text)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("UNIQUE") {
                Error::duplicate(format!("username '{}' already exists", user.username))
            } else {
                Error::storage(format!("create dashboard user: {e}"))
            }
        })?;
        tracing::info!(username = %user.username, role = %role_str, "dashboard user created");
        Ok(())
    }

    async fn find_dashboard_user_by_username(
        &self,
        username: &str,
    ) -> Result<Option<timekeep_core::DashboardUser>, Error> {
        let row = sqlx::query_as::<_, DashboardUserRow>(
            "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
             FROM dashboard_users WHERE username = ? AND active = 1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find dashboard user: {e}")))?;

        row.map(|r| r.into_user()).transpose()
    }

    async fn list_dashboard_users(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::DashboardUser>, Error> {
        use timekeep_core::sanitize_search;

        let sort_col = match params.sort_by.as_deref().unwrap_or("username") {
            "username" => "username",
            "role" => "role",
            "display_name" => "display_name",
            "created_at" => "created_at",
            _ => "username",
        };
        let sort_dir = params.sort_order.as_sql();
        let limit = params.clamped_limit();

        // Count
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM dashboard_users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("count dashboard users: {e}")))?;

        // Fetch
        let mut query_sql = format!(
            "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
             FROM dashboard_users ORDER BY {sort_col} {sort_dir} LIMIT ?"
        );

        // Apply search if provided
        let rows: Vec<DashboardUserRow> = if let Some(ref search) = params.search {
            if !search.is_empty() {
                let pattern = sanitize_search(search);
                query_sql = format!(
                    "SELECT id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text
                     FROM dashboard_users
                     WHERE (username LIKE ? ') ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
                     ORDER BY {sort_col} {sort_dir} LIMIT ?"
                );
                sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                    .bind(&pattern)
                    .bind(&pattern)
                    .bind(limit as i64)
                    .fetch_all(&self.pool)
                    .await
                    .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
            } else {
                sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                    .bind(limit as i64)
                    .fetch_all(&self.pool)
                    .await
                    .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
            }
        } else {
            sqlx::query_as::<_, DashboardUserRow>(&query_sql)
                .bind(limit as i64)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("list dashboard users: {e}")))?
        };

        let items: Vec<timekeep_core::DashboardUser> =
            rows.into_iter().map(|r| r.into_user()).collect::<Result<_, _>>()?;

        let total_u64 = total as u64;
        let has_more = (items.len() as u64) < total_u64;
        Ok(timekeep_core::ListResult::paginated(items, total_u64, has_more, None))
    }

    async fn update_dashboard_user(
        &self,
        user: &timekeep_core::DashboardUser,
    ) -> Result<(), Error> {
        let role_str = user.role.to_string();
        let perms_update_text = user.permissions.to_space_separated();
        let affected = sqlx::query(
            "UPDATE dashboard_users
             SET role = ?, display_name = ?, active = ?, permissions_text = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&role_str)
        .bind(&user.display_name)
        .bind(user.active as i32)
        .bind(&perms_update_text)
        .bind(user.updated_at)
        .bind(&user.id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update dashboard user: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{}' not found", user.id)));
        }
        tracing::info!(id = %user.id, username = %user.username, "dashboard user updated");
        Ok(())
    }

    async fn delete_dashboard_user(&self, id: &str) -> Result<(), Error> {
        let affected = sqlx::query("DELETE FROM dashboard_users WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete dashboard user: {e}")))?
            .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{id}' not found")));
        }
        tracing::info!(id = %id, "dashboard user deleted");
        Ok(())
    }

    async fn update_dashboard_user_password(
        &self,
        id: &str,
        password_hash: &str,
        salt: &str,
    ) -> Result<(), Error> {
        let now = jiff::Timestamp::now().as_second();
        let affected = sqlx::query(
            "UPDATE dashboard_users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?",
        )
        .bind(password_hash)
        .bind(salt)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update password: {e}")))?
        .rows_affected();

        if affected == 0 {
            return Err(Error::not_found(format!("user '{id}' not found")));
        }
        tracing::info!(id = %id, "dashboard user password changed");
        Ok(())
    }

    // ── Device Events (activity timeline) ─────────────────────────────

    async fn record_device_event(&self, event: &timekeep_core::DeviceEvent) -> Result<(), Error> {
        let metadata = serde_json::to_string(&event.metadata).unwrap_or_else(|_| "{}".to_string());
        let ts = event.timestamp.as_second();

        sqlx::query(
            "INSERT INTO device_events (id, device_sn, timestamp, event_type, metadata_json)
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

    async fn query_device_events(
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

    async fn count_device_events(
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

    // ── Device Info (enriched device metadata) ────────────────────────

    async fn upsert_device_info(&self, device: &Device) -> Result<(), Error> {
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

    async fn get_device_info(&self, serial_number: &str) -> Result<Option<Device>, Error> {
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

    // ── Provider Registry ─────────────────────────────────────────────

    async fn register_provider(&self, provider: &timekeep_core::ProviderInfo) -> Result<(), Error> {
        let caps =
            serde_json::to_string(&provider.capabilities).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO providers (key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET
                display_name=excluded.display_name,
                default_port=excluded.default_port,
                supports_adms=excluded.supports_adms,
                supports_sdk=excluded.supports_sdk,
                capabilities_json=excluded.capabilities_json,
                enabled=excluded.enabled",
        )
        .bind(&provider.key)
        .bind(&provider.display_name)
        .bind(provider.default_port as i64)
        .bind(provider.supports_adms as i64)
        .bind(provider.supports_sdk as i64)
        .bind(&caps)
        .bind(provider.enabled as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("register provider: {e}")))?;

        Ok(())
    }

    async fn list_providers(&self) -> Result<Vec<timekeep_core::ProviderInfo>, Error> {
        let rows = sqlx::query_as::<_, ProviderRow>(
            "SELECT key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled
             FROM providers ORDER BY key",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list providers: {e}")))?;

        Ok(rows.into_iter().map(|r| r.into_provider_info()).collect())
    }
}

// ─── Row types for sqlx query_as ────────────────────────────────────

#[derive(sqlx::FromRow)]
struct PunchRow {
    id: String,
    device_sn: String,
    user_pin: String,
    timestamp: String,
    status: i32,
    verify_mode: Option<i32>,
    work_code: Option<String>,
    raw_data: Option<String>,
    employee_name: Option<String>,
    device_label: Option<String>,
}

impl PunchRow {
    fn into_punch(self) -> Result<AttendancePunch, Error> {
        let ts = self
            .timestamp
            .parse::<i64>()
            .map_err(|e| Error::storage(format!("parse timestamp: {e}")))?;
        let timestamp = jiff::Timestamp::from_second(ts)
            .map_err(|e| Error::storage(format!("timestamp from second: {e}")))?;

        Ok(AttendancePunch {
            id: self.id,
            device_sn: self.device_sn,
            user_pin: self.user_pin,
            timestamp,
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
            raw_data: self.raw_data,
        })
    }
}

#[derive(sqlx::FromRow)]
struct TimestampRow {
    timestamp: String,
}

#[derive(sqlx::FromRow)]
struct DeviceConfigRow {
    serial_number: String,
    label: String,
    host: String,
    port: i64,
    comm_key: i64,
    push_enabled: i64,
    timezone: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ApiKeyRow {
    id: String,
    name: String,
    key_hash: String,
    prefix: String,
    permissions: String, // JSON array
    created_by: String,
    created_at: String,
    last_used_at: Option<String>,
    expires_at: Option<String>,
    revoked: i32,
}

impl ApiKeyRow {
    fn into_api_key(self) -> Result<timekeep_core::ApiKey, Error> {
        let created_at = {
            let ts = self
                .created_at
                .parse::<i64>()
                .map_err(|e| Error::storage(format!("parse created_at: {e}")))?;
            jiff::Timestamp::from_second(ts)
                .map_err(|e| Error::storage(format!("timestamp: {e}")))?
        };

        let last_used_at = self
            .last_used_at
            .map(|s| {
                let ts = s
                    .parse::<i64>()
                    .map_err(|e| Error::storage(format!("parse last_used_at: {e}")))?;
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;

        let expires_at = self
            .expires_at
            .map(|s| {
                let ts = s
                    .parse::<i64>()
                    .map_err(|e| Error::storage(format!("parse expires_at: {e}")))?;
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;

        let permissions = timekeep_core::PermissionSet::from_json_array(&self.permissions)
            .map_err(|e| Error::storage(format!("parse permissions: {e}")))?;

        Ok(timekeep_core::ApiKey {
            id: self.id,
            name: self.name,
            key_hash: self.key_hash,
            prefix: self.prefix,
            permissions,
            created_by: self.created_by,
            created_at,
            last_used_at,
            expires_at,
            revoked: self.revoked != 0,
        })
    }
}

#[derive(sqlx::FromRow)]
struct EndpointRow {
    id: String,
    name: String,
    kind: String,
    enabled: i32,
    config_json: String,
    created_at: i64,
    updated_at: i64,
}

impl EndpointRow {
    fn into_endpoint(self) -> Result<timekeep_core::IntegrationEndpoint, Error> {
        let kind = timekeep_core::IntegrationKind::from_str(&self.kind)
            .unwrap_or(timekeep_core::IntegrationKind::Webhook);
        let config: serde_json::Value = serde_json::from_str(&self.config_json)
            .map_err(|e| Error::storage(format!("parse endpoint config: {e}")))?;

        Ok(timekeep_core::IntegrationEndpoint {
            id: self.id,
            name: self.name,
            kind,
            enabled: self.enabled != 0,
            config,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

#[derive(sqlx::FromRow)]
struct AuditRow {
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
    fn into_event(self) -> timekeep_core::AuditEvent {
        let detail = self.detail_json.and_then(|s| serde_json::from_str(&s).ok());

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

#[derive(sqlx::FromRow)]
struct DashboardUserRow {
    id: String,
    username: String,
    password_hash: String,
    salt: String,
    role: String,
    display_name: String,
    active: i32,
    created_at: i64,
    updated_at: i64,
    permissions_text: Option<String>,
}

impl DashboardUserRow {
    fn into_user(self) -> Result<timekeep_core::DashboardUser, Error> {
        let role = timekeep_core::Role::from_str(&self.role).unwrap_or(timekeep_core::Role::Viewer);
        let permissions = self
            .permissions_text
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(timekeep_core::PermissionSet::from_space_separated)
            .unwrap_or_else(timekeep_core::PermissionSet::empty);
        Ok(timekeep_core::DashboardUser {
            id: self.id,
            username: self.username,
            password_hash: self.password_hash,
            salt: self.salt,
            role,
            permissions,
            display_name: self.display_name,
            active: self.active != 0,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

// ─── New row types for device management (v9) ─────────────────────

#[derive(sqlx::FromRow)]
struct DeviceEventRow {
    id: String,
    device_sn: String,
    timestamp: i64,
    event_type: String,
    metadata_json: String,
}

impl DeviceEventRow {
    fn into_event(self) -> Result<timekeep_core::DeviceEvent, Error> {
        let ts = jiff::Timestamp::from_second(self.timestamp)
            .map_err(|e| Error::storage(format!("device event timestamp: {e}")))?;
        let metadata: std::collections::HashMap<String, String> =
            serde_json::from_str(&self.metadata_json).unwrap_or_default();
        let event_type = event_type_from_key(&self.event_type);
        Ok(timekeep_core::DeviceEvent {
            id: self.id,
            device_sn: self.device_sn,
            timestamp: ts,
            event_type,
            metadata,
        })
    }
}

fn event_type_from_key(key: &str) -> timekeep_core::DeviceEventType {
    match key {
        "came_online" => timekeep_core::DeviceEventType::CameOnline,
        "went_offline" => timekeep_core::DeviceEventType::WentOffline { reason: String::new() },
        "sync_started" => timekeep_core::DeviceEventType::SyncStarted,
        "sync_completed" => {
            timekeep_core::DeviceEventType::SyncCompleted { records_synced: 0, duration_ms: 0 }
        },
        "sync_failed" => {
            timekeep_core::DeviceEventType::SyncFailed { error: String::new(), records_synced: 0 }
        },
        "storage_warning" => timekeep_core::DeviceEventType::StorageWarning {
            records_used: 0,
            records_capacity: 0,
            percentage: 0.0,
        },
        "config_changed" => timekeep_core::DeviceEventType::ConfigChanged {
            field: String::new(),
            old_value: None,
            new_value: None,
        },
        "provisioning_started" => timekeep_core::DeviceEventType::ProvisioningStarted,
        "provisioning_completed" => timekeep_core::DeviceEventType::ProvisioningCompleted,
        "decommissioned" => timekeep_core::DeviceEventType::Decommissioned,
        "firmware_updated" => timekeep_core::DeviceEventType::FirmwareUpdated {
            old_version: String::new(),
            new_version: String::new(),
        },
        _ => timekeep_core::DeviceEventType::CameOnline, // fallback
    }
}

#[derive(sqlx::FromRow)]
struct DeviceInfoRow {
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
    fn into_device(self) -> timekeep_core::Device {
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

// ── EmployeeRepository implementation ──────────────────────────────────

#[async_trait]
impl timekeep_core::EmployeeRepository for SqliteStorage {
    async fn create_employee(&self, employee: &timekeep_core::Employee) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(employee.id.to_string())
        .bind(&employee.pin)
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.external_id)
        .bind(employee.active as i32)
        .bind(employee.created_at.as_second().to_string())
        .bind(employee.updated_at.as_second().to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create employee: {e}")))?;
        Ok(())
    }

    async fn find_employee(
        &self,
        id: &timekeep_core::EmployeeId,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, external_id, active, created_at, updated_at
             FROM employees WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    async fn find_employee_by_pin(
        &self,
        pin: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, external_id, active, created_at, updated_at
             FROM employees WHERE pin = ?",
        )
        .bind(pin)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee by pin: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    async fn find_employee_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<timekeep_core::Employee>, Error> {
        let row = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, external_id, active, created_at, updated_at
             FROM employees WHERE external_id = ?",
        )
        .bind(external_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find employee by external_id: {e}")))?;
        Ok(row.map(EmployeeRow::into_employee))
    }

    async fn list_employees(
        &self,
        params: &timekeep_core::ListParams,
    ) -> Result<timekeep_core::ListResult<timekeep_core::Employee>, Error> {
        let limit = params.clamped_limit() as i64;
        let offset: i64 = params.cursor.as_ref().and_then(|c| base64_decode_i64(c)).unwrap_or(0);

        let search = params.search.as_deref().unwrap_or("");
        let search_pattern = timekeep_core::sanitize_search(search);

        let rows = sqlx::query_as::<_, EmployeeRow>(
            "SELECT id, pin, name, department, external_id, active, created_at, updated_at
             FROM employees
             WHERE (pin LIKE ? OR name LIKE ?)
             ORDER BY name ASC
             LIMIT ? OFFSET ?",
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list employees: {e}")))?;

        let has_more = rows.len() >= params.clamped_limit() as usize;
        let next_cursor =
            if has_more { rows.last().map(|_| base64_encode_i64(offset + limit)) } else { None };

        Ok(timekeep_core::ListResult {
            items: rows.into_iter().map(EmployeeRow::into_employee).collect(),
            total: None,
            has_more,
            next_cursor,
        })
    }

    async fn update_employee(&self, employee: &timekeep_core::Employee) -> Result<(), Error> {
        let rows = sqlx::query(
            "UPDATE employees SET name = ?, department = ?, external_id = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&employee.name)
        .bind(&employee.department)
        .bind(&employee.external_id)
        .bind(employee.updated_at.as_second().to_string())
        .bind(employee.id.to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update employee: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("employee {}", employee.id)));
        }
        Ok(())
    }

    async fn deactivate_employee(&self, id: &timekeep_core::EmployeeId) -> Result<(), Error> {
        let rows = sqlx::query("UPDATE employees SET active = 0, updated_at = ? WHERE id = ?")
            .bind(jiff::Timestamp::now().as_second().to_string())
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("deactivate employee: {e}")))?;

        if rows.rows_affected() == 0 {
            return Err(Error::not_found(format!("employee {}", id)));
        }
        Ok(())
    }

    // ── Enrollments ────────────────────────────────────────────────

    async fn create_enrollment(
        &self,
        enrollment: &timekeep_core::DeviceEnrollment,
    ) -> Result<(), Error> {
        let biometric_json = serde_json::to_string(&enrollment.biometric_types)
            .map_err(|e| Error::validation(format!("serialize biometric types: {e}")))?;

        sqlx::query(
            "INSERT OR REPLACE INTO device_enrollments
             (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(enrollment.employee_id.to_string())
        .bind(&enrollment.device_sn)
        .bind(&enrollment.pin)
        .bind(&biometric_json)
        .bind(enrollment.fingerprint_count as i32)
        .bind(enrollment.face_enrolled as i32)
        .bind(&enrollment.card_number)
        .bind(enrollment.enrolled_at.as_second().to_string())
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("create enrollment: {e}")))?;
        Ok(())
    }

    async fn find_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<Option<timekeep_core::DeviceEnrollment>, Error> {
        let row = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE employee_id = ? AND device_sn = ?"
        )
        .bind(employee_id.to_string())
        .bind(device_sn)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("find enrollment: {e}")))?;
        Ok(row.and_then(|r| r.into_enrollment().ok()))
    }

    async fn list_enrollments_for_employee(
        &self,
        employee_id: &timekeep_core::EmployeeId,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        let rows = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE employee_id = ?"
        )
        .bind(employee_id.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list enrollments for employee: {e}")))?;

        rows.into_iter().map(|r| r.into_enrollment()).collect()
    }

    async fn list_enrollments_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Vec<timekeep_core::DeviceEnrollment>, Error> {
        let rows = sqlx::query_as::<_, EnrollmentRow>(
            "SELECT employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at
             FROM device_enrollments WHERE device_sn = ?"
        )
        .bind(device_sn)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list enrollments for device: {e}")))?;

        rows.into_iter().map(|r| r.into_enrollment()).collect()
    }

    async fn delete_enrollment(
        &self,
        employee_id: &timekeep_core::EmployeeId,
        device_sn: &str,
    ) -> Result<(), Error> {
        sqlx::query("DELETE FROM device_enrollments WHERE employee_id = ? AND device_sn = ?")
            .bind(employee_id.to_string())
            .bind(device_sn)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete enrollment: {e}")))?;
        Ok(())
    }
}

// ── Employee row types ────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct EmployeeRow {
    id: String,
    pin: String,
    name: String,
    department: Option<String>,
    external_id: Option<String>,
    active: i32,
    created_at: String,
    updated_at: String,
}

impl EmployeeRow {
    fn into_employee(self) -> timekeep_core::Employee {
        let created_at = self
            .created_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);
        let updated_at = self
            .updated_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);

        timekeep_core::Employee {
            id: timekeep_core::EmployeeId::from(self.id),
            pin: self.pin,
            name: self.name,
            department: self.department,
            external_id: self.external_id,
            active: self.active != 0,
            created_at,
            updated_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct EnrollmentRow {
    employee_id: String,
    device_sn: String,
    pin: String,
    biometric_types: String,
    fingerprint_count: i32,
    face_enrolled: i32,
    card_number: Option<String>,
    enrolled_at: String,
}

impl EnrollmentRow {
    fn into_enrollment(self) -> Result<timekeep_core::DeviceEnrollment, Error> {
        let biometric_types: Vec<timekeep_core::BiometricType> =
            serde_json::from_str(&self.biometric_types).unwrap_or_default();

        let enrolled_at = self
            .enrolled_at
            .parse::<i64>()
            .ok()
            .and_then(|t| jiff::Timestamp::from_second(t).ok())
            .unwrap_or_else(jiff::Timestamp::now);

        Ok(timekeep_core::DeviceEnrollment {
            employee_id: timekeep_core::EmployeeId::from(self.employee_id),
            device_sn: self.device_sn,
            pin: self.pin,
            biometric_types,
            fingerprint_count: self.fingerprint_count as u32,
            face_enrolled: self.face_enrolled != 0,
            card_number: self.card_number,
            enrolled_at,
        })
    }
}

/// Simple base64 encode an i64 for cursor pagination.
fn base64_encode_i64(value: i64) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(value.to_le_bytes())
}

/// Simple base64 decode for cursor pagination.
fn base64_decode_i64(encoded: &str) -> Option<i64> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(encoded).ok()?;
    if bytes.len() < 8 {
        return None;
    }
    let mut arr = [0u8; 8];
    arr.copy_from_slice(&bytes[..8]);
    Some(i64::from_le_bytes(arr))
}

/// Row type for facet queries (value, label, count).
#[derive(sqlx::FromRow)]
struct FacetRow {
    value: String,
    label: String,
    count: i64,
}

impl FacetRow {
    fn into_option(self) -> timekeep_core::FacetOption {
        timekeep_core::FacetOption {
            value: self.value,
            label: self.label,
            count: Some(self.count as u64),
        }
    }
}

#[derive(sqlx::FromRow)]
struct ProviderRow {
    key: String,
    display_name: String,
    default_port: i64,
    supports_adms: i64,
    supports_sdk: i64,
    capabilities_json: String,
    enabled: i64,
}

impl ProviderRow {
    fn into_provider_info(self) -> timekeep_core::ProviderInfo {
        let capabilities: timekeep_core::ProviderCapabilities =
            serde_json::from_str(&self.capabilities_json).unwrap_or_default();
        timekeep_core::ProviderInfo {
            key: self.key,
            display_name: self.display_name,
            default_port: self.default_port as u16,
            supports_adms: self.supports_adms != 0,
            supports_sdk: self.supports_sdk != 0,
            capabilities,
            enabled: self.enabled != 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use timekeep_core::model::{PunchStatus, VerifyMode};

    /// Open an in-memory SQLite database for testing.
    async fn test_storage() -> SqliteStorage {
        SqliteStorage::new(":memory:").await.expect("should create in-memory storage")
    }

    fn test_punch(pin: &str, device_sn: &str, ts_sec: i64, status: PunchStatus) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(ts_sec).unwrap();
        let mut punch = AttendancePunch {
            id: String::new(),
            device_sn: device_sn.to_string(),
            user_pin: pin.to_string(),
            timestamp: ts,
            status,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };
        punch.id = punch.generate_deduplication_id();
        punch
    }

    // ─── Single Punch Storage ───────────────────────────────────────

    #[tokio::test]
    async fn test_store_punch_inserts() {
        let storage = test_storage().await;
        let punch = test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("should store");

        let filter = PunchFilter::default();
        let results = storage.query_punches(&filter).await.expect("should query");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].user_pin, "145");
        assert_eq!(results[0].device_sn, "SN001");
        assert_eq!(results[0].status, PunchStatus::CheckIn);
    }

    #[tokio::test]
    async fn test_store_punch_idempotent() {
        let storage = test_storage().await;
        let punch = test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("first insert");
        storage.store_punch(&punch).await.expect("second insert (should be ignored)");

        let results = storage.query_punches(&PunchFilter::default()).await.expect("should query");
        assert_eq!(results.len(), 1, "duplicate should be IGNOREd");
    }

    #[tokio::test]
    async fn test_punch_exists_finds_stored() {
        let storage = test_storage().await;
        let punch = test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn);
        let dedup_id = punch.id.clone();

        storage.store_punch(&punch).await.expect("should store");

        assert!(storage.punch_exists(&dedup_id).await.expect("should check"));
    }

    #[tokio::test]
    async fn test_punch_exists_returns_false_for_missing() {
        let storage = test_storage().await;
        assert!(!storage.punch_exists("nonexistent-id").await.expect("should check"));
    }

    // ─── Batch Storage ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_store_punches_batch() {
        let storage = test_storage().await;
        let punches: Vec<_> = (0..10)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "SN001",
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
        let storage = test_storage().await;
        let punches: Vec<_> = (0..5)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "SN001",
                    1752129600 + i as i64,
                    PunchStatus::CheckIn,
                )
            })
            .collect();

        // Store twice — second batch should be all IGNOREd
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
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "SN002", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "SN001", 1752129602, PunchStatus::CheckOut))
            .await
            .unwrap();

        let filter = PunchFilter { device_sn: Some("SN001".into()), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.device_sn, "SN001");
        }
    }

    #[tokio::test]
    async fn test_query_filter_by_user_pin() {
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "SN001", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("145", "SN001", 1752129602, PunchStatus::CheckOut))
            .await
            .unwrap();

        let filter = PunchFilter { user_pin: Some("145".into()), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.user_pin, "145");
        }
    }

    #[tokio::test]
    async fn test_query_filter_by_time_range() {
        let storage = test_storage().await;
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    "145",
                    "SN001",
                    1752129600 + i as i64 * 60,
                    PunchStatus::CheckIn,
                ))
                .await
                .unwrap();
        }

        let since = jiff::Timestamp::from_second(1752129660).unwrap(); // punch at i=1
        let until = jiff::Timestamp::from_second(1752129840).unwrap(); // punch at i=4

        let filter = PunchFilter { since: Some(since), until: Some(until), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        // Punches at i=1,2,3,4 should match (timestamps 1752129660-1752129840)
        assert_eq!(results.len(), 4);
    }

    #[tokio::test]
    async fn test_query_order_desc() {
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "SN001", 1752129700, PunchStatus::CheckIn))
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
        let storage = test_storage().await;
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    &format!("{i}"),
                    "SN001",
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

    // ─── SQL Injection Resistance ───────────────────────────────────

    #[tokio::test]
    async fn test_query_rejects_sql_injection_in_device_sn() {
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();

        // Attempt SQL injection via device_sn filter
        let filter =
            PunchFilter { device_sn: Some("SN001' OR 1=1 --".into()), ..Default::default() };
        // Should return 0 results (no device with that exact string), NOT all records
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 0, "SQL injection via device_sn should be blocked");
    }

    #[tokio::test]
    async fn test_query_rejects_sql_injection_in_user_pin() {
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();

        // Attempt SQL injection via user_pin filter
        let filter = PunchFilter {
            user_pin: Some("145'; DROP TABLE attendance_punches; --".into()),
            ..Default::default()
        };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 0, "injection via user_pin should return no results");

        // Verify the table still exists and has data
        let all = storage.query_punches(&PunchFilter::default()).await.unwrap();
        assert_eq!(all.len(), 1, "table should still exist and have data");
    }

    // ─── Latest Punch ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_latest_punch_for_device() {
        let storage = test_storage().await;
        storage
            .store_punch(&test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "SN001", 1752129700, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "SN002", 1752129800, PunchStatus::CheckIn))
            .await
            .unwrap();

        let latest = storage
            .latest_punch_for_device("SN001")
            .await
            .expect("should query")
            .expect("should have a punch");
        assert_eq!(latest.as_second(), 1752129700);
    }

    #[tokio::test]
    async fn test_latest_punch_for_device_none() {
        let storage = test_storage().await;
        let result = storage.latest_punch_for_device("NONEXISTENT").await.unwrap();
        assert!(result.is_none());
    }

    // ─── Device CRUD ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_device() {
        let storage = test_storage().await;
        let mut device = timekeep_core::model::Device::new("SN001");
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
        let storage = test_storage().await;

        let config = timekeep_core::DeviceConfig {
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

        // Delete
        storage.delete_device_config("SN001").await.expect("should delete");
        assert!(storage.list_device_configs().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_delete_device_config_nonexistent_is_noop() {
        let storage = test_storage().await;
        storage.delete_device_config("NONEXISTENT").await.expect("should not error");
    }

    #[tokio::test]
    async fn test_multiple_device_configs() {
        let storage = test_storage().await;

        for i in 1..=3 {
            storage
                .upsert_device_config(&timekeep_core::DeviceConfig {
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

    // ─── User Sync ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_user_inserts() {
        let storage = test_storage().await;

        storage
            .upsert_user("SN001", "145", "Ahmed Al-Farsi", Some(0))
            .await
            .expect("should upsert user");

        let name = storage.get_user_name("145").await.expect("should query");
        assert_eq!(name.as_deref(), Some("Ahmed Al-Farsi"));
    }

    #[tokio::test]
    async fn test_get_user_name_not_found() {
        let storage = test_storage().await;

        let name = storage.get_user_name("nonexistent-pin").await.expect("should query");
        assert!(name.is_none());
    }

    // ─── Migration Versioning ───────────────────────────────────────

    #[tokio::test]
    async fn test_migrations_idempotent() {
        let storage = test_storage().await;

        // Run migrations a second time — should be a no-op
        storage.run_migrations().await.expect("second run should succeed");

        // Verify tables still exist by inserting a punch
        let punch = test_punch("145", "SN001", 1752129600, PunchStatus::CheckIn);
        storage.store_punch(&punch).await.expect("should still work");
    }

    // ─── Device Events (activity timeline) ───────────────────────────

    #[tokio::test]
    async fn test_record_and_query_device_events() {
        let storage = test_storage().await;
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
        let storage = test_storage().await;
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
        let storage = test_storage().await;
        let filter = timekeep_core::DeviceEventFilter {
            device_sn: Some("NONEXISTENT".into()),
            ..Default::default()
        };
        let result = storage.query_device_events(&filter).await.unwrap();
        assert!(result.items.is_empty());
    }

    // ─── Device Info (enriched metadata) ──────────────────────────────

    #[tokio::test]
    async fn test_upsert_and_get_device_info() {
        let storage = test_storage().await;
        let mut device = timekeep_core::Device::new("SN001");
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
        let storage = test_storage().await;
        let result = storage.get_device_info("NONEXISTENT").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_upsert_device_info_updates_existing() {
        let storage = test_storage().await;

        let mut device = timekeep_core::Device::new("SN003");
        device.user_count = 100;
        storage.upsert_device_info(&device).await.unwrap();

        // Update with different count
        let mut device2 = timekeep_core::Device::new("SN003");
        device2.user_count = 200;
        storage.upsert_device_info(&device2).await.unwrap();

        let retrieved = storage.get_device_info("SN003").await.unwrap().unwrap();
        assert_eq!(retrieved.user_count, 200, "should be updated");
    }

    // ─── Providers ────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_register_and_list_providers() {
        let storage = test_storage().await;

        let provider = timekeep_core::ProviderInfo {
            key: "zkteco".into(),
            display_name: "ZKTeco".into(),
            default_port: 4370,
            supports_adms: true,
            supports_sdk: true,
            capabilities: timekeep_core::ProviderCapabilities {
                attendance_read: true,
                user_read: true,
                ..Default::default()
            },
            enabled: true,
        };

        storage.register_provider(&provider).await.expect("register");

        let providers = storage.list_providers().await.expect("list");
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].key, "zkteco");
        assert_eq!(providers[0].display_name, "ZKTeco");
        assert_eq!(providers[0].default_port, 4370);
        assert!(providers[0].enabled);
        assert!(providers[0].capabilities.attendance_read);
    }
}
