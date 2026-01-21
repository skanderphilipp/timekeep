//! Domain services — stateless operations over the attendance domain model.
//!
//! Unlike aggregates, domain services don't own state. They embody business
//! logic that doesn't naturally fit on any single entity: pairing raw punches,
//! detecting cross-day anomalies, computing aggregated statistics.

pub mod attendance_calculator;
