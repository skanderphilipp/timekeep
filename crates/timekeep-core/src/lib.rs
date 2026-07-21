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
//! - [`traits`] — Contracts: `BiometricDevice`, `Storage`, `Distributor`, `DeviceProvider`,
//!   and focused `*Store` traits (see ADR-001)
//! - [`events`] — `DomainEvent` enum and event bus abstraction
//! - [`services`] — Domain services: `AttendanceCalculator` (punch pairing, anomaly detection)
//! - [`provider_registry`] — Runtime provider registry for multi-vendor routing
//! - [`test_utils`] — Shared test factories and mocks (behind `test-utils` feature)

pub mod error;
pub mod events;
pub mod facet;
pub mod model;
pub mod network_scanner;
pub mod provider_manifest;
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
    Department,
    DepartmentId,
    DeviceConfig,
    DeviceGroup,
    DeviceGroupId,
    IntegrationEndpoint,
    IntegrationKind,
    PermissionSet,
    Role,
    SystemSettings,
    // Attendance domain — work day computation
    anomaly::Anomaly,
    attendance_analytics::{
        CalendarDay, CheckedInEmployee, DailyHours, EmployeeKpi, MonthlyTrendPoint,
        StatusDistribution, TodaySnapshot, WeeklyHours,
    },
    device::{Device, DeviceStatus, DeviceVendor},
    device_event::{DeviceEvent, DeviceEventType},
    employee::{Employee, EmployeeId},
    enrollment::{BiometricType, DeviceEnrollment, FingerprintTemplate},
    onboarding::{
        DeviceFingerStatus, DeviceStepData, EmployeeStepData, FingerEnrollStatus,
        OnboardingSession, OnboardingSessionLog, OnboardingStatus, OnboardingStepAction,
        OnboardingType, device_steps, employee_steps,
    },
    oplog::{OperationLog, OperationType},
    pending_delivery::PendingDelivery,
    provider::{DeviceProbe, ProviderCapabilities, ProviderInfo},
    punch::{AttendancePunch, PunchStatus, VerifyMode},
    user::User,
    work_day::{DayStatus, WorkDay},
    work_period::{PeriodKind, WorkPeriod},
    work_policy::WorkPolicy,
};

pub use provider_manifest::ProviderManifest;
pub use provider_registry::ProviderRegistry;

pub use facet::{
    FacetContext, FacetDimension, FacetGroup, FacetKind, FacetOption, FacetQuery,
    audit_facet_dimensions, department_facet_dimensions, device_facet_dimensions,
    employee_facet_dimensions, punch_facet_dimensions,
};
pub use query::cursor::{Cursor, CursorValue, decode_cursor, encode_cursor, encode_offset_cursor};
pub use query::field_selector::{FieldSelector, IncludeDirective};
pub use query::filters::{
    DeviceEventFilter, DeviceFilter, EmployeeFilter, EndpointFilter, PunchCriteria, PunchFilter,
};
pub use query::schema::{
    AUDIT_SCHEMA, ColumnMeta, CursorValueType, DEPARTMENT_SCHEMA, DEVICE_SCHEMA, EMPLOYEE_SCHEMA,
    EntitySchema, PUNCH_SCHEMA, WORK_POLICY_TEMPLATE_SCHEMA, entity_schema,
};
pub use query::search::{SearchHit, SearchQuery, SearchResults};
pub use query::{ListParams, ListResult, SortOrder, sanitize_search};

pub use traits::{
    ApiKeyStore, AuditLogStore, BiometricDevice, ConfigProvider, DashboardUserStore,
    DepartmentStore, DeviceConfigStore, DeviceGroupStore, DeviceInfoStore, DeviceProvider,
    DeviceUserStore, Distributor, EmployeeStore, EndpointStore, OnboardingSessionStore,
    OutboxStore, PunchStore, SearchStore, SettingsStore, Storage,
};

pub use events::{DomainEvent, EventBus};

pub use services::attendance_calculator::AttendanceCalculator;
