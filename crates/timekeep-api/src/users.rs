//! Dashboard user management + current-user endpoint ("who am I?").
//!
//! ## Endpoints
//!
//! | Method | Path                          | Role     | Handler            |
//! |--------|-------------------------------|----------|--------------------|
//! | GET    | `/api/auth/me`                | Viewer+  | `whoami`           |
//! | GET    | `/api/users`                  | Admin    | `list_users`       |
//! | POST   | `/api/users`                  | Admin    | `create_user`      |
//! | PUT    | `/api/users/{id}`             | Admin    | `update_user`      |
//! | DELETE | `/api/users/{id}`             | Admin    | `delete_user`      |
//! | PUT    | `/api/users/{id}/password`    | Viewer+  | `change_password`  |
//!
//! ## Design
//!
//! - `whoami` (GET /api/auth/me) is the REST equivalent of Reaktly's
//!   `currentUser` GraphQL query. It returns the authenticated user's
//!   identity from JWT claims — no database lookup needed.
//! - `change_password` is the only mutation allowed for non-admin roles.
//!   Users can change their own password; admins can change anyone's.
//! - All CRUD operations are admin-only and route-gated by the
//!   `require_admin` middleware applied at the router level in `lib.rs`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

use crate::AppState;
use crate::auth::UserContext;
use crate::dto::DashboardUserResponse;
use crate::request::{
    ChangePasswordRequest, CreateDashboardUserRequest, UpdateDashboardUserRequest,
};
use crate::response::ApiEnvelope;

// ─── Response types ──────────────────────────────────────────────────

/// Response for `GET /api/auth/me` — the current user's profile.
///
/// Derived entirely from JWT claims (no database round-trip).
/// The frontend uses this to populate `currentUserAtom` on initial
/// page load and to hydrate role-based UI state.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct UserProfileResponse {
    /// Username from the JWT subject claim.
    pub username: String,
    /// Role as a lowercase string: "admin", "operator", "viewer".
    pub role: String,
    /// Space-separated permission tokens (e.g. "read:punches write:devices").
    pub permissions: String,
}

impl From<&UserContext> for UserProfileResponse {
    fn from(ctx: &UserContext) -> Self {
        Self {
            username: ctx.username.clone(),
            role: ctx.role.to_string(),
            permissions: ctx.permissions.to_space_separated(),
        }
    }
}

// ─── Current user ("who am I?") ──────────────────────────────────────

/// `GET /api/auth/me` — Returns the current authenticated user's profile.
///
/// Derived entirely from JWT claims (no database round-trip).
/// The frontend calls this on initial page load to hydrate `currentUserAtom`.
#[utoipa::path(
    get,
    path = "/api/auth/me",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current user profile", body = UserProfileResponse),
        (status = 401, description = "Unauthorized — missing or invalid JWT"),
    )
)]
pub(crate) async fn whoami(
    Extension(user): Extension<UserContext>,
) -> Json<ApiEnvelope<UserProfileResponse>> {
    Json(ApiEnvelope::success(UserProfileResponse::from(&user)))
}

// ─── List users (Admin) ──────────────────────────────────────────────

