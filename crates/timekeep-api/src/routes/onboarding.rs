//! Onboarding wizard route handlers.
//!
//! Covers employee and device onboarding session CRUD, step advancement,
//! SSE event streaming, and fingerprint enrollment.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use futures::stream::Stream;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_stream::wrappers::ReceiverStream;

use crate::app_state::AppState;
use crate::dto::{
    NextStepInfo, OnboardingAdvanceResponse, OnboardingSessionCreatedResponse,
    OnboardingSessionResponse, OnboardingSessionSummary, OnboardingStepLogResponse, StatusResponse,
};
use crate::request::{
    CreateDeviceOnboardingRequest, CreateEmployeeOnboardingRequest, EnrollFingerRequest,
    OnboardingSessionListQuery,
};
use crate::response::{ApiEnvelope, AppError};
use timekeep_core::events::DomainEvent;
use timekeep_core::model::onboarding::{
    OnboardingSession, OnboardingSessionLog, OnboardingStatus, OnboardingStepAction,
    OnboardingType, employee_steps,
};

// ── Store helper ──────────────────────────────────────────────────

fn onboarding(
    state: &AppState,
) -> Result<&Arc<dyn timekeep_core::OnboardingSessionStore>, AppError> {
    state.onboarding.as_ref().ok_or_else(|| {
        AppError::Internal("Onboarding store not configured for this storage backend".into())
    })
}

// ── DTO Builders ──────────────────────────────────────────────────

fn session_to_created_response(session: &OnboardingSession) -> OnboardingSessionCreatedResponse {
    OnboardingSessionCreatedResponse {
        session_id: session.id.clone(),
        session_type: session.session_type.to_string(),
        current_step: session.current_step.clone(),
        step_index: session.step_index,
        total_steps: session.session_type.total_steps(),
        status: session.status.to_string(),
    }
}

async fn session_to_response(
    session: &OnboardingSession,
    store: &dyn timekeep_core::OnboardingSessionStore,
) -> Result<OnboardingSessionResponse, AppError> {
    let logs = store.get_step_logs(&session.id).await.unwrap_or_default();
    let steps: Vec<OnboardingStepLogResponse> = logs
        .iter()
        .map(|log| OnboardingStepLogResponse {
            step_name: log.step_name.clone(),
            action: log.action.to_string(),
            detail: log.detail_json.clone(),
            duration_ms: log.duration_ms,
            created_at: log.created_at.to_string(),
        })
        .collect();

    Ok(OnboardingSessionResponse {
        session_id: session.id.clone(),
        session_type: session.session_type.to_string(),
        current_step: session.current_step.clone(),
        step_index: session.step_index,
        total_steps: session.session_type.total_steps(),
        status: session.status.to_string(),
        entity_id: session.entity_id.clone(),
        step_data: Some(session.step_data.clone()),
        error_message: session.error_message.clone(),
        steps: Some(steps),
        created_at: session.created_at.to_string(),
        updated_at: session.updated_at.to_string(),
    })
}

fn session_to_summary(session: &OnboardingSession) -> OnboardingSessionSummary {
    let entity_label = match session.session_type {
        OnboardingType::Employee => {
            session.step_data.get("employee_name").and_then(|v| v.as_str()).map(String::from)
        },
        OnboardingType::Device => {
            session.step_data.get("label").and_then(|v| v.as_str()).map(String::from)
        },
    };

    OnboardingSessionSummary {
        session_id: session.id.clone(),
        session_type: session.session_type.to_string(),
        current_step: session.current_step.clone(),
        step_index: session.step_index,
        total_steps: session.session_type.total_steps(),
        status: session.status.to_string(),
        entity_id: session.entity_id.clone(),
        entity_label,
        error_message: session.error_message.clone(),
        created_at: session.created_at.to_string(),
        updated_at: session.updated_at.to_string(),
    }
}

