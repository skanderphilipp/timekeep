//! Attendance anomalies — domain events detected during punch processing.
//!
//! Anomalies are not errors (they don't prevent punch storage). They are
//! observations about the data that an HR operator needs to review:
//! a missing check-out that needs manual correction, a suspicious sequence
//! that might indicate buddy punching, etc.

use jiff::Timestamp;

/// A detected irregularity in attendance data.
///
/// Anomalies are computed during the pairing process and attached to
/// the `WorkDay` aggregate. They persist alongside the data and can
/// be queried, resolved, or dismissed by an operator.
///
/// Note: `Eq` is not derived because the `UnusualHours` variant contains
/// `f64` which does not implement `Eq`. All other variants are `Eq`-compatible.
#[derive(Debug, Clone, PartialEq)]
pub enum Anomaly {
    /// A check-out was recorded without a corresponding check-in.
    /// This usually means a check-in was missed (device error, power outage).
    OrphanedCheckOut {
        /// When the orphaned check-out occurred.
        timestamp: Timestamp,
    },

    /// Two check-ins were recorded in a row without a check-out between them.
    /// Could be a missed check-out or buddy punching.
    DuplicateCheckIn {
        /// The first check-in (the one that was never closed).
        first: Timestamp,
        /// The second check-in (anomalous because the first was never closed).
        second: Timestamp,
    },

    /// A check-in was never followed by a check-out.
    /// The employee appears to still be working (or the check-out was missed).
    MissingCheckOut {
        /// The unclosed check-in.
        check_in: Timestamp,
    },

    /// The total work hours for the day are unusually low or high.
    UnusualHours {
        /// The total hours recorded (as seconds for precision).
        total_seconds: i64,
        /// A human-readable reason for the flag.
        reason: String,
    },

    /// Two punches from different devices within a very short window,
    /// suggesting someone else may have punched for the employee.
    BuddyPunchCandidate {
        /// First device that recorded a punch.
        first_device: String,
        /// Second device that recorded a punch.
        second_device: String,
        /// Time difference between the two punches (seconds).
        within_seconds: i64,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anomaly_variants_are_send_sync() {
        // Anomalies must be shareable across async boundaries
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<Anomaly>();
    }

    #[test]
    fn orphaned_checkout_equality() {
        let ts = jiff::Timestamp::from_second(1750600000).unwrap();
        let a1 = Anomaly::OrphanedCheckOut { timestamp: ts };
        let a2 = Anomaly::OrphanedCheckOut { timestamp: ts };
        assert_eq!(a1, a2);
    }
}
