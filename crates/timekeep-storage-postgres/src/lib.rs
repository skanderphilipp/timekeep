//! # timekeep-storage-postgres
//!
//! PostgreSQL storage backend. Recommended for multi-scanner deployments
//! and when integrating with Odoo (which also uses PostgreSQL).
//!
//! ```toml
//! [storage.postgres]
//! url = "postgres://timekeep:password@localhost:5432/timekeep"
//! ```

use async_trait::async_trait;
use sqlx::postgres::{PgPool, PgPoolOptions};
use timekeep_core::{
    Error, FacetGroup, FacetKind, FacetOption, FacetQuery,
    model::{AttendancePunch, Device},
    traits::storage::{PunchFilter, Storage},
};

/// PostgreSQL-backed attendance storage.
pub struct PostgresStorage {
    pool: PgPool,
}

impl PostgresStorage {
    /// Create a new PostgreSQL storage backend.
    pub async fn new(database_url: &str) -> Result<Self, Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .map_err(|e| Error::storage(format!("failed to connect to PostgreSQL: {e}")))?;

        let storage = Self { pool };
        storage.run_migrations().await?;

        Ok(storage)
    }

    async fn run_migrations(&self) -> Result<(), Error> {
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

        Ok(())
    }

    // ── Facet helpers ─────────────────────────────────────────────

    fn pg_push_context_clauses<'a>(
        &self,
        builder: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
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

    async fn pg_facet_devices(
        &self,
        query: &timekeep_core::FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT d.serial_number as value, COALESCE(d.label, d.serial_number) as label, CAST(COUNT(*) AS BIGINT) as count FROM attendance_punches p LEFT JOIN devices d ON d.serial_number = p.device_sn WHERE 1=1",
        );
        self.pg_push_context_clauses(&mut builder, &query.context);
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

    async fn pg_facet_statuses(
        &self,
        query: &timekeep_core::FacetQuery,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        use timekeep_core::facet::STATUS_VALUES;
        let mut options = Vec::with_capacity(STATUS_VALUES.len());
        for (value, label) in STATUS_VALUES {
            let code = timekeep_core::facet::status_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM attendance_punches p WHERE 1=1 AND p.status = ",
            );
            builder.push_bind(code);
            self.pg_push_context_clauses(&mut builder, &query.context);
            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet status: {e}")))?;
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|b| std::cmp::Reverse(b.count.unwrap_or(0)));
        Ok(FacetGroup {
            key: "status".into(),
            label: "Status".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    async fn pg_facet_verify_modes(
        &self,
        query: &timekeep_core::FacetQuery,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        use timekeep_core::facet::VERIFY_MODE_VALUES;
        let mut options = Vec::with_capacity(VERIFY_MODE_VALUES.len());
        for (value, label) in VERIFY_MODE_VALUES {
            let code = timekeep_core::facet::verify_mode_code(value).unwrap();
            let mut builder = QueryBuilder::<sqlx::Postgres>::new(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM attendance_punches p WHERE 1=1 AND p.verify_mode = ",
            );
            builder.push_bind(code);
            self.pg_push_context_clauses(&mut builder, &query.context);
            let count: i64 = builder
                .build_query_scalar()
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("facet verify_mode: {e}")))?;
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count as u64),
            });
        }
        options.sort_by_key(|b| std::cmp::Reverse(b.count.unwrap_or(0)));
        Ok(FacetGroup {
            key: "verify_mode".into(),
            label: "Method".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        })
    }

    async fn pg_facet_employees(
        &self,
        query: &timekeep_core::FacetQuery,
        limit: i64,
    ) -> Result<FacetGroup, Error> {
        use sqlx::QueryBuilder;
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT p.user_pin as value, COALESCE(e.name, u.name, p.user_pin) as label, CAST(COUNT(*) AS BIGINT) as count FROM attendance_punches p LEFT JOIN employees e ON e.pin = p.user_pin LEFT JOIN users u ON u.pin = p.user_pin WHERE 1=1",
        );
        if let Some(ref search) = query.search
            && !search.is_empty()
        {
            let pattern = timekeep_core::sanitize_search(search);
            builder
                .push(" AND (e.name LIKE ")
                .push_bind(pattern.clone())
                .push(" ESCAPE '\\' OR u.name LIKE ")
                .push_bind(pattern.clone())
                .push(" ESCAPE '\\' OR p.user_pin LIKE ")
                .push_bind(pattern)
                .push(" ESCAPE '\\')");
        }
        self.pg_push_context_clauses(&mut builder, &query.context);
        builder
            .push(" GROUP BY p.user_pin, e.name, u.name ORDER BY count DESC LIMIT ")
            .push_bind(limit);
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