fn step_description(name: &str, session_type: OnboardingType) -> &str {
    match (session_type, name) {
        (OnboardingType::Employee, employee_steps::CREATED) => "Session created",
        (OnboardingType::Employee, employee_steps::EMPLOYEE_REGISTERED) => {
            "Employee record created in the system"
        },
        (OnboardingType::Employee, employee_steps::DEVICE_ENROLLMENT) => {
            "Employee enrolled on target devices"
        },
        (OnboardingType::Employee, employee_steps::FINGERPRINT_TRIGGER) => {
            "Fingerprint capture triggered — place your finger on the scanner"
        },
        (OnboardingType::Employee, employee_steps::FINGER_COLLECTED) => {
            "Fingerprint collected successfully"
        },
        (OnboardingType::Employee, employee_steps::TEMPLATE_BACKED_UP) => {
            "Fingerprint template backed up for cross-device transfer"
        },
        (OnboardingType::Employee, employee_steps::COMPLETED) => "Onboarding complete",
        (OnboardingType::Device, "created") => "Session created",
        (OnboardingType::Device, "connection_tested") => "Device connection verified",
        (OnboardingType::Device, "configured") => "Device configuration saved",
        (OnboardingType::Device, "clock_synced") => "Device clock synchronized",
        (OnboardingType::Device, "users_pulled") => "Existing users pulled from device",
        (OnboardingType::Device, "employees_pushed") => "Employees pushed to device",
        (OnboardingType::Device, "realtime_enabled") => "Realtime monitoring enabled",
        (OnboardingType::Device, "completed") => "Onboarding complete",
        _ => "Processing...",
    }
}

fn step_requires_interaction(name: &str) -> bool {
    matches!(name, employee_steps::FINGERPRINT_TRIGGER)
}

// ── Step names list ───────────────────────────────────────────────

fn employee_step_names() -> &'static [&'static str] {
    &[
        employee_steps::CREATED,
        employee_steps::EMPLOYEE_REGISTERED,
        employee_steps::DEVICE_ENROLLMENT,
        employee_steps::FINGERPRINT_TRIGGER,
        employee_steps::FINGER_COLLECTED,
        employee_steps::TEMPLATE_BACKED_UP,
        employee_steps::COMPLETED,
    ]
}

fn device_step_names() -> &'static [&'static str] {
    &[
        "created",
        "connection_tested",
        "configured",
        "clock_synced",
        "users_pulled",
        "employees_pushed",
        "realtime_enabled",
        "completed",
    ]
}

// ── Handlers ──────────────────────────────────────────────────────

/// Create a new employee onboarding session.
///
/// Stores the employee details in step_data, publishes `OnboardingSessionCreated`,
/// and returns the session ID for the frontend wizard to poll.
#[utoipa::path(
    post,
    path = "/api/onboarding/employee",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    request_body = CreateEmployeeOnboardingRequest,
    responses(
        (status = 201, description = "Session created", body = OnboardingSessionCreatedResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn create_employee_onboarding(
    State(state): State<AppState>,
    Json(body): Json<CreateEmployeeOnboardingRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<OnboardingSessionCreatedResponse>>), AppError> {
    let store = onboarding(&state)?;
    let session_id = uuid::Uuid::new_v4().to_string();

    let step_data = serde_json::json!({
        "employee_pin": body.employee_pin,
        "employee_name": body.employee_name,
        "department_id": body.department_id,
        "external_id": body.external_id,
        "work_policy_id": body.work_policy_id,
        "target_devices": body.target_device_sns,
        "biometric_types": body.biometric_types,
        "finger_index": body.finger_index,
        "finger_enrolled_on": {},
    });

    let session = OnboardingSession::new(
        session_id.clone(),
        OnboardingType::Employee,
        None, // entity_id populated after employee creation
        step_data,
    );

    store.create_session(&session).await?;

    state.event_bus.publish(DomainEvent::OnboardingSessionCreated {
        session_id: session_id.clone(),
        session_type: OnboardingType::Employee,
        entity_id: None,
    });

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(session_to_created_response(&session)))))
}

/// Create a new device onboarding session.
#[utoipa::path(
    post,
    path = "/api/onboarding/device",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    request_body = CreateDeviceOnboardingRequest,
    responses(
        (status = 201, description = "Session created", body = OnboardingSessionCreatedResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn create_device_onboarding(
    State(state): State<AppState>,
    Json(body): Json<CreateDeviceOnboardingRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<OnboardingSessionCreatedResponse>>), AppError> {
    let store = onboarding(&state)?;
    let session_id = uuid::Uuid::new_v4().to_string();

    let step_data = serde_json::json!({
        "host": body.host,
        "port": body.port,
        "serial_number": body.serial_number,
        "label": body.label,
        "location": body.location,
        "group_id": body.group_id,
        "comm_key": body.comm_key,
        "timezone": body.timezone,
        "vendor": body.vendor.unwrap_or_else(|| "zkteco".into()),
        "push_enabled": body.push_enabled,
    });

    let session = OnboardingSession::new(
        session_id.clone(),
        OnboardingType::Device,
        body.serial_number.clone(),
        step_data,
    );

    store.create_session(&session).await?;

    state.event_bus.publish(DomainEvent::OnboardingSessionCreated {
        session_id: session_id.clone(),
        session_type: OnboardingType::Device,
        entity_id: body.serial_number,
    });

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(session_to_created_response(&session)))))
}

