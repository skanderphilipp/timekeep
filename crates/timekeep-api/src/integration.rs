//! Integration API — auth middleware, Odoo webhook receiver, sync status.
//!
//! ## Bounded Context: Integration Auth
//!
//! The integration API (port 3001) is designed for machine-to-machine
//! communication — Odoo, Zapier, SAP, custom ERPs. It uses API keys
//! instead of JWT tokens.
//!
//! ## Auth flow
//!
//! ```text
//! Client → X-API-Key: ak_prod_abc123... → require_api_key
//!                                            │
//!                                            ├─ 1. SHA-256 hash the key
//!                                            ├─ 2. Look up in api_keys table
//!                                            ├─ 3. Check is_active (not revoked, not expired)
//!                                            ├─ 4. Verify permission: READ_PUNCHES required
//!                                            ├─ 5. Touch last_used_at
//!                                            └─ 6. Attach ApiKey Extension → handler
//! ```

use std::sync::Arc;

use axum::{
    Json,
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use timekeep_core::events::{DomainEvent, EventBus};
use timekeep_core::model::Employee;
use timekeep_core::traits::EmployeeStore;
use timekeep_core::{ApiKey, PermissionSet};
use utoipa::ToSchema;

use crate::AppState;
use crate::response::ApiEnvelope;

// ─── Auth Middleware ──────────────────────────────────────────────────

/// Integration auth middleware: validates X-API-Key header against stored API keys.
///
/// Attaches [`ApiKey`] to the request via [`axum::Extension`] so handlers
/// can access the key's metadata (name, permissions, created_by, etc.).
pub async fn require_api_key(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let key = headers.get("X-API-Key").and_then(|v| v.to_str().ok()).unwrap_or("");

    if key.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let key_hash = ApiKey::hash_key(key);
    let api_key = match state.storage.find_api_key_by_hash(&key_hash).await {
        Ok(Some(k)) => k,
        Ok(None) => {
            tracing::warn!("API key not found in storage");
            return Err(StatusCode::UNAUTHORIZED);
        },
        Err(e) => {
            tracing::error!(error = %e, "failed to look up API key in storage");
            return Err(StatusCode::UNAUTHORIZED);
        },
    };

    if !api_key.is_active() {
        tracing::warn!(key_id = %api_key.id, prefix = %api_key.prefix, "API key rejected: inactive");
        return Err(StatusCode::UNAUTHORIZED);
    }

    if !api_key.has_permission(PermissionSet::READ_PUNCHES) {
        tracing::warn!(
            key_id = %api_key.id,
            prefix = %api_key.prefix,
            permissions = %api_key.permissions.to_space_separated(),
            "API key rejected: insufficient permissions"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Touch last_used_at (fire-and-forget)
    let storage = Arc::clone(&state.storage);
    let key_id = api_key.id.clone();
    tokio::spawn(async move {
        if let Err(e) = storage.touch_api_key(&key_id).await {
            tracing::warn!(key_id = %key_id, error = %e, "failed to touch API key last_used_at");
        }
    });

    request.extensions_mut().insert(api_key);
    Ok(next.run(request).await)
}

// ─── Response Types (integration-specific) ───────────────────────────

/// Lightweight status response for write/sync/trigger endpoints.
#[derive(Debug, Serialize, ToSchema)]
pub struct StatusResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected: Option<u32>,
}

impl StatusResponse {
    fn created() -> Self {
        Self { status: "created".into(), affected: None }
    }
    fn updated() -> Self {
        Self { status: "updated".into(), affected: None }
    }
    fn requested() -> Self {
        Self { status: "requested".into(), affected: None }
    }
}

/// Read-only snapshot of the Odoo ↔ Timekeep sync pipeline health.
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncStatusResponse {
    pub last_sync_at: Option<i64>,
    pub total_employees: u64,
    pub synced_employees: u32,
    pub created: u32,
    pub updated: u32,
    pub skipped: u32,
    pub departments_created: u32,
    pub departments_updated: u32,
    pub health: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_sync_at: Option<i64>,
}

// ─── Webhook Request Types ───────────────────────────────────────────

/// Payload sent by the Odoo alsabah_hr_attendance module webhook.
#[derive(Debug, Deserialize)]
pub struct OdooEmployeeEvent {
    pub event: String,
    #[serde(default)]
    pub employees: Vec<OdooEmployeeData>,
    #[serde(default)]
    pub employee_ids: Vec<i64>,
}

/// Individual employee data from the Odoo webhook payload.
#[derive(Debug, Deserialize)]
pub struct OdooEmployeeData {
    pub odoo_id: i64,
    pub name: String,
    #[serde(default)]
    pub device_id_num: String,
    #[serde(default)]
    pub department: String,
    #[serde(default = "default_active")]
    pub active: bool,
}

fn default_active() -> bool {
    true
}

// ─── Odoo Webhook Receiver ───────────────────────────────────────────

/// Receive employee events from Odoo via webhook.
///
/// Called by the Odoo `alsabah_hr_attendance` module whenever an employee
/// is created, updated, or archived. Eliminates the 5-minute polling
/// delay and ensures immediate sync.
pub async fn odoo_employee_event(
    State(state): State<AppState>,
    Json(payload): Json<OdooEmployeeEvent>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let store = require_employee_store(&state)?;

    match payload.event.as_str() {
        "create" => handle_create(store.as_ref(), &state.event_bus, &payload.employees).await,
        "write" => handle_write(store.as_ref(), &state.event_bus, &payload.employees).await,
        "unlink" => handle_unlink(store.as_ref(), &state.event_bus, &payload.employee_ids).await,
        other => {
            tracing::warn!(event = %other, "odoo webhook: unknown event type");
            Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
        },
    }
}

// ─── Event Handlers (extracted, ≤80 lines, ≤3 nesting) ──────────────

async fn handle_create(
    store: &dyn EmployeeStore,
    bus: &EventBus,
    employees: &[OdooEmployeeData],
) -> Result<Json<ApiEnvelope<StatusResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let mut created = 0u32;

    for emp in employees {
        // Guard: PIN is required (Odoo auto-generates it on employee creation)
        if emp.device_id_num.is_empty() {
            tracing::warn!(odoo_id = emp.odoo_id, name = %emp.name,
                "odoo webhook: missing device_id_num — skipping");
            continue;
        }

        let external_id = emp.odoo_id.to_string();

        // Guard: skip if already synced
        if let Ok(Some(_)) = store.find_employee_by_external_id(&external_id).await {
            tracing::debug!(odoo_id = emp.odoo_id, "odoo webhook: already synced");
            continue;
        }

        let dept = optional_string(&emp.department);
        let employee = Employee::new(&emp.device_id_num, &emp.name, dept, Some(external_id));

        if let Err(e) = store.create_employee(&employee).await {
            tracing::error!(odoo_id = emp.odoo_id, pin = %emp.device_id_num, error = %e,
                "odoo webhook: create failed");
            continue;
        }

        created += 1;
        bus.publish(DomainEvent::EmployeeCreated {
            pin: emp.device_id_num.clone(),
            name: emp.name.clone(),
        });
        tracing::info!(odoo_id = emp.odoo_id, pin = %emp.device_id_num, name = %emp.name,
            "odoo webhook: employee created");
    }

    tracing::info!(created, total = employees.len(), "odoo webhook: create batch complete");
    Ok(Json(ApiEnvelope::success(StatusResponse::created())))
}

async fn handle_write(
    store: &dyn EmployeeStore,
    bus: &EventBus,
    employees: &[OdooEmployeeData],
) -> Result<Json<ApiEnvelope<StatusResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let mut updated = 0u32;
    let mut deactivated = 0u32;

    for emp in employees {
        let external_id = emp.odoo_id.to_string();

        let existing = match store.find_employee_by_external_id(&external_id).await {
            Ok(Some(e)) => e,
            Ok(None) => {
                // Not yet synced — treat as create
                sync_create_from_write(store, bus, emp, &mut updated).await;
                continue;
            },
            Err(e) => {
                tracing::error!(odoo_id = emp.odoo_id, error = %e, "odoo webhook: lookup failed");
                continue;
            },
        };

        // Guard: deactivation path
        if !emp.active && existing.active {
            sync_deactivate(store, bus, &existing, &mut deactivated).await;
            continue;
        }

        // Guard: no changes
        let changes = detect_changes(&existing, emp);
        if changes.is_none() {
            continue;
        }

        let mut changed = changes.unwrap();
        changed.updated_at = jiff::Timestamp::now();

        if let Err(e) = store.update_employee(&changed).await {
            tracing::error!(odoo_id = emp.odoo_id, error = %e, "odoo webhook: update failed");
            continue;
        }

        updated += 1;
        bus.publish(DomainEvent::EmployeeUpdated {
            id: existing.id.to_string(),
            pin: changed.pin.clone(),
            name: changed.name.clone(),
        });
        tracing::info!(odoo_id = emp.odoo_id, pin = %changed.pin, "odoo webhook: employee updated");
    }

    tracing::info!(
        updated,
        deactivated,
        total = employees.len(),
        "odoo webhook: write batch complete"
    );
    Ok(Json(ApiEnvelope::success(StatusResponse::updated())))
}

