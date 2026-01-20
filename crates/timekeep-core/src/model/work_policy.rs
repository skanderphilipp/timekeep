//! Work policy — the rules that define what a work day looks like.

use jiff::civil::Time;
use serde::{Deserialize, Serialize};

/// Rules defining work schedule, late thresholds, and working days.
///
/// Persisted in system settings to control how attendance is evaluated
/// across the entire application: late detection, absence calculation,
/// overtime tracking, and report aggregation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkPolicy {
    /// Expected work start time (e.g., 08:00).
    pub work_start: Time,
    /// Expected work end time (e.g., 17:00).
    pub work_end: Time,
    /// Grace period in seconds after work_start before an arrival is
    /// considered late (default: 900 = 15 minutes).
    pub late_threshold_secs: i64,
    /// Minimum seconds of work required for a day to count as "present"
    /// rather than "half day" (default: 14400 = 4 hours).
    pub min_seconds_for_present: i64,
    /// Seconds of work after which overtime starts accumulating
    /// (default: 28800 = 8 hours).
    pub daily_overtime_after_secs: i64,
    /// Which days of the week are working days.
    /// Index 0 = Monday, 6 = Sunday.
    /// Days not in this set are excluded from absence calculations.
    #[serde(default = "default_working_days")]
    pub working_days: [bool; 7],
}

fn default_working_days() -> [bool; 7] {
    // Mon–Fri
    [true, true, true, true, true, false, false]
}

impl WorkPolicy {
    pub fn standard_9to5() -> Self {
        Self {
            work_start: Time::new(9, 0, 0, 0).expect("09:00 is valid"),
            work_end: Time::new(17, 0, 0, 0).expect("17:00 is valid"),
            late_threshold_secs: 15 * 60,
            min_seconds_for_present: 4 * 3600,
            daily_overtime_after_secs: 8 * 3600,
            working_days: default_working_days(),
        }
    }

    pub fn flexible(min_hours: i64) -> Self {
        Self {
            work_start: Time::new(0, 0, 0, 0).expect("00:00 is valid"),
            work_end: Time::new(23, 59, 59, 0).expect("23:59:59 is valid"),
            late_threshold_secs: 0,
            min_seconds_for_present: min_hours * 3600,
            daily_overtime_after_secs: 24 * 3600,
            working_days: default_working_days(),
        }
    }

    /// Whether the given weekday (0=Monday, 6=Sunday) is a working day.
    pub fn is_working_day(&self, weekday: u8) -> bool {
        if weekday >= 7 {
            return false;
        }
        self.working_days[weekday as usize]
    }

    /// Count working days between two dates (inclusive).
    pub fn count_working_days(&self, from: jiff::civil::Date, to: jiff::civil::Date) -> u32 {
        let mut count = 0;
        let mut current = from;
        loop {
            // weekday() returns the ISO weekday (Monday=1..Sunday=7), convert to 0-indexed
            let weekday = (current.weekday().to_monday_zero_offset() as u8) % 7;
            if self.is_working_day(weekday) {
                count += 1;
            }
            if current >= to {
                break;
            }
            current = match current.tomorrow() {
                Ok(d) => d,
                Err(_) => break,
            };
        }
        count
    }

    pub fn expected_seconds(&self) -> i64 {
        let start_minutes = self.work_start.hour() as i64 * 60 + self.work_start.minute() as i64;
        let end_minutes = self.work_end.hour() as i64 * 60 + self.work_end.minute() as i64;
        let diff_minutes = if end_minutes >= start_minutes {
            end_minutes - start_minutes
        } else {
            (24 * 60 - start_minutes) + end_minutes
        };
        diff_minutes * 60
    }

    /// Whether a given arrival time is considered late under this policy.
    ///
    /// Flexible policies (midnight start, zero threshold) never consider
    /// any arrival as late.
    pub fn is_late(&self, arrival: Time) -> bool {
        // Midnight start with zero threshold = no fixed schedule → never late
        if self.work_start.hour() == 0
            && self.work_start.minute() == 0
            && self.late_threshold_secs == 0
        {
            return false;
        }

        let deadline_seconds = self.work_start.hour() as i64 * 3600
            + self.work_start.minute() as i64 * 60
            + self.late_threshold_secs;
        let arrival_seconds = arrival.hour() as i64 * 3600 + arrival.minute() as i64 * 60;
        arrival_seconds > deadline_seconds
    }

    pub fn is_early_leave(&self, departure: Time) -> bool {
        let departure_seconds = departure.hour() as i64 * 3600 + departure.minute() as i64 * 60;
        let end_seconds = self.work_end.hour() as i64 * 3600 + self.work_end.minute() as i64 * 60;
        departure_seconds < end_seconds
    }
}

impl Default for WorkPolicy {
    fn default() -> Self {
        Self::standard_9to5()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_policy_not_late_within_grace() {
        let policy = WorkPolicy::standard_9to5();
        // 09:14 is within the 15-minute grace period
        assert!(!policy.is_late(Time::new(9, 14, 0, 0).unwrap()));
    }

    #[test]
    fn standard_policy_late_after_grace() {
        let policy = WorkPolicy::standard_9to5();
        assert!(policy.is_late(Time::new(9, 16, 0, 0).unwrap()));
    }

    #[test]
    fn standard_policy_early_leave() {
        let policy = WorkPolicy::standard_9to5();
        assert!(policy.is_early_leave(Time::new(16, 30, 0, 0).unwrap()));
    }

    #[test]
    fn standard_policy_not_early_leave_at_end() {
        let policy = WorkPolicy::standard_9to5();
        assert!(!policy.is_early_leave(Time::new(17, 0, 0, 0).unwrap()));
    }

    #[test]
    fn expected_hours_standard() {
        let policy = WorkPolicy::standard_9to5();
        assert_eq!(policy.expected_seconds(), 8 * 3600);
    }

    #[test]
    fn flexible_policy_never_late() {
        let policy = WorkPolicy::flexible(4);
        // Any time is fine with flexible schedule
        assert!(!policy.is_late(Time::new(10, 0, 0, 0).unwrap()));
        assert!(!policy.is_late(Time::new(14, 30, 0, 0).unwrap()));
        assert!(!policy.is_late(Time::new(6, 0, 0, 0).unwrap()));
    }

    #[test]
    fn overnight_shift_expected_hours() {
        let policy = WorkPolicy {
            work_start: Time::new(22, 0, 0, 0).unwrap(),
            work_end: Time::new(6, 0, 0, 0).unwrap(),
            ..WorkPolicy::standard_9to5()
        };
        assert_eq!(policy.expected_seconds(), 8 * 3600);
    }

    #[test]
    fn policy_equality() {
        let p1 = WorkPolicy::standard_9to5();
        let p2 = WorkPolicy::standard_9to5();
        assert_eq!(p1, p2);
    }
}