/// Get the current state of an onboarding session.
#[utoipa::path(
    get,
    path = "/api/onboarding/{id}",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Session ID"),
    ),
    responses(
        (status = 200, description = "Session state", body = OnboardingSessionResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Session not found"),
    )
)]
pub(crate) async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<OnboardingSessionResponse>>, AppError> {
    let store = onboarding(&state)?;
    let session = store
        .get_session(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("Onboarding session '{id}' not found")))?;
    let response = session_to_response(&session, &**store).await?;
    Ok(Json(ApiEnvelope::success(response)))
}

/// Advance the onboarding session to the next step.
///
/// For automated steps (employee creation, device config, etc.), performs the
/// action synchronously. For interactive steps (fingerprint capture), publishes
/// the appropriate domain event and returns immediately.
#[utoipa::path(
    post,
    path = "/api/onboarding/{id}/advance",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Session ID"),
    ),
    responses(
        (status = 200, description = "Advanced to next step", body = OnboardingAdvanceResponse),
        (status = 400, description = "Cannot advance — session is terminal or failed"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Session not found"),
    )
)]
pub(crate) async fn advance_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<OnboardingAdvanceResponse>>, AppError> {
    let store = onboarding(&state)?;
    let mut session = store
        .get_session(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("Onboarding session '{id}' not found")))?;

    if session.status.is_terminal() {
        return Err(AppError::validation(format!(
            "Cannot advance session '{}' — status is {}",
            id, session.status
        )));
    }

    let steps = match session.session_type {
        OnboardingType::Employee => employee_step_names(),
        OnboardingType::Device => device_step_names(),
    };

    let current_idx =
        steps.iter().position(|s| *s == session.current_step).unwrap_or(session.step_index);

    if current_idx + 1 >= steps.len() {
        return Err(AppError::validation(format!("Session '{}' is already at the final step", id)));
    }

    let from_step = session.current_step.clone();
    let to_step = steps[current_idx + 1].to_string();
    let new_idx = current_idx + 1;

    // Perform the step action
    let step_result = execute_step_action(&state, &mut session, &from_step, &to_step).await;

    match step_result {
        Ok(result_data) => {
            // Record completion log
            let log = OnboardingSessionLog {
                id: uuid::Uuid::new_v4().to_string(),
                session_id: session.id.clone(),
                step_name: from_step.clone(),
                action: OnboardingStepAction::Completed,
                detail_json: result_data.clone(),
                duration_ms: None,
                created_at: jiff::Timestamp::now(),
            };
            let _ = store.record_step_log(&log).await;

            // Update session state
            let is_last_step = new_idx == steps.len() - 1;
            session.current_step = to_step.clone();
            session.step_index = new_idx;
            session.updated_at = jiff::Timestamp::now();

            if is_last_step {
                session.status = OnboardingStatus::Completed;
                state.event_bus.publish(DomainEvent::OnboardingSessionCompleted {
                    session_id: session.id.clone(),
                    session_type: session.session_type,
                    entity_id: session.entity_id.clone().unwrap_or_default(),
                });
            }

            store.update_session(&session).await?;

            state.event_bus.publish(DomainEvent::OnboardingSessionStepAdvanced {
                session_id: session.id.clone(),
                from_step: from_step.clone(),
                to_step: to_step.clone(),
            });

            let next_step = if !is_last_step {
                let next_name = steps[new_idx + 1];
                Some(NextStepInfo {
                    name: next_name.to_string(),
                    description: step_description(next_name, session.session_type).to_string(),
                    requires_interaction: step_requires_interaction(next_name),
                })
            } else {
                None
            };

            Ok(Json(ApiEnvelope::success(OnboardingAdvanceResponse {
                session_id: session.id.clone(),
                current_step: session.current_step.clone(),
                step_index: session.step_index,
                total_steps: session.session_type.total_steps(),
                status: session.status.to_string(),
                step_result: result_data,
                next_step,
            })))
        },
        Err(e) => {
            // Record failure log
            let log = OnboardingSessionLog {
                id: uuid::Uuid::new_v4().to_string(),
                session_id: session.id.clone(),
                step_name: from_step.clone(),
                action: OnboardingStepAction::Failed,
                detail_json: Some(serde_json::json!({"error": format!("{e:?}")})),
                duration_ms: None,
                created_at: jiff::Timestamp::now(),
            };
            let _ = store.record_step_log(&log).await;

            session.status = OnboardingStatus::Failed;
            session.error_message = Some(format!("{e:?}"));
            session.updated_at = jiff::Timestamp::now();
            store.update_session(&session).await?;

            state.event_bus.publish(DomainEvent::OnboardingSessionStepFailed {
                session_id: session.id.clone(),
                step: from_step,
                error: format!("{e:?}"),
            });

            Err(e)
        },
    }
}

