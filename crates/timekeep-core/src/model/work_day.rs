//! Work day — the central aggregate for attendance.
//!
//! A `WorkDay` represents one user's attendance on one calendar date.
//! It pairs raw punches into work periods, computes total hours, and
//! detects anomalies. This is where the business rules live.

use jiff::Timestamp;
use jiff::civil::Date;
use std::fmt;

use super::anomaly::Anomaly;
use super::work_period::{PeriodKind, WorkPeriod};
use super::work_policy::WorkPolicy;

/// The attendance status for a single work day.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DayStatus {
    Present,
    HalfDay,
    Late,
    EarlyLeave,
    Absent,
    Holiday,
}

impl fmt::Display for DayStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Present => write!(f, "Present"),
            Self::HalfDay => write!(f, "Half Day"),
            Self::Late => write!(f, "Late"),
            Self::EarlyLeave => write!(f, "Early Leave"),
            Self::Absent => write!(f, "Absent"),
            Self::Holiday => write!(f, "Holiday"),
        }
    }
}

/// One user's attendance for one calendar date.
///
/// All duration fields are in seconds because `jiff::Span` does not implement
/// `PartialEq` in jiff 0.2.
#[derive(Debug, Clone)]
pub struct WorkDay {
    pub date: Date,
    pub user_pin: String,
    pub periods: Vec<WorkPeriod>,
    pub first_punch: Timestamp,
    pub last_punch: Option<Timestamp>,
    pub total_regular_seconds: i64,
    pub total_break_seconds: i64,
    pub total_overtime_seconds: i64,
    pub status: DayStatus,
    pub anomalies: Vec<Anomaly>,
}

impl WorkDay {
    /// Create a `WorkDay` from already-paired periods and a policy.
    ///
    /// Returns `None` if the periods vector is empty (no data for this day).
    pub fn from_periods(
        date: Date,
        user_pin: impl Into<String>,
        periods: Vec<WorkPeriod>,
        policy: &WorkPolicy,
    ) -> Option<Self> {
        if periods.is_empty() {
            return None;
        }

        let first_punch = periods.first().unwrap().check_in;
        let last_punch = periods.iter().rev().find_map(|p| p.check_out);

        let mut total_regular = 0i64;
        let mut total_break = 0i64;
        let mut total_overtime = 0i64;

        for period in &periods {
            let secs = period.total_seconds();
            match period.kind {
                PeriodKind::Regular => total_regular = total_regular.saturating_add(secs),
                PeriodKind::Break => total_break = total_break.saturating_add(secs),
                PeriodKind::Overtime => total_overtime = total_overtime.saturating_add(secs),
            }
        }

        let status = Self::compute_status(&periods, total_regular, policy);

        Some(Self {
            date,
            user_pin: user_pin.into(),
            first_punch,
            last_punch,
            periods,
            total_regular_seconds: total_regular,
            total_break_seconds: total_break,
            total_overtime_seconds: total_overtime,
            status,
            anomalies: Vec::new(),
        })
    }

    fn compute_status(
        periods: &[WorkPeriod],
        total_regular_seconds: i64,
        policy: &WorkPolicy,
    ) -> DayStatus {
        let mut has_late = false;
        let mut has_early_leave = false;

        // Check for late arrival (first regular period's check-in time)
        if let Some(first_regular) = periods.iter().find(|p| p.kind == PeriodKind::Regular)
            && let Some(check_in_time) = first_regular.check_in_time_utc()
            && policy.is_late(check_in_time)
        {
            has_late = true;
        }

        // Check for early leave (last regular period's check-out time)
        if let Some(last_regular) = periods.iter().rev().find(|p| p.kind == PeriodKind::Regular)
            && let Some(check_out) = last_regular.check_out
        {
            let zoned = check_out.to_zoned(jiff::tz::TimeZone::UTC);
            if policy.is_early_leave(zoned.datetime().time()) {
                has_early_leave = true;
            }
        }

        let status = if has_late {
            DayStatus::Late
        } else if has_early_leave {
            DayStatus::EarlyLeave
        } else {
            DayStatus::Present
        };

        // Downgrade to HalfDay if all periods are closed and hours are below minimum
        let all_closed = periods.iter().all(|p| !p.is_open());
        if all_closed && total_regular_seconds < policy.min_seconds_for_present {
            return DayStatus::HalfDay;
        }

        status
    }

    pub fn is_present_now(&self) -> bool {
        self.periods.iter().any(|p| p.kind == PeriodKind::Regular && p.is_open())
    }

    pub fn regular_hours_f64(&self) -> f64 {
        self.total_regular_seconds as f64 / 3600.0
    }

    pub fn overtime_hours_f64(&self) -> f64 {
        self.total_overtime_seconds as f64 / 3600.0
    }

    pub fn break_minutes(&self) -> i64 {
        self.total_break_seconds / 60
    }

    /// Net work time = regular time minus break time (in seconds).
    /// This is the actual time spent working, excluding breaks.
    pub fn net_work_seconds(&self) -> i64 {
        (self.total_regular_seconds - self.total_break_seconds).max(0)
    }

