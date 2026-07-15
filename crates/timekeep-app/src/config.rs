//! Application configuration from environment variables.
//!
//! All configuration is read once at startup via `load()`.
//! The returned `AppConfig` is immutable and shared by reference
//! to every subsystem that needs it.

/// Canonical application configuration, loaded from environment variables.
///
/// Every field has a sensible default so the application can start
/// in development without any env vars set.
pub(crate) struct AppConfig {
    pub db_backend: String,
    pub db_url: String,
    pub db_path: String,
    pub search_index_path: Option<String>,
    pub jwt_secret: String,
    pub admin_user: String,
    pub admin_password: String,
    pub management_port: u16,
    pub integration_port: u16,
    pub adms_port: u16,
}

/// Read all environment variables and return a validated `AppConfig`.
///
/// Calls `validate_config` internally so callers don't need to
/// remember to validate separately.
pub(crate) fn load() -> AppConfig {
    // Determine the default search index path alongside the DB
    let db_path = std::env::var("TIMEKEEP_DB_PATH").unwrap_or_else(|_| "timekeep.db".to_string());
    let default_search_path = std::path::Path::new(&db_path)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("search")
        .to_string_lossy()
        .to_string();

    let config = AppConfig {
        db_backend: std::env::var("TIMEKEEP_DB_BACKEND").unwrap_or_else(|_| "sqlite".to_string()),
        db_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://timekeep:password@localhost:5432/timekeep".to_string()),
        db_path,
        search_index_path: std::env::var("TIMEKEEP_SEARCH_INDEX_PATH")
            .ok()
            .or(Some(default_search_path)),
        jwt_secret: std::env::var("TIMEKEEP_JWT_SECRET").unwrap_or_default(),
        admin_user: std::env::var("TIMEKEEP_ADMIN_USER").unwrap_or_default(),
        admin_password: std::env::var("TIMEKEEP_ADMIN_PASSWORD").unwrap_or_default(),
        management_port: std::env::var("TIMEKEEP_API_PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .unwrap_or(3000),
        integration_port: std::env::var("TIMEKEEP_INTEGRATION_PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse()
            .unwrap_or(3001),
        adms_port: std::env::var("TIMEKEEP_ADMS_PORT")
            .unwrap_or_else(|_| "8085".to_string())
            .parse()
            .unwrap_or(8085),
    };
    validate_config(&config);
    config
}

/// Validate critical environment configuration at startup.
///
/// Logs warnings for insecure defaults or missing credentials
/// so operators can catch misconfiguration before it reaches
/// production.
pub(crate) fn validate_config(config: &AppConfig) {
    // ── JWT secret ──────────────────────────────────────────────
    if config.jwt_secret.is_empty() || config.jwt_secret == "change-me-in-production" {
        tracing::warn!("TIMEKEEP_JWT_SECRET is not set or using default — auth is insecure!");
    }

    // ── Admin credentials ───────────────────────────────────────
    if config.admin_user.is_empty() || config.admin_password.is_empty() {
        tracing::warn!("Admin credentials not configured — login will not work");
    }

    // ── Database backend ────────────────────────────────────────
    match config.db_backend.as_str() {
        "sqlite" => {
            tracing::info!(path = %config.db_path, backend = "sqlite", "storage configuration valid");
        },
        "postgres" => {
            if config.db_url.is_empty() {
                tracing::warn!("DATABASE_URL not set but TIMEKEEP_DB_BACKEND=postgres");
            }
            tracing::info!(backend = "postgres", "storage configuration valid");
        },
        other => {
            tracing::warn!(%other, "unknown TIMEKEEP_DB_BACKEND — falling back to sqlite");
        },
    }
}