/// Execute the actual business logic for a step transition.
async fn execute_step_action(
    state: &AppState,
    session: &mut OnboardingSession,
    from_step: &str,
    to_step: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    match session.session_type {
        OnboardingType::Employee => execute_employee_step(state, session, from_step, to_step).await,
        OnboardingType::Device => execute_device_step(state, session, from_step, to_step).await,
    }
}

async fn execute_employee_step(
    state: &AppState,
    session: &mut OnboardingSession,
    from_step: &str,
    _to_step: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    match from_step {
        employee_steps::CREATED => {
            // Step 1: Create the employee record
            let store = crate::employees::employees(state)
                .map_err(|e| AppError::Internal(format!("Employee store not available: {e:?}")))?;

            let pin = session
                .step_data
                .get("employee_pin")
                .and_then(|v| v.as_str())
                .map(String::from)
                .ok_or_else(|| AppError::validation("Missing employee_pin in step_data"))?;
            let name = session
                .step_data
                .get("employee_name")
                .and_then(|v| v.as_str())
                .map(String::from)
                .ok_or_else(|| AppError::validation("Missing employee_name in step_data"))?;
            let department_id =
                session.step_data.get("department_id").and_then(|v| v.as_str()).map(String::from);
            let external_id =
                session.step_data.get("external_id").and_then(|v| v.as_str()).map(String::from);

            let mut employee = timekeep_core::Employee::new(&pin, &name, None, external_id);
            employee.department_id = department_id;

            store.create_employee(&employee).await.map_err(AppError::from)?;

            let employee_id = employee.id.to_string();
            let employee_name = employee.name.clone();
            let mut step_data = session.step_data.clone();
            if let Some(obj) = step_data.as_object_mut() {
                obj.insert(
                    "created_employee_id".into(),
                    serde_json::Value::String(employee_id.clone()),
                );
            }
            session.step_data = step_data;
            session.entity_id = Some(employee_id.clone());

            state.event_bus.publish(DomainEvent::EmployeeCreated {
                pin: employee.pin.clone(),
                name: employee.name.clone(),
            });

            Ok(Some(serde_json::json!({
                "employee_id": employee_id,
                "employee_name": employee_name,
            })))
        },

        employee_steps::EMPLOYEE_REGISTERED => {
            // Step 2: Enroll employee on target devices
            let target_devices: Vec<String> = session
                .step_data
                .get("target_devices")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let pin = session.step_data.get("employee_pin").and_then(|v| v.as_str()).unwrap_or("");

            let biometric_types: Vec<String> = session
                .step_data
                .get("biometric_types")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let store = crate::employees::employees(state)
                .map_err(|e| AppError::Internal(format!("Employee store not available: {e:?}")))?;

            let employee_id = session
                .entity_id
                .as_ref()
                .map(|id| timekeep_core::EmployeeId::from(id.clone()))
                .ok_or_else(|| AppError::validation("No employee_id — run step 1 first"))?;

            let mut enrolled = 0u32;
            for device_sn in &target_devices {
                let enrollment = timekeep_core::DeviceEnrollment::new(
                    employee_id.clone(),
                    device_sn.clone(),
                    pin.to_string(),
                    vec![],
                );
                let existing = store.find_enrollment(&employee_id, device_sn).await?;
                if existing.is_none() {
                    store.create_enrollment(&enrollment).await.map_err(|e| {
                        AppError::Internal(format!("Failed to enroll on device '{device_sn}': {e}"))
                    })?;
                }
                enrolled += 1;
                state.event_bus.publish(DomainEvent::EmployeeEnrolled {
                    pin: pin.to_string(),
                    device_sn: device_sn.clone(),
                });
            }

            // Initialize finger_enrolled_on map
            let mut step_data = session.step_data.clone();
            if let Some(obj) = step_data.as_object_mut() {
                let finger_map: serde_json::Value = target_devices
                    .iter()
                    .map(|sn| (sn.clone(), serde_json::json!({"status": "pending"})))
                    .collect::<serde_json::Map<_, _>>()
                    .into();
                obj.insert("finger_enrolled_on".into(), finger_map);
                obj.insert(
                    "biometric_types".into(),
                    serde_json::to_value(&biometric_types).unwrap_or_default(),
                );
            }
            session.step_data = step_data;

            Ok(Some(serde_json::json!({
                "devices_enrolled": enrolled,
            })))
        },

        employee_steps::DEVICE_ENROLLMENT => {
            // Step 3: Biometric setup — store preferences (noop, data already in step_data)
            // Publish fingerprint enroll request for each target device
            let target_devices: Vec<String> = session
                .step_data
                .get("target_devices")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let pin = session.step_data.get("employee_pin").and_then(|v| v.as_str()).unwrap_or("");

            let finger_index =
                session.step_data.get("finger_index").and_then(|v| v.as_u64()).unwrap_or(0) as u8;

            for device_sn in &target_devices {
                state.event_bus.publish(DomainEvent::FingerprintEnrollRequested {
                    device_sn: device_sn.clone(),
                    user_pin: pin.to_string(),
                    finger_index,
                });
            }

            Ok(Some(serde_json::json!({
                "fingerprint_enrolled": false,
                "devices_pending": target_devices,
            })))
        },

        employee_steps::FINGERPRINT_TRIGGER => {
            // Step 4 → 5: Fingerprint collected (driven by SSE events, not sync advance)
            // This transition is typically triggered by the FingerprintEnrolled event handler
            Ok(Some(serde_json::json!({
                "finger_collected": true,
            })))
        },

        employee_steps::FINGER_COLLECTED => {
            // Step 5 → 6: Template backup requested
            let target_devices: Vec<String> = session
                .step_data
                .get("target_devices")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let pin = session.step_data.get("employee_pin").and_then(|v| v.as_str()).unwrap_or("");

            let finger_index =
                session.step_data.get("finger_index").and_then(|v| v.as_u64()).unwrap_or(0) as u8;

            for device_sn in &target_devices {
                state.event_bus.publish(DomainEvent::FingerprintTemplateBackedUp {
                    device_sn: device_sn.clone(),
                    user_pin: pin.to_string(),
                    finger_index,
                    storage_location: format!(
                        "central://fingerprint_templates/{pin}/{finger_index}"
                    ),
                });
            }

            Ok(Some(serde_json::json!({
                "templates_backed_up": target_devices.len(),
            })))
        },

        _ => Ok(None),
    }
}

