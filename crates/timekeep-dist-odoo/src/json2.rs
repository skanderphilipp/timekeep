//! Shared types for the Odoo JSON-2 REST API.
//! Used by both the distributor and the sync worker.

use serde::Deserialize;

/// Odoo JSON-2 API response wrapper.
#[derive(Debug, Deserialize)]
pub(crate) struct Json2Response<T> {
    pub result: Option<T>,
    pub error: Option<Json2Error>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Json2Error {
    #[allow(dead_code)]
    pub message: String,
    #[allow(dead_code)]
    pub code: i32,
}

/// Employee lookup result cached after first API call.
#[derive(Debug, Clone)]
pub(crate) struct EmployeeInfo {
    pub id: i64,
    pub name: String,
}
