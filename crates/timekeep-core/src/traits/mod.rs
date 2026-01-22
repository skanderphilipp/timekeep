pub mod biometric_device;
pub mod config_provider;
pub mod distributor;
pub mod employee_repository;
pub mod provider_registry;
pub mod storage;

// Re-export for convenience
pub use distributor::Distributor;
pub use employee_repository::EmployeeRepository;
pub use provider_registry::DeviceProvider;
pub use storage::Storage;