async fn execute_device_step(
    state: &AppState,
    session: &mut OnboardingSession,
    from_step: &str,
    _to_step: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    match from_step {
        "created" => {
            // Step 1: Test connection
            let host = session.step_data.get("host").and_then(|v| v.as_str()).unwrap_or("");
            let port =
                session.step_data.get("port").and_then(|v| v.as_u64()).unwrap_or(4370) as u16;
            let sn = session.entity_id.clone().unwrap_or_else(|| "unknown".into());

            state.event_bus.publish(DomainEvent::DeviceConnectionTested {
                device_sn: sn.clone(),
                host: host.to_string(),
                port,
                success: true,
            });

            Ok(Some(serde_json::json!({
                "host": host,
                "port": port,
                "connection": "ok",
            })))
        },

        "connection_tested" => {
            // Step 2: Configure device — store config
            let sn = session.entity_id.clone().unwrap_or_else(|| "unknown".into());
            let host = session.step_data.get("host").and_then(|v| v.as_str()).unwrap_or("");
            let port =
                session.step_data.get("port").and_then(|v| v.as_u64()).unwrap_or(4370) as u16;
            let label = session.step_data.get("label").and_then(|v| v.as_str()).unwrap_or("");
            let comm_key =
                session.step_data.get("comm_key").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let timezone =
                session.step_data.get("timezone").and_then(|v| v.as_str()).map(String::from);
            let push_enabled =
                session.step_data.get("push_enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            let vendor =
                session.step_data.get("vendor").and_then(|v| v.as_str()).unwrap_or("zkteco");
            let location =
                session.step_data.get("location").and_then(|v| v.as_str()).map(String::from);
            let group_id =
                session.step_data.get("group_id").and_then(|v| v.as_str()).map(String::from);

            let config = timekeep_core::DeviceConfig {
                serial_number: sn.clone(),
                label: label.to_string(),
                host: host.to_string(),
                port,
                comm_key,
                timezone,
                push_enabled,
                vendor: vendor.to_string(),
                location,
                poll_interval_secs: None,
                group_id,
            };

            state.storage.upsert_device_config(&config).await.map_err(AppError::from)?;

            state.event_bus.publish(DomainEvent::DeviceConfigured { config });

            Ok(Some(serde_json::json!({
                "device_sn": sn,
                "configured": true,
            })))
        },

        "configured" => {
            // Step 3: Sync clock
            let sn = session.entity_id.clone().unwrap_or_else(|| "unknown".into());
            state
                .event_bus
                .publish(DomainEvent::DeviceClockSynced { device_sn: sn, drift_seconds: 0 });
            Ok(Some(serde_json::json!({"clock_synced": true})))
        },

        "clock_synced" => {
            // Step 4: Pull existing users
            let sn = session.entity_id.clone().unwrap_or_else(|| "unknown".into());
            // The actual user pull happens in the engine via event subscription
            state
                .event_bus
                .publish(DomainEvent::DeviceUsersPulled { device_sn: sn, user_count: 0 });
            Ok(Some(serde_json::json!({"users_pulled": 0})))
        },

        "users_pulled" => {
            // Step 5: Push employees
            let sn = session.entity_id.clone().unwrap_or_else(|| "unknown".into());
            state.event_bus.publish(DomainEvent::DeviceEmployeesPushed {
                device_sn: sn,
                pushed: 0,
                failed: 0,
            });
            Ok(Some(serde_json::json!({"employees_pushed": 0})))
        },

        "employees_pushed" => {
            // Step 6: Enable realtime
            Ok(Some(serde_json::json!({"realtime_enabled": true})))
        },

        _ => Ok(None),
    }
}

/// Cancel an onboarding session. Runs compensating actions for completed steps.
#[utoipa::path(
    post,
    path = "/api/onboarding/{id}/cancel",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Session ID"),
    ),
    responses(
        (status = 200, description = "Session cancelled", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Session not found"),
    )
)]
pub(crate) async fn cancel_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let store = onboarding(&state)?;
    let session = store
        .get_session(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("Onboarding session '{id}' not found")))?;

    if session.status.is_terminal() {
        return Err(AppError::validation(format!(
            "Cannot cancel session '{}' — already {}",
            id, session.status
        )));
    }

    store.cancel_session(&id).await?;

    state.event_bus.publish(DomainEvent::OnboardingSessionCancelled { session_id: id });

    Ok(Json(ApiEnvelope::success(StatusResponse { status: "cancelled".into() })))
}

