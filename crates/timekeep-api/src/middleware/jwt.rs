//! JWT token creation and verification utilities.

use timekeep_core::{Error, Role};

pub(crate) const JWT_EXPIRY_HOURS: u64 = 24;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub(crate) struct Claims {
    pub(crate) sub: String,
    pub(crate) role: String,
    pub(crate) permissions: Option<String>,
    pub(crate) exp: usize,
    pub(crate) iat: usize,
}

pub(crate) fn create_token(username: &str, role: Role, secret: &str) -> Result<String, Error> {
    let now = jiff::Timestamp::now().as_second() as usize;
    let claims = Claims {
        sub: username.into(),
        role: role.to_string(),
        permissions: Some(role.permissions().to_space_separated()),
        exp: now + JWT_EXPIRY_HOURS as usize * 3600,
        iat: now,
    };
    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| Error::auth(format!("jwt encode: {e}")))
}

pub(crate) fn verify_token(token: &str, secret: &str) -> Result<Claims, Error> {
    jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map(|d| d.claims)
    .map_err(|e| Error::auth(format!("jwt verify: {e}")))
}