    pub fn summary(&self) -> String {
        format!(
            "{} {}: {:.1}h regular, {:.1}h OT, {}",
            self.date,
            self.user_pin,
            self.regular_hours_f64(),
            self.overtime_hours_f64(),
            self.status,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jiff::civil::{Date, DateTime, Time};

    /// Build a UTC timestamp at a specific civil date and time.
    fn timestamp_at(date: Date, time: Time) -> Timestamp {
        DateTime::from_parts(date, time)
            .to_zoned(jiff::tz::TimeZone::UTC)
            .expect("valid UTC datetime")
            .timestamp()
    }

    fn test_date() -> Date {
        Date::new(2026, 7, 10).unwrap()
    }

    fn time(h: i8, m: i8, s: i8) -> Time {
        Time::new(h, m, s, 0).unwrap()
    }

    #[test]
    fn from_periods_rejects_empty() {
        let policy = WorkPolicy::standard_9to5();
        assert!(WorkDay::from_periods(test_date(), "145", vec![], &policy).is_none());
    }

    #[test]
    fn full_day_present() {
        let policy = WorkPolicy::standard_9to5();
        let check_in = timestamp_at(test_date(), time(9, 0, 0));
        let check_out = timestamp_at(test_date(), time(17, 0, 0));
        let periods = vec![WorkPeriod::closed(check_in, check_out, PeriodKind::Regular).unwrap()];
        let day = WorkDay::from_periods(test_date(), "145", periods, &policy).unwrap();

        assert_eq!(day.status, DayStatus::Present);
        assert_eq!(day.regular_hours_f64(), 8.0);
        assert!(!day.is_present_now());
    }

    #[test]
    fn open_period_present_now() {
        let policy = WorkPolicy::standard_9to5();
        let check_in = timestamp_at(test_date(), time(9, 15, 0));
        let periods = vec![WorkPeriod::open(check_in, PeriodKind::Regular)];
        let day = WorkDay::from_periods(test_date(), "145", periods, &policy).unwrap();

        // Open period → not half-day, and within late grace
        assert_eq!(day.status, DayStatus::Present);
        assert!(day.is_present_now());
    }

    #[test]
    fn break_not_counted_as_regular() {
        let policy = WorkPolicy::standard_9to5();
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 0, 0)),
                timestamp_at(d, time(12, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
            WorkPeriod::closed(
                timestamp_at(d, time(12, 0, 0)),
                timestamp_at(d, time(12, 30, 0)),
                PeriodKind::Break,
            )
            .unwrap(),
            WorkPeriod::closed(
                timestamp_at(d, time(12, 30, 0)),
                timestamp_at(d, time(17, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();

        // Regular: 3h + 4.5h = 7.5h (but total is 8h if we add incorrectly)
        // 9:00-12:00 = 3h, 12:30-17:00 = 4.5h, total = 7.5h regular
        assert!(
            (day.regular_hours_f64() - 7.5).abs() < 0.01,
            "expected 7.5h regular, got {}",
            day.regular_hours_f64()
        );
        assert_eq!(day.break_minutes(), 30);
        assert_eq!(day.status, DayStatus::Present);
    }

    #[test]
    fn half_day_when_below_minimum() {
        let mut policy = WorkPolicy::standard_9to5();
        policy.min_seconds_for_present = 6 * 3600;
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 0, 0)),
                timestamp_at(d, time(12, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();
        assert_eq!(day.status, DayStatus::HalfDay);
    }

    #[test]
    fn late_detection() {
        let mut policy = WorkPolicy::standard_9to5();
        policy.late_threshold_secs = 15 * 60;
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 20, 0)), // 09:20 = late
                timestamp_at(d, time(17, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();
        assert_eq!(day.status, DayStatus::Late);
    }

    #[test]
    fn overtime_accumulation() {
        let policy = WorkPolicy::standard_9to5();
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 0, 0)),
                timestamp_at(d, time(17, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
            WorkPeriod::closed(
                timestamp_at(d, time(17, 0, 0)),
                timestamp_at(d, time(19, 0, 0)),
                PeriodKind::Overtime,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();

        assert!(day.total_overtime_seconds > 0);
        assert_eq!(day.overtime_hours_f64(), 2.0);
    }

    #[test]
    fn summary_formatting() {
        let policy = WorkPolicy::standard_9to5();
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 0, 0)),
                timestamp_at(d, time(17, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();
        let s = day.summary();
        assert!(s.contains("145"), "summary should contain user PIN");
        assert!(s.contains("Present"), "summary should contain status, got: {}", s);
    }

    #[test]
    fn day_status_display() {
        assert_eq!(DayStatus::Present.to_string(), "Present");
        assert_eq!(DayStatus::Late.to_string(), "Late");
        assert_eq!(DayStatus::Absent.to_string(), "Absent");
    }

    #[test]
    fn on_time_within_grace_is_not_late() {
        let mut policy = WorkPolicy::standard_9to5();
        policy.late_threshold_secs = 15 * 60;
        let d = test_date();
        let periods = vec![
            WorkPeriod::closed(
                timestamp_at(d, time(9, 14, 0)), // 09:14 — within grace
                timestamp_at(d, time(17, 0, 0)),
                PeriodKind::Regular,
            )
            .unwrap(),
        ];
        let day = WorkDay::from_periods(d, "145", periods, &policy).unwrap();
        assert_eq!(
            day.status,
            DayStatus::Present,
            "arriving at 09:14 with 15min grace should not be late"
        );
    }
}