async fn handle_unlink(
    store: &dyn EmployeeStore,
    bus: &EventBus,
    employee_ids: &[i64],
) -> Result<Json<ApiEnvelope<StatusResponse>>, (StatusCode, Json<ApiEnvelope<()>>)> {
    let mut removed = 0u32;

    for &odoo_id in employee_ids {
        let external_id = odoo_id.to_string();
        let employee = match store.find_employee_by_external_id(&external_id).await {
            Ok(Some(e)) => e,
            Ok(None) => continue,
            Err(e) => {
                tracing::error!(odoo_id, error = %e, "odoo webhook: unlink lookup failed");
                continue;
            },
        };

        bus.publish(DomainEvent::EmployeeRemoveRequested { employee_pin: employee.pin.clone() });
        bus.publish(DomainEvent::EmployeeDeactivated { pin: employee.pin.clone() });
        removed += 1;
        tracing::info!(odoo_id, pin = %employee.pin, "odoo webhook: unlinked — queued device removal");
    }

    tracing::info!(removed, total = employee_ids.len(), "odoo webhook: unlink batch complete");
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

// ─── Private Helpers ─────────────────────────────────────────────────

fn require_employee_store(
    state: &AppState,
) -> Result<&Arc<dyn EmployeeStore>, (StatusCode, Json<ApiEnvelope<()>>)> {
    state.employees.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiEnvelope::error(crate::response::ApiError::internal(
                "Employee store not configured. Set TIMEKEEP_DB_PATH and restart.",
            ))),
        )
    })
}

