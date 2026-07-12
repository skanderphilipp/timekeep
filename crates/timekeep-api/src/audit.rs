//! Audit middleware — captures every authenticated API request
//! and records it to the audit log.
//!
//! Runs after JWT auth (so `UserContext` is available) but before
//! the handler. Captures: actor, action, resource, status, IP.
//!
//! ## Action mapping
//!
//! Actions are derived from HTTP method + path:
//! - `POST /api/devices` → `device.created`
//! - `PUT /api/devices/{sn}` → `device.updated`
//! - `DELETE /api/devices/{sn}` → `device.deleted`
//! - `POST /api/punches/correct` → `punch.corrected`
//! - `PUT /api/settings` → `settings.updated`
//! - `POST /api/auth/login` → `auth.login` (or `auth.login_failed`)
//!
//! Requests to `/api/audit`, `/api/health`, and `/api/metrics` are excluded.

use axum::http::StatusCode;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::AppState;
use crate::auth::UserContext;

/// Route → action mapping table.
/// Sorted by specificity — more specific patterns first.
const ACTION_MAP: &[(&str, &[(&str, &str)])] = &[
    ("auth/login", &[("POST", "auth.login")]),
    ("punches/correct", &[("POST", "punch.corrected")]),
    ("exports/punches", &[("GET", "export.downloaded")]),
    ("settings", &[("PUT", "settings.updated")]),
    (
        "employees",
        &[
            ("POST", "employee.created"),
            ("PUT", "employee.updated"),
            ("DELETE", "employee.deactivated"),
        ],
    ),
    ("enrollments", &[("POST", "enrollment.created")]),
    ("users", &[("POST", "user.created"), ("PUT", "user.updated"), ("DELETE", "user.deleted")]),
    (
        "endpoints",
        &[
            ("POST", "endpoint.created"),
            ("PUT", "endpoint.updated"),
            ("DELETE", "endpoint.deleted"),
        ],
    ),
    ("api-keys", &[("POST", "apikey.created"), ("DELETE", "apikey.revoked")]),
    (
        "devices",
        &[("POST", "device.created"), ("PUT", "device.updated"), ("DELETE", "device.deleted")],
    ),
];

/// Paths excluded from audit logging.
const EXCLUDED_PREFIXES: &[&str] = &["/api/audit", "/api/health", "/api/metrics", "/api/docs"];

/// Derive an action string from HTTP method + path.
fn derive_action(method: &str, path: &str) -> Option<String> {
    let path = path.trim_start_matches("/api/");

    for (prefix, methods) in ACTION_MAP {
        if path.starts_with(prefix) {
            for (m, action) in *methods {
                if method.eq_ignore_ascii_case(m) {
                    return Some(action.to_string());
                }
            }
        }
    }

    // Default for write operations we don't have specific mappings for
    match method {
        "POST" | "PUT" | "PATCH" | "DELETE" => Some(format!("api.{}", method.to_lowercase())),
        _ => None, // GET requests are not audited by default
    }
}

/// Extract client IP from request headers.
fn client_ip(request: &Request) -> Option<String> {
    // Check common proxy headers first
    for header in ["X-Forwarded-For", "X-Real-IP"] {
        if let Some(val) = request.headers().get(header)
            && let Ok(s) = val.to_str()
        {
            return Some(s.split(',').next().unwrap_or("").trim().to_string());
        }
    }
    // Fall back to socket address
    request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|addr| addr.0.ip().to_string())
}

/// Middleware: records every authenticated write operation to the audit log.
pub async fn audit_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();

    // Skip excluded paths
    if EXCLUDED_PREFIXES.iter().any(|p| path.starts_with(p)) {
        return Ok(next.run(request).await);
    }

    // Only audit write operations + login
    let action = match derive_action(&method, &path) {
        Some(a) => a,
        None => return Ok(next.run(request).await),
    };

    let ip = client_ip(&request);
    let user = request.extensions().get::<UserContext>().cloned();
    let actor = user.map(|u| u.username).unwrap_or_else(|| "anonymous".into());
    let resource = path.clone();

    // Run the handler
    let response = next.run(request).await;

    // Determine status
    let status = if response.status().is_success() || response.status().is_redirection() {
        "success"
    } else {
        "error"
    };

    // Fire-and-forget the audit record — don't block the response
    let storage = state.storage.clone();
    let error_msg =
        if status == "error" { Some(format!("HTTP {}", response.status().as_u16())) } else { None };

    tokio::spawn(async move {
        let mut event = timekeep_core::AuditEvent::new(actor, action, resource, status.into())
            .with_ip(ip.unwrap_or_default());

        if let Some(msg) = error_msg {
            event = event.with_error(msg);
        }

        if let Err(e) = storage.record_audit(&event).await {
            tracing::warn!(error = %e, "failed to record audit event");
        }
    });

    Ok(response)
}