/// `GET /api/users` — List all dashboard users.
///
/// Admin-only. Returns every user in the system (never exposes password hashes).
#[utoipa::path(
    get,
    path = "/api/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(timekeep_core::ListParams),
    responses(
        (status = 200, description = "Paginated user list", body = Vec<DashboardUserResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin role required"),
    )
)]
pub(crate) async fn list_users(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<Json<ApiEnvelope<Vec<DashboardUserResponse>>>, crate::response::AppError> {
    let result =
        state.storage.list_dashboard_users(&params).await.map_err(|e| {
            crate::response::AppError::Internal(format!("failed to list users: {e}"))
        })?;

    let users: Vec<DashboardUserResponse> =
        result.items.iter().map(DashboardUserResponse::from).collect();

    Ok(Json(ApiEnvelope::success(users)))
}

// ─── Create user (Admin) ─────────────────────────────────────────────

/// `POST /api/users` — Create a new dashboard user.
///
/// Admin-only. The password is hashed with a random salt before storage.
/// Returns the created user (without password fields).
#[utoipa::path(
    post,
    path = "/api/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = CreateDashboardUserRequest,
    responses(
        (status = 201, description = "User created", body = DashboardUserResponse),
        (status = 400, description = "Validation error (duplicate username, invalid role)"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin role required"),
    )
)]
pub(crate) async fn create_user(
    State(state): State<AppState>,
    Extension(actor): Extension<UserContext>,
    Json(body): Json<CreateDashboardUserRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DashboardUserResponse>>), crate::response::AppError> {
    use timekeep_core::Role;

    // Validate role
    let role = Role::from_str(&body.role).ok_or_else(|| {
        crate::response::AppError::Validation(crate::response::ApiError::validation(format!(
            "invalid role '{}'. Must be one of: admin, operator, viewer",
            body.role
        )))
    })?;

    // Validate username
    if body.username.trim().is_empty() {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            "username is required",
        )));
    }
    if body.username.len() < 3 {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            "username must be at least 3 characters",
        )));
    }

    // Validate password
    if body.password.len() < 6 {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            "password must be at least 6 characters",
        )));
    }

    // Check for duplicate username
    if let Ok(Some(_)) = state.storage.find_dashboard_user_by_username(&body.username).await {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            format!("username '{}' already exists", body.username),
        )));
    }

    let salt = timekeep_core::DashboardUser::generate_salt();
    let password_hash = timekeep_core::DashboardUser::hash_password(&body.password, &salt);
    let now = jiff::Timestamp::now().as_second();

    // Build permissions: use provided custom permissions, or role defaults
    let permissions = if let Some(ref perm_tokens) = body.permissions {
        let joined = perm_tokens.join(" ");
        timekeep_core::PermissionSet::from_space_separated(&joined)
    } else {
        role.permissions()
    };

    let user = timekeep_core::DashboardUser {
        id: uuid::Uuid::now_v7().to_string(),
        username: body.username.clone(),
        password_hash,
        salt,
        role,
        permissions,
        display_name: body.display_name.unwrap_or_else(|| body.username.clone()),
        active: true,
        created_at: now,
        updated_at: now,
    };

    state
        .storage
        .create_dashboard_user(&user)
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to create user: {e}")))?;

    tracing::info!(
        username = %user.username,
        role = %user.role,
        actor = %actor.username,
        "dashboard user created"
    );

    // Publish domain event for audit trail
    state
        .event_bus
        .publish(timekeep_core::DomainEvent::DashboardUserCreated {
            username: user.username.clone(),
            role: user.role.to_string(),
        });

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(DashboardUserResponse::from(&user)))))
}

// ─── Update user (Admin) ─────────────────────────────────────────────

/// `PUT /api/users/{id}` — Update a dashboard user's role, name, or active status.
///
/// Admin-only. Cannot change username or password (use the password endpoint).
#[utoipa::path(
    put,
    path = "/api/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = UpdateDashboardUserRequest,
    responses(
        (status = 200, description = "User updated", body = DashboardUserResponse),
        (status = 404, description = "User not found"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin role required"),
    )
)]
pub(crate) async fn update_user(
    State(state): State<AppState>,
    Extension(actor): Extension<UserContext>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDashboardUserRequest>,
) -> Result<Json<ApiEnvelope<DashboardUserResponse>>, crate::response::AppError> {
    use timekeep_core::Role;

    // Fetch existing user
    let all_users = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams { limit: 1000, ..Default::default() })
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to fetch users: {e}")))?;

    let mut existing = all_users
        .items
        .into_iter()
        .find(|u| u.id == id)
        .ok_or_else(|| crate::response::AppError::NotFound(format!("user '{id}' not found")))?;

    // Apply updates
    if let Some(role_str) = &body.role {
        let role = Role::from_str(role_str).ok_or_else(|| {
            crate::response::AppError::Validation(crate::response::ApiError::validation(format!(
                "invalid role '{}'. Must be one of: admin, operator, viewer",
                role_str
            )))
        })?;
        existing.role = role;
    }

    if let Some(ref display_name) = body.display_name {
        existing.display_name = display_name.clone();
    }

    if let Some(active) = body.active {
        existing.active = active;
    }

    existing.updated_at = jiff::Timestamp::now().as_second();

    state
        .storage
        .update_dashboard_user(&existing)
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to update user: {e}")))?;

    tracing::info!(
        target_user = %existing.username,
        actor = %actor.username,
        "dashboard user updated"
    );

    Ok(Json(ApiEnvelope::success(DashboardUserResponse::from(&existing))))
}

// ─── Delete user (Admin) ─────────────────────────────────────────────

