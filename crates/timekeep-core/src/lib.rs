//! # timekeep-core
//!
//! Domain model, traits, and events for the timekeep platform.
//!
//! This crate defines the shared contract that all providers, storages,
//! and distributors implement. It contains zero I/O or external service
//! dependencies — pure domain logic.
//!
//! ## Layers
//!
//! - [`model`] — Domain aggregates: `Punch`, `User`, `Device`, `WorkDay`, `WorkPeriod`
//! - [`traits`] — Contracts: `BiometricDevice`, `Storage`, `Distributor`, `DeviceProvider`
//! - [`events`] — `DomainEvent` enum and event bus abstraction
//! - [`services`] — Domain services: `AttendanceCalculator` (punch pairing, anomaly detection)
//! - [`provider_registry`] — Runtime provider registry for multi-vendor routing
//! - [`test_utils`] — Shared test factories and mocks (behind `test-utils` feature)

pub mod error;
pub mod events;
pub mod facet;
pub mod model;
pub mod network_scanner;
pub mod provider_registry;
pub mod query;
pub mod services;
pub mod traits;

/// Shared test utilities: `PunchRow`, `NoopStorage`, `NoopEmployeeRepo`, `make_test_punch`.
/// Only compiled when the `test-utils` feature is enabled — production
/// builds get zero-cost exclusion.
#[cfg(feature = "test-utils")]
pub mod test_utils;

// Re-export the most commonly used types
pub use error::Error;
pub use model::{
    ApiKey,
    AuditEvent,
    AuditFilter,
    DashboardUser,
    DeviceConfig,
    IntegrationEndpoint,
    IntegrationKind,
    PermissionSet,
    Role,
    SystemSettings,
    // Attendance domain — work day computation
    anomaly::Anomaly,
    device::{Device, DeviceStatus, DeviceVendor},
    device_event::{DeviceEvent, DeviceEventType},
    employee::{Employee, EmployeeId},
    enrollment::{BiometricType, DeviceEnrollment},
    oplog::{OperationLog, OperationType},
    provider::{DeviceProbe, ProviderCapabilities, ProviderInfo},
    punch::{AttendancePunch, PunchStatus, VerifyMode},
    user::User,
    work_day::{DayStatus, WorkDay},
    work_period::{PeriodKind, WorkPeriod},
    work_policy::WorkPolicy,
};

pub use provider_registry::ProviderRegistry;

pub use facet::{
    FacetContext, FacetDimension, FacetGroup, FacetKind, FacetOption, FacetQuery,
    punch_facet_dimensions,
};
pub use query::{ListParams, ListResult, SortOrder, sanitize_search};

pub use traits::{
    biometric_device::BiometricDevice,
    config_provider::ConfigProvider,
    distributor::Distributor,
    employee_repository::EmployeeRepository,
    provider_registry::DeviceProvider,
    storage::{DeviceEventFilter, DeviceFilter, EndpointFilter, PunchFilter, Storage},
};

pub use events::{DomainEvent, EventBus};

pub use services::attendance_calculator::AttendanceCalculator;