fn optional_string(s: &str) -> Option<String> {
    if s.is_empty() { None } else { Some(s.to_string()) }
}

/// Detect changed fields between an existing employee and incoming Odoo data.
/// Returns `None` if nothing changed.
fn detect_changes(existing: &Employee, incoming: &OdooEmployeeData) -> Option<Employee> {
    let mut changed = existing.clone();
    let mut has_changes = false;

    if !incoming.name.is_empty() && changed.name != incoming.name {
        changed.name = incoming.name.clone();
        has_changes = true;
    }
    if !incoming.device_id_num.is_empty() && changed.pin != incoming.device_id_num {
        changed.pin = incoming.device_id_num.clone();
        has_changes = true;
    }
    let new_dept = optional_string(&incoming.department);
    if changed.department != new_dept {
        changed.department = new_dept;
        has_changes = true;
    }

    if has_changes { Some(changed) } else { None }
}

/// Create an employee in Timekeep when an Odoo write arrives for an unknown employee.
async fn sync_create_from_write(
    store: &dyn EmployeeStore,
    bus: &EventBus,
    emp: &OdooEmployeeData,
    updated: &mut u32,
) {
    if emp.device_id_num.is_empty() {
        return;
    }

    let external_id = emp.odoo_id.to_string();
    let dept = optional_string(&emp.department);
    let employee = Employee::new(&emp.device_id_num, &emp.name, dept, Some(external_id));

    if let Err(e) = store.create_employee(&employee).await {
        tracing::error!(odoo_id = emp.odoo_id, error = %e, "odoo webhook: create-on-write failed");
        return;
    }

    *updated += 1;
    bus.publish(DomainEvent::EmployeeCreated {
        pin: emp.device_id_num.clone(),
        name: emp.name.clone(),
    });
}

/// Deactivate an employee and queue device removal.
async fn sync_deactivate(
    store: &dyn EmployeeStore,
    bus: &EventBus,
    existing: &Employee,
    deactivated: &mut u32,
) {
    let mut emp = existing.clone();
    emp.deactivate();

    if let Err(e) = store.update_employee(&emp).await {
        tracing::error!(external_id = ?existing.external_id, pin = %existing.pin, error = %e,
            "odoo webhook: deactivate failed");
        return;
    }

    *deactivated += 1;
    bus.publish(DomainEvent::EmployeeDeactivated { pin: existing.pin.clone() });
    bus.publish(DomainEvent::EmployeeRemoveRequested { employee_pin: existing.pin.clone() });
    tracing::info!(pin = %existing.pin, "odoo webhook: deactivated — removing from devices");
}
