//! # timekeep
//!
//! Application bootstrapping and lifecycle for timekeep.
//!
//! This crate is both a library (exposing testable startup logic)
//! and a binary (the `main` entry point).

pub mod fingerprint_transfer;
pub mod outbox_worker;
pub mod sync;
