#![allow(dead_code)]
//! Re-exports the public simulator API from timekeep-zkteco,
//! plus the test-only ADMS device simulator.
//!
//! Tests should `use timekeep_zkteco::simulator::*;` for SDK simulation
//! and `use crate::simulator::adms::*;` for ADMS simulation.

pub mod adms;

// Re-export everything from the library simulator module so existing
// tests that `use simulator::*` still work.
pub use timekeep_zkteco::simulator::*;
