//! Unified error type for the entire timekeep system.
//!
//! This replaces `Result<_, String>` across all trait boundaries,
//! providing structured error variants that callers can match on.

use thiserror::Error;

/// Unified error type for the entire timekeep system.
///
/// Every subsystem maps its failures into one of these variants.
/// The string payload carries the original error message for logging
/// and debugging. Additional structured fields can be added to variants
/// as needed without breaking existing callers.
#[derive(Debug, Error)]
pub enum Error {
    /// Database / storage layer errors.
    #[error("storage error: {0}")]
    Storage(String),

    /// Device communication errors (protocol, timeout, connection lost).
    #[error("device communication error: {0}")]
    DeviceCommunication(String),

    /// Input validation errors (malformed data, missing fields).
    #[error("validation error: {0}")]
    Validation(String),

    /// Authentication / authorization errors.
    #[error("authentication error: {0}")]
    Authentication(String),

    /// Network / HTTP errors.
    #[error("network error: {0}")]
    Network(String),

    /// Resource not found.
    #[error("not found: {0}")]
    NotFound(String),

    /// Duplicate entry / constraint violation.
    #[error("duplicate: {0}")]
    Duplicate(String),

    /// Configuration errors (missing env vars, invalid config files).
    #[error("configuration error: {0}")]
    Configuration(String),

    /// Catch-all for unclassified internal errors.
    #[error("internal error: {0}")]
    Internal(String),
}

impl Error {
    /// Create a storage error.
    pub fn storage(msg: impl Into<String>) -> Self {
        Self::Storage(msg.into())
    }

    /// Create a device communication error.
    pub fn device(msg: impl Into<String>) -> Self {
        Self::DeviceCommunication(msg.into())
    }

    /// Create a validation error.
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    /// Create an authentication error.
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Authentication(msg.into())
    }

    /// Create a network error.
    pub fn network(msg: impl Into<String>) -> Self {
        Self::Network(msg.into())
    }

    /// Create a not-found error.
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    /// Create a duplicate error.
    pub fn duplicate(msg: impl Into<String>) -> Self {
        Self::Duplicate(msg.into())
    }

    /// Create a configuration error.
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Configuration(msg.into())
    }

    /// Create an internal error.
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

// Convenience conversions so existing code that returns `Err(format!(...))`
// or `Err("msg".to_string())` compiles with minimal changes.
//
// In trait implementations, prefer the explicit `Error::storage(...)` /
// `Error::device(...)` factory methods for clarity. The `From` impls
// are a migration aid and for quick internal-only code.

impl From<String> for Error {
    fn from(s: String) -> Self {
        Error::Internal(s)
    }
}

impl From<&str> for Error {
    fn from(s: &str) -> Self {
        Error::Internal(s.to_string())
    }
}