/// `DELETE /api/users/{id}` — Delete a dashboard user.
///
/// Admin-only. Cannot delete yourself (the actor).
#[utoipa::path(
    delete,
    path = "/api/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "User deleted", body = crate::dto::StatusResponse),
        (status = 404, description = "User not found"),
        (status = 400, description = "Cannot delete yourself"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — admin role required"),
    )
)]
pub(crate) async fn delete_user(
    State(state): State<AppState>,
    Extension(actor): Extension<UserContext>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<crate::dto::StatusResponse>>, crate::response::AppError> {
    // Prevent self-deletion
    let all_users = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams { limit: 1000, ..Default::default() })
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to fetch users: {e}")))?;

    let target = all_users
        .items
        .iter()
        .find(|u| u.id == id)
        .ok_or_else(|| crate::response::AppError::NotFound(format!("user '{id}' not found")))?;

    if target.username == actor.username {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            "cannot delete your own account",
        )));
    }

    state
        .storage
        .delete_dashboard_user(&id)
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to delete user: {e}")))?;

    tracing::info!(
        target_user = %target.username,
        actor = %actor.username,
        "dashboard user deleted"
    );

    Ok(Json(ApiEnvelope::success(crate::dto::StatusResponse::deleted())))
}

// ─── Change password ─────────────────────────────────────────────────

/// `PUT /api/users/{id}/password` — Change a user's password.
///
/// Any authenticated user can change their own password.
/// Admins can change any user's password.
///
/// This is in the viewer routes (no role middleware) so every user can
/// reach it. Authorization is checked inline: you must be the target user
/// or an admin.
#[utoipa::path(
    put,
    path = "/api/users/{id}/password",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = ChangePasswordRequest,
    responses(
        (status = 200, description = "Password changed", body = crate::dto::StatusResponse),
        (status = 404, description = "User not found"),
        (status = 403, description = "Not authorized to change this user's password"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn change_password(
    State(state): State<AppState>,
    Extension(actor): Extension<UserContext>,
    Path(id): Path<String>,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<Json<ApiEnvelope<crate::dto::StatusResponse>>, crate::response::AppError> {
    // Validate password length
    if body.password.len() < 6 {
        return Err(crate::response::AppError::Validation(crate::response::ApiError::validation(
            "password must be at least 6 characters",
        )));
    }

    // Fetch the target user
    let all_users = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams { limit: 1000, ..Default::default() })
        .await
        .map_err(|e| crate::response::AppError::Internal(format!("failed to fetch users: {e}")))?;

    let target = all_users
        .items
        .iter()
        .find(|u| u.id == id)
        .ok_or_else(|| crate::response::AppError::NotFound(format!("user '{id}' not found")))?;

    // Authorization: must be the target user or an admin
    if target.username != actor.username && !actor.has_role(timekeep_core::Role::Admin) {
        return Err(crate::response::AppError::Forbidden);
    }

    // Hash the new password
    let salt = timekeep_core::DashboardUser::generate_salt();
    let password_hash = timekeep_core::DashboardUser::hash_password(&body.password, &salt);

    state.storage.update_dashboard_user_password(&id, &password_hash, &salt).await.map_err(
        |e| crate::response::AppError::Internal(format!("failed to update password: {e}")),
    )?;

    tracing::info!(
        target_user = %target.username,
        actor = %actor.username,
        "password changed for dashboard user"
    );

    Ok(Json(ApiEnvelope::success(crate::dto::StatusResponse::updated())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use timekeep_core::{PermissionSet, Role};

    #[test]
    fn test_user_profile_from_context() {
        let ctx = UserContext {
            username: "operator1".into(),
            role: Role::Operator,
            permissions: Role::Operator.permissions(),
        };
        let profile = UserProfileResponse::from(&ctx);
        assert_eq!(profile.username, "operator1");
        assert_eq!(profile.role, "operator");
        assert!(profile.permissions.contains("read:punches"));
        assert!(profile.permissions.contains("manage:device_users"));
        assert!(!profile.permissions.contains("write:devices"));
    }

    #[test]
    fn test_admin_profile_has_all_permissions() {
        let ctx = UserContext::test_admin();
        let profile = UserProfileResponse::from(&ctx);
        assert_eq!(profile.role, "admin");
        assert_eq!(profile.permissions, PermissionSet::all().to_space_separated());
    }
}
