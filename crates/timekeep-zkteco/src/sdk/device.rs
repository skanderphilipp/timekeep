//! High-level device operations for the ZKTeco SDK.
//!
//! Maps the protocol's binary commands into the domain model
//! types defined by `timekeep-core`.
//!
//! Note: The core connection and data exchange logic now lives in
//! `connection.rs`. This module provides re-exports and any additional
//! device-level abstractions.

pub use super::connection::{DeviceSizes, FingerprintTemplate, NetworkParams};