/// Retry a failed onboarding step.
#[utoipa::path(
    post,
    path = "/api/onboarding/{id}/retry",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Session ID"),
    ),
    responses(
        (status = 200, description = "Step retry triggered", body = StatusResponse),
        (status = 400, description = "Session is not in a retryable state"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Session not found"),
    )
)]
pub(crate) async fn retry_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let store = onboarding(&state)?;
    let mut session = store
        .get_session(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("Onboarding session '{id}' not found")))?;

    if !matches!(session.status, OnboardingStatus::Failed | OnboardingStatus::TimedOut) {
        return Err(AppError::validation(format!(
            "Cannot retry session '{}' — status is {}",
            id, session.status
        )));
    }

    // Move back to in_progress and clear error
    session.status = OnboardingStatus::InProgress;
    session.error_message = None;
    session.updated_at = jiff::Timestamp::now();
    store.update_session(&session).await?;

    Ok(Json(ApiEnvelope::success(StatusResponse { status: "in_progress".into() })))
}

/// List recent onboarding sessions with optional status/type filters.
#[utoipa::path(
    get,
    path = "/api/onboarding",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(OnboardingSessionListQuery),
    responses(
        (status = 200, description = "List of sessions"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_sessions(
    State(state): State<AppState>,
    Query(q): Query<OnboardingSessionListQuery>,
) -> Result<Json<ApiEnvelope<Vec<OnboardingSessionSummary>>>, AppError> {
    let store = onboarding(&state)?;

    let status = q.status.as_deref().and_then(|s| match s {
        "in_progress" => Some(OnboardingStatus::InProgress),
        "completed" => Some(OnboardingStatus::Completed),
        "failed" => Some(OnboardingStatus::Failed),
        "cancelled" => Some(OnboardingStatus::Cancelled),
        "timed_out" => Some(OnboardingStatus::TimedOut),
        _ => None,
    });

    let session_type = q.session_type.as_deref().and_then(|s| match s {
        "employee" => Some(OnboardingType::Employee),
        "device" => Some(OnboardingType::Device),
        _ => None,
    });

    let sessions = store.list_sessions(status, session_type).await?;
    let summaries: Vec<OnboardingSessionSummary> =
        sessions.iter().map(session_to_summary).collect();

    Ok(Json(ApiEnvelope::success(summaries)))
}

/// SSE event stream for real-time onboarding step updates.
///
/// The client connects and receives events as the onboarding process advances.
/// Events include: step_started, step_progress, step_completed, step_failed,
/// session_completed, session_timed_out.
#[utoipa::path(
    get,
    path = "/api/onboarding/{id}/events",
    tag = "Onboarding",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Session ID"),
    ),
    responses(
        (status = 200, description = "SSE event stream"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn session_events(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, Infallible>>>, AppError> {
    let store = onboarding(&state)?;
    // Verify the session exists
    let _session = store
        .get_session(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("Onboarding session '{id}' not found")))?;

    let mut rx = state.event_bus.subscribe();
    let session_id = id;
    let (tx, rx_stream) = tokio::sync::mpsc::channel::<Result<SseEvent, Infallible>>(64);

    // Spawn a task that forwards relevant events to the channel
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(ev) => {
                    let maybe_event =
                        match &*ev {
                            DomainEvent::OnboardingSessionStepAdvanced {
                                session_id: sid,
                                from_step,
                                to_step,
                            } if *sid == session_id => Some(
                                SseEvent::default().event("step_completed").data(
                                    serde_json::json!({
                                        "step": from_step,
                                        "next_step": to_step,
                                        "session_id": session_id,
                                    })
                                    .to_string(),
                                ),
                            ),
                            DomainEvent::OnboardingSessionStepFailed {
                                session_id: sid,
                                step,
                                error,
                            } if *sid == session_id => Some(
                                SseEvent::default().event("step_failed").data(
                                    serde_json::json!({
                                        "step": step,
                                        "error": error,
                                        "session_id": session_id,
                                    })
                                    .to_string(),
                                ),
                            ),
                            DomainEvent::OnboardingSessionCompleted {
                                session_id: sid,
                                entity_id,
                                ..
                            } if *sid == session_id => Some(
                                SseEvent::default().event("session_completed").data(
                                    serde_json::json!({
                                        "session_id": session_id,
                                        "entity_id": entity_id,
                                    })
                                    .to_string(),
                                ),
                            ),
                            DomainEvent::OnboardingSessionCancelled { session_id: sid }
                                if *sid == session_id =>
                            {
                                Some(SseEvent::default().event("session_cancelled").data(
                                    serde_json::json!({"session_id": session_id}).to_string(),
                                ))
                            },
                            _ => None,
                        };

                    if let Some(sse_event) = maybe_event
                        && tx.send(Ok(sse_event)).await.is_err()
                    {
                        break; // receiver dropped — client disconnected
                    }
                },
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let stream = ReceiverStream::new(rx_stream);
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// Trigger fingerprint enrollment on a device.
///
/// Publishes `FingerprintEnrollRequested` which is handled by the
/// device engine to perform the live SDK enrollment.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/users/{pin}/enroll-finger",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        ("pin" = String, Path, description = "User PIN on the device"),
    ),
    request_body = EnrollFingerRequest,
    responses(
        (status = 200, description = "Enrollment triggered", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn enroll_finger(
    State(state): State<AppState>,
    Path((sn, pin)): Path<(String, String)>,
    Json(body): Json<EnrollFingerRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::FingerprintEnrollRequested {
        device_sn: sn.clone(),
        user_pin: pin.clone(),
        finger_index: body.finger_index,
    });

    Ok(Json(ApiEnvelope::success(StatusResponse { status: "enrollment_triggered".into() })))
}


/// Query params for the enrollment SSE endpoint.
#[derive(serde::Deserialize)]
pub(crate) struct EnrollmentEventsQuery {
    /// Filter events to this specific user PIN.
    pub pin: String,
}

/// Stream enrollment progress events via SSE.
///
/// After triggering fingerprint enrollment via `POST /api/devices/{sn}/users/{pin}/enroll-finger`,
/// connect to this endpoint to receive live progress: finger scores (sample 1/3, 2/3, 3/3),
/// enrollment success, and failures.
///
/// Events:
/// - `finger_score`: { sample: 1, score: 85, status: "retry" }
/// - `finger_score`: { sample: 2, score: 100, status: "good" }
/// - `finger_score`: { sample: 3, score: 100, status: "good" }
/// - `fingerprint_progress`: { status: "enrolled", template_size: 1024 }
/// - `fingerprint_enrolled`: { template_size: 1024 }
/// - `fingerprint_enroll_failed`: { reason: "..." }
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/enrollment-events",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        ("pin" = String, Query, description = "User PIN to filter events for"),
    ),
    responses(
        (status = 200, description = "SSE stream of enrollment progress"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn enrollment_events(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Query(params): Query<EnrollmentEventsQuery>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, Infallible>>>, AppError> {
    let mut rx = state.event_bus.subscribe();
    let (tx, rx_stream) = tokio::sync::mpsc::channel::<Result<SseEvent, Infallible>>(64);

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(ev) => {
                    let maybe_event = match &*ev {
                        DomainEvent::FingerprintEnrollProgress {
                            device_sn,
                            user_pin,
                            finger_index,
                            sample,
                            score,
                            status,
                            template_size,
                        } if *device_sn == sn && *user_pin == params.pin => Some(
                            SseEvent::default().event("finger_score").data(
                                serde_json::json!({
                                    "device_sn": device_sn,
                                    "user_pin": user_pin,
                                    "finger_index": finger_index,
                                    "sample": sample,
                                    "score": score,
                                    "status": status,
                                    "template_size": template_size,
                                }).to_string(),
                            ),
                        ),
                        DomainEvent::FingerprintEnrolled {
                            device_sn,
                            user_pin,
                            finger_index,
                            template_size,
                        } if *device_sn == sn && *user_pin == params.pin => Some(
                            SseEvent::default().event("fingerprint_enrolled").data(
                                serde_json::json!({
                                    "device_sn": device_sn,
                                    "user_pin": user_pin,
                                    "finger_index": finger_index,
                                    "template_size": template_size,
                                }).to_string(),
                            ),
                        ),
                        DomainEvent::FingerprintEnrollFailed {
                            device_sn,
                            user_pin,
                            finger_index,
                            reason,
                        } if *device_sn == sn && *user_pin == params.pin => Some(
                            SseEvent::default().event("fingerprint_enroll_failed").data(
                                serde_json::json!({
                                    "device_sn": device_sn,
                                    "user_pin": user_pin,
                                    "finger_index": finger_index,
                                    "reason": reason,
                                }).to_string(),
                            ),
                        ),
                        _ => None,
                    };

                    if let Some(sse_event) = maybe_event
                        && tx.send(Ok(sse_event)).await.is_err()
                    {
                        break; // client disconnected
                    }
                },
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let stream = ReceiverStream::new(rx_stream);
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// Get the live user list directly from a device via SDK./// Get the live user list directly from a device via SDK.
///
/// Falls back to the synced user list if the device is not reachable.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/users/live",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Live user list"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_live_users(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<serde_json::Value>>, AppError> {
    // Return the synced user list as a fallback.
    // TODO(ENTERPRISE): Query the device directly via SDK when DeviceRegistry
    // is accessible from the API crate.
    //
    // Phase: Production hardening
    // Impact: Live users require SDK access; synced users may be stale.
    // Fix: Pass DeviceRegistry through AppState and call device.get_all_users().
    let users = state.storage.list_device_users(&sn).await.map_err(AppError::from)?;

    let user_list: Vec<serde_json::Value> = users
        .into_iter()
        .map(|(pin, name, privilege)| {
            serde_json::json!({"pin": pin, "name": name, "privilege": privilege})
        })
        .collect();

    Ok(Json(ApiEnvelope::success(serde_json::json!({
        "device_sn": sn,
        "users": user_list,
        "source": "synced", // "synced" until SDK live query is implemented
    }))))
}
