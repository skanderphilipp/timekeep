//! Wiring sub-modules — extracted from the monolithic `wire()` function.
//!
//! | Module | Responsibility |
//! |--------|---------------|
//! | `composition` | `wire()` orchestrator, `AppDependencies`, storage/distributor init |
//! | `device_connect` | Device connection, poll loop, runtime registration, discovery |
//! | `event_handlers` | Domain event handling (user ops, sync, commands, attendance, device info) |

pub(crate) mod composition;
pub(crate) mod device_connect;
pub(crate) mod event_handlers;

// Re-export the public API from composition so main.rs can use `wiring::wire()` etc.
pub(crate) use composition::{AppDependencies, DeviceRegistry, wire};