#[async_trait]
impl Storage for PostgresStorage {
    async fn store_punch(&self, punch: &AttendancePunch) -> Result<(), Error> {
        let dedup_id = punch.generate_deduplication_id();
        let ts = punch.timestamp.as_second().to_string();

        sqlx::query(
            "INSERT INTO attendance_punches
             (id, device_sn, user_pin, timestamp, status, verify_mode, work_code, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(&dedup_id)
        .bind(&punch.device_sn)
        .bind(&punch.user_pin)
        .bind(&ts)
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
        if punches.is_empty() {
            return Ok(0);
        }

        let mut tx =
            self.pool.begin().await.map_err(|e| Error::storage(format!("begin tx: {e}")))?;

        let mut count = 0u64;
        for punch in punches {
            let dedup_id = punch.generate_deduplication_id();
            let ts = punch.timestamp.as_second().to_string();
            let result = sqlx::query(
                "INSERT INTO attendance_punches
                 (id, device_sn, user_pin, timestamp, status, verify_mode, work_code, raw_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING",
            )
            .bind(&dedup_id)
            .bind(&punch.device_sn)
            .bind(&punch.user_pin)
            .bind(&ts)
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

        let mut builder = QueryBuilder::<sqlx::Postgres>::new(
            "SELECT p.id, p.device_sn, p.user_pin, p.timestamp, p.status, p.verify_mode, p.work_code, p.raw_data,
                    COALESCE(e.name, u.name) as employee_name,
                    d.label as device_label
             FROM attendance_punches p
             LEFT JOIN users u ON u.pin = p.user_pin
             LEFT JOIN employees e ON e.pin = p.user_pin
             LEFT JOIN devices d ON d.serial_number = p.device_sn
             WHERE 1=1",
        );

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
            vec![&dim[..]]
        } else {
            vec!["device_sn", "status", "verify_mode", "employee"]
        };

        let mut groups = Vec::with_capacity(dimensions.len());
        for dim_key in dimensions {
            let group = match dim_key {
                "device_sn" => self.pg_facet_devices(query, limit).await?,
                "status" => self.pg_facet_statuses(query).await?,
                "verify_mode" => self.pg_facet_verify_modes(query).await?,
                "employee" => self.pg_facet_employees(query, limit).await?,
                _ => unreachable!(),
            };
            groups.push(group);
        }
        Ok(groups)
    }

    async fn upsert_device(&self, device: &Device) -> Result<(), Error> {
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

    async fn latest_punch_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Option<jiff::Timestamp>, Error> {
        let result = sqlx::query_as::<_, TimestampRow>(
            "SELECT timestamp FROM attendance_punches
             WHERE device_sn = $1 ORDER BY timestamp DESC LIMIT 1",
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
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM attendance_punches WHERE id = $1")
                .bind(dedup_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("punch exists check: {e}")))?;

        Ok(exists > 0)
    }

    async fn upsert_device_config(
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

    async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
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

    async fn delete_device_config(&self, serial_number: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM devices WHERE serial_number = $1")
            .bind(serial_number)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete device config: {e}")))?;

        Ok(())
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
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT(pin, device_sn) DO UPDATE SET
                name = EXCLUDED.name,
                privilege = EXCLUDED.privilege,
                synced_at = NOW()",
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
            sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE pin = $1 LIMIT 1")
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

        sqlx::query(
            "INSERT INTO api_keys (id, name, key_hash, prefix, permissions, created_by, created_at, last_used_at, expires_at, revoked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(&key.id)
        .bind(&key.name)
        .bind(&key.key_hash)
        .bind(&key.prefix)
        .bind(&perms_json)
        .bind(&key.created_by)
        .bind(key.created_at.as_second())
        .bind(key.last_used_at.map(|t| t.as_second()))
        .bind(key.expires_at.map(|t| t.as_second()))
        .bind(key.revoked)
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
             FROM api_keys WHERE key_hash = $1 AND revoked = FALSE",
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
        let affected = sqlx::query("UPDATE api_keys SET revoked = TRUE WHERE id = $1")
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
        let now = jiff::Timestamp::now().as_second();
        sqlx::query("UPDATE api_keys SET last_used_at = $1 WHERE id = $2")
            .bind(now)
            .bind(key_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("touch api key: {e}")))?;
        Ok(())
    }

    // ── Device Events (activity timeline) ─────────────────────────────

    async fn record_device_event(&self, event: &timekeep_core::DeviceEvent) -> Result<(), Error> {
        let metadata = serde_json::to_value(&event.metadata).unwrap_or_default();
        let ts = event.timestamp.as_second();

        sqlx::query(
            "INSERT INTO device_events (id, device_sn, timestamp, event_type, metadata_json)
             VALUES ($1, $2, $3, $4, $5)",
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

    // ── Device Info ────────────────────────────────────────────────────

    async fn upsert_device_info(&self, device: &timekeep_core::Device) -> Result<(), Error> {
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

    async fn get_device_info(
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

    // ── Provider Registry ─────────────────────────────────────────────

    async fn register_provider(&self, provider: &timekeep_core::ProviderInfo) -> Result<(), Error> {
        let caps = serde_json::to_value(&provider.capabilities).unwrap_or_default();

        sqlx::query(
            "INSERT INTO providers (key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(key) DO UPDATE SET
                display_name=EXCLUDED.display_name,
                default_port=EXCLUDED.default_port,
                supports_adms=EXCLUDED.supports_adms,
                supports_sdk=EXCLUDED.supports_sdk,
                capabilities_json=EXCLUDED.capabilities_json,
                enabled=EXCLUDED.enabled",
        )
        .bind(&provider.key)
        .bind(&provider.display_name)
        .bind(provider.default_port as i32)
        .bind(provider.supports_adms)
        .bind(provider.supports_sdk)
        .bind(&caps)
        .bind(provider.enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("register provider: {e}")))?;

        Ok(())
    }

    async fn list_providers(&self) -> Result<Vec<timekeep_core::ProviderInfo>, Error> {
        let rows = sqlx::query_as::<_, ProviderRowPg>(
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
struct DeviceInfoRowPg {
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

#[derive(sqlx::FromRow)]
struct ProviderRowPg {
    key: String,
    display_name: String,
    default_port: i32,
    supports_adms: bool,
    supports_sdk: bool,
    capabilities_json: serde_json::Value,
    enabled: bool,
}

impl ProviderRowPg {
    fn into_provider_info(self) -> timekeep_core::ProviderInfo {
        let capabilities: timekeep_core::ProviderCapabilities =
            serde_json::from_value(self.capabilities_json).unwrap_or_default();
        timekeep_core::ProviderInfo {
            key: self.key,
            display_name: self.display_name,
            default_port: self.default_port as u16,
            supports_adms: self.supports_adms,
            supports_sdk: self.supports_sdk,
            capabilities,
            enabled: self.enabled,
        }
    }
}

#[derive(sqlx::FromRow)]
struct DeviceEventRowPg {
    id: String,
    device_sn: String,
    timestamp: i64,
    event_type: String,
    metadata_json: serde_json::Value,
}

impl DeviceEventRowPg {
    fn into_event(self) -> timekeep_core::DeviceEvent {
        use timekeep_core::DeviceEventType;
        let ts =
            jiff::Timestamp::from_second(self.timestamp).unwrap_or(jiff::Timestamp::UNIX_EPOCH);
        let metadata: std::collections::HashMap<String, String> =
            serde_json::from_value(self.metadata_json).unwrap_or_default();
        let event_type = match self.event_type.as_str() {
            "came_online" => DeviceEventType::CameOnline,
            "went_offline" => DeviceEventType::WentOffline { reason: String::new() },
            "sync_started" => DeviceEventType::SyncStarted,
            "sync_completed" => {
                DeviceEventType::SyncCompleted { records_synced: 0, duration_ms: 0 }
            },
            "sync_failed" => {
                DeviceEventType::SyncFailed { error: String::new(), records_synced: 0 }
            },
            "storage_warning" => DeviceEventType::StorageWarning {
                records_used: 0,
                records_capacity: 0,
                percentage: 0.0,
            },
            "config_changed" => DeviceEventType::ConfigChanged {
                field: String::new(),
                old_value: None,
                new_value: None,
            },
            "provisioning_started" => DeviceEventType::ProvisioningStarted,
            "provisioning_completed" => DeviceEventType::ProvisioningCompleted,
            "decommissioned" => DeviceEventType::Decommissioned,
            "firmware_updated" => DeviceEventType::FirmwareUpdated {
                old_version: String::new(),
                new_version: String::new(),
            },
            _ => DeviceEventType::CameOnline,
        };
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
    port: i32,
    comm_key: i64,
    push_enabled: i32,
    timezone: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ApiKeyRow {
    id: String,
    name: String,
    key_hash: String,
    prefix: String,
    permissions: String,
    created_by: String,
    created_at: i64,
    last_used_at: Option<i64>,
    expires_at: Option<i64>,
    revoked: bool,
}

impl ApiKeyRow {
    fn into_api_key(self) -> Result<timekeep_core::ApiKey, Error> {
        let created_at = jiff::Timestamp::from_second(self.created_at)
            .map_err(|e| Error::storage(format!("parse created_at: {e}")))?;
        let last_used_at = self
            .last_used_at
            .map(|ts| {
                jiff::Timestamp::from_second(ts)
                    .map_err(|e| Error::storage(format!("timestamp: {e}")))
            })
            .transpose()?;
        let expires_at = self
            .expires_at
            .map(|ts| {
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
            revoked: self.revoked,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use timekeep_core::model::{PunchStatus, VerifyMode};

    async fn test_storage() -> Option<PostgresStorage> {
        let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://timekeep:password@localhost:5432/timekeep_test".to_string()
        });
        PostgresStorage::new(&url).await.ok()
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
        let Some(storage) = test_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("should store");

        let filter = PunchFilter::default();
        let results = storage.query_punches(&filter).await.expect("should query");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].user_pin, "145");
        assert_eq!(results[0].device_sn, "DEV001");
        assert_eq!(results[0].status, PunchStatus::CheckIn);
    }

    #[tokio::test]
    async fn test_store_punch_idempotent() {
        let Some(storage) = test_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);

        storage.store_punch(&punch).await.expect("first insert");
        storage.store_punch(&punch).await.expect("second insert (should be ignored)");

        let results = storage.query_punches(&PunchFilter::default()).await.expect("should query");
        assert_eq!(results.len(), 1, "duplicate should be IGNOREd");
    }

    #[tokio::test]
    async fn test_punch_exists_finds_stored() {
        let Some(storage) = test_storage().await else {
            return;
        };
        let punch = test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn);
        let dedup_id = punch.id.clone();

        storage.store_punch(&punch).await.expect("should store");

        assert!(storage.punch_exists(&dedup_id).await.expect("should check"));
    }

    #[tokio::test]
    async fn test_punch_exists_returns_false_for_missing() {
        let Some(storage) = test_storage().await else {
            return;
        };
        assert!(!storage.punch_exists("nonexistent-id").await.expect("should check"));
    }

    // ─── Batch Storage ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_store_punches_batch() {
        let Some(storage) = test_storage().await else {
            return;
        };
        let punches: Vec<_> = (0..10)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "DEV001",
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
        let Some(storage) = test_storage().await else {
            return;
        };
        let punches: Vec<_> = (0..5)
            .map(|i| {
                test_punch(
                    &format!("EMP{i:03}"),
                    "DEV001",
                    1752129600 + i as i64,
                    PunchStatus::CheckIn,
                )
            })
            .collect();

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
        let Some(storage) = test_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV002", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "DEV001", 1752129602, PunchStatus::CheckOut))
            .await
            .unwrap();

        let filter = PunchFilter { device_sn: Some("DEV001".into()), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.device_sn, "DEV001");
        }
    }

    #[tokio::test]
    async fn test_query_filter_by_user_pin() {
        let Some(storage) = test_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129601, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129602, PunchStatus::CheckOut))
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
        let Some(storage) = test_storage().await else {
            return;
        };
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    "145",
                    "DEV001",
                    1752129600 + i as i64 * 60,
                    PunchStatus::CheckIn,
                ))
                .await
                .unwrap();
        }

        let since = jiff::Timestamp::from_second(1752129660).unwrap();
        let until = jiff::Timestamp::from_second(1752129840).unwrap();

        let filter = PunchFilter { since: Some(since), until: Some(until), ..Default::default() };
        let results = storage.query_punches(&filter).await.unwrap();
        assert_eq!(results.len(), 4);
    }

    #[tokio::test]
    async fn test_query_order_desc() {
        let Some(storage) = test_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129700, PunchStatus::CheckIn))
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
        let Some(storage) = test_storage().await else {
            return;
        };
        for i in 0..10 {
            storage
                .store_punch(&test_punch(
                    &format!("{i}"),
                    "DEV001",
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

    // ─── Latest Punch ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_latest_punch_for_device() {
        let Some(storage) = test_storage().await else {
            return;
        };
        storage
            .store_punch(&test_punch("145", "DEV001", 1752129600, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("146", "DEV001", 1752129700, PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&test_punch("147", "DEV002", 1752129800, PunchStatus::CheckIn))
            .await
            .unwrap();

        let latest = storage
            .latest_punch_for_device("DEV001")
            .await
            .expect("should query")
            .expect("should have a punch");
        assert_eq!(latest.as_second(), 1752129700);
    }

    #[tokio::test]
    async fn test_latest_punch_for_device_none() {
        let Some(storage) = test_storage().await else {
            return;
        };
        let result = storage.latest_punch_for_device("NONEXISTENT").await.unwrap();
        assert!(result.is_none());
    }

    // ─── Device CRUD ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_device() {
        let Some(storage) = test_storage().await else {
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
        let Some(storage) = test_storage().await else {
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
        let Some(storage) = test_storage().await else {
            return;
        };
        storage.delete_device_config("NONEXISTENT").await.expect("should not error");
    }

    #[tokio::test]
    async fn test_multiple_device_configs() {
        let Some(storage) = test_storage().await else {
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

    // ─── User Sync ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_upsert_user() {
        let Some(storage) = test_storage().await else {
            return;
        };

        storage
            .upsert_user("DEV001", "145", "Ahmed Al-Farsi", Some(0))
            .await
            .expect("should upsert user");

        let name = storage.get_user_name("145").await.expect("should query");
        assert_eq!(name.as_deref(), Some("Ahmed Al-Farsi"));
    }

    #[tokio::test]
    async fn test_get_user_name_not_found() {
        let Some(storage) = test_storage().await else {
            return;
        };

        let name = storage.get_user_name("nonexistent-pin").await.expect("should query");
        assert!(name.is_none());
    }
}
