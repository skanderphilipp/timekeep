//! Authentication and authorization middleware.
//!
//! Composable Axum middleware following the same guard pattern as NestJS:
//!
//! ```text
//! Router
//!   .merge(admin_routes.layer(from_fn(auth::require_admin)))
//!   .layer(from_fn_with_state(state, auth::require_jwt))
//! ```
//!
//! ## Design
//!
//! Instead of checking `user.role == Admin` inside every handler (hacky),
//! middleware layers handle concern separation. Handlers receive the
//! authenticated user via `Extension<UserContext>`.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::AppState;
use timekeep_core::{PermissionSet, Role};

/// Authenticated user context extracted from JWT and attached to requests.
#[derive(Debug, Clone)]
pub struct UserContext {
    /// Username from the JWT subject claim.
    pub username: String,
    /// Role embedded in the JWT.
    pub role: Role,
    /// Permissions derived from the role.
    pub permissions: PermissionSet,
}

impl UserContext {
    /// Create a user context for tests (no real JWT needed).
    pub fn test_admin() -> Self {
        Self { username: "admin".into(), role: Role::Admin, permissions: Role::Admin.permissions() }
    }

    /// Returns `true` if this user has at least the minimum role.
    pub fn has_role(&self, minimum: Role) -> bool {
        self.role.is_at_least(minimum)
    }

    /// Returns `true` if this user has all required permissions.
    pub fn has_permission(&self, required: PermissionSet) -> bool {
        self.permissions.contains(required)
    }
}

/// Middleware: validates the JWT Bearer token and extracts user context.
///
/// On success, attaches `UserContext` to the request via `axum::Extension`.
/// On failure, returns 401 Unauthorized.
pub async fn require_jwt(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let headers = request.headers();
    let auth =
        headers.get(axum::http::header::AUTHORIZATION).and_then(|v| v.to_str().ok()).unwrap_or("");

    let token = match auth.strip_prefix("Bearer ") {
        Some(t) => t,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let claims = crate::middleware::jwt::verify_token(token, &state.jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let role = Role::from_str(&claims.role).unwrap_or(Role::Viewer);
    let permissions = claims
        .permissions
        .as_deref()
        .map(PermissionSet::from_space_separated)
        .unwrap_or_else(|| role.permissions());

    request.extensions_mut().insert(UserContext { username: claims.sub, role, permissions });

    Ok(next.run(request).await)
}

/// Middleware: requires Admin role.
///
/// Must be layered AFTER [`require_jwt`], which attaches [`UserContext`].
pub async fn require_admin(request: Request, next: Next) -> Result<Response, StatusCode> {
    let user = request.extensions().get::<UserContext>().ok_or(StatusCode::UNAUTHORIZED)?;
    if !user.has_role(Role::Admin) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(request).await)
}

/// Middleware: requires at least Operator role.
pub async fn require_operator(request: Request, next: Next) -> Result<Response, StatusCode> {
    let user = request.extensions().get::<UserContext>().ok_or(StatusCode::UNAUTHORIZED)?;
    if !user.has_role(Role::Operator) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(request).await)
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_hierarchy() {
        let admin = UserContext::test_admin();
        assert!(admin.has_role(Role::Admin));
        assert!(admin.has_role(Role::Operator));
        assert!(admin.has_role(Role::Viewer));

        let operator = UserContext {
            username: "op".into(),
            role: Role::Operator,
            permissions: Role::Operator.permissions(),
        };
        assert!(!operator.has_role(Role::Admin));
        assert!(operator.has_role(Role::Operator));
        assert!(operator.has_role(Role::Viewer));
    }

    #[test]
    fn test_permission_check() {
        let admin = UserContext::test_admin();
        assert!(admin.has_permission(PermissionSet::WRITE_DEVICES));
        assert!(admin.has_permission(PermissionSet::all()));

        let viewer = UserContext {
            username: "viewer".into(),
            role: Role::Viewer,
            permissions: Role::Viewer.permissions(),
        };
        assert!(viewer.has_permission(PermissionSet::READ_PUNCHES));
        assert!(!viewer.has_permission(PermissionSet::WRITE_PUNCHES));
    }
}
