//! Attendance analytics — value objects for aggregated attendance projections.
//!
//! These are read-model projections computed from the `WorkDay` aggregate.
//! They are pure data carriers, not domain aggregates — they express what
//! the data looks like after aggregation, not how attendance rules are enforced.

use jiff::civil::Date;

// ─── Daily / Weekly Aggregation ──────────────────────────────────────

/// One day's aggregated hours (regular + overtime).
#[derive(Debug, Clone, PartialEq)]
pub struct DailyHours {
    pub date: Date,
    pub regular_seconds: i64,
    pub overtime_seconds: i64,
}

impl DailyHours {
    pub fn total_seconds(&self) -> i64 {
        self.regular_seconds + self.overtime_seconds
    }

    pub fn total_hours_f64(&self) -> f64 {
        self.total_seconds() as f64 / 3600.0
    }
}

/// One ISO week's aggregated hours.
#[derive(Debug, Clone, PartialEq)]
pub struct WeeklyHours {
    pub year: i16,
    pub week: i8,
    pub total_seconds: i64,
}

impl WeeklyHours {
    pub fn total_hours_f64(&self) -> f64 {
        self.total_seconds as f64 / 3600.0
    }
}

// ─── Distribution ────────────────────────────────────────────────────

/// Count of work-days grouped by status (Full, Half, Absent).
#[derive(Debug, Clone, PartialEq)]
pub struct StatusDistribution {
    pub full_days: u64,
    pub half_days: u64,
    pub absent_days: u64,
}

impl StatusDistribution {
    pub fn total_employee_days(&self) -> u64 {
        self.full_days + self.half_days + self.absent_days
    }

    pub fn absence_rate_pct(&self) -> f64 {
        let total = self.total_employee_days();
        if total == 0 { 0.0 } else { self.absent_days as f64 / total as f64 * 100.0 }
    }

    pub fn full_pct(&self) -> f64 {
        let total = self.total_employee_days();
        if total == 0 { 0.0 } else { self.full_days as f64 / total as f64 * 100.0 }
    }

    pub fn half_pct(&self) -> f64 {
        let total = self.total_employee_days();
        if total == 0 { 0.0 } else { self.half_days as f64 / total as f64 * 100.0 }
    }
}

// ─── Employee KPIs ───────────────────────────────────────────────────

/// Per-employee attendance KPIs for a date range.
#[derive(Debug, Clone, PartialEq)]
pub struct EmployeeKpi {
    pub user_pin: String,
    pub days_present: u32,
    pub days_absent: u32,
    pub days_late: u32,
    pub total_regular_seconds: i64,
    pub total_overtime_seconds: i64,
    pub avg_seconds_per_day: i64,
}

impl EmployeeKpi {
    pub fn avg_hours_per_day_f64(&self) -> f64 {
        self.avg_seconds_per_day as f64 / 3600.0
    }
}

// ─── Monthly Trend ───────────────────────────────────────────────────

/// One month's attendance percentage data point.
#[derive(Debug, Clone, PartialEq)]
pub struct MonthlyTrendPoint {
    pub year: i16,
    pub month: i8,
    pub attendance_pct: f64,
}

// ─── Calendar Projection ─────────────────────────────────────────────

/// One calendar day in the attendance calendar view.
///
/// `status_code` encodes the day's attendance quality:
///
/// | Code | Meaning    |
/// |------|------------|
/// | 0    | Non-working (weekend / holiday) |
/// | 1    | Absent     |
/// | 2    | Late       |
/// | 3    | Half-day   |
/// | 4    | Present (full) |
#[derive(Debug, Clone, PartialEq)]
pub struct CalendarDay {
    pub date: Date,
    pub status_code: u8,
    pub hours: Option<f64>,
    pub is_working_day: bool,
}

// ─── Today Snapshot ──────────────────────────────────────────────────

/// An employee currently checked in.
#[derive(Debug, Clone, PartialEq)]
pub struct CheckedInEmployee {
    pub user_pin: String,
    pub check_in_epoch: i64,
}

/// Operational snapshot for the "right now" dashboard view.
///
/// This is the operational projection — "who's here right now?" —
/// as opposed to the analytical summary which answers "what happened
/// over time?" questions.
#[derive(Debug, Clone, PartialEq)]
pub struct TodaySnapshot {
    pub present: usize,
    pub absent: usize,
    pub late: usize,
    pub on_time: usize,
    pub currently_checked_in: Vec<CheckedInEmployee>,
    pub hourly_breakdown: [u32; 24],
}

#[cfg(test)]
mod tests {
    use super::*;
    use jiff::civil::Date;

    #[test]
    fn daily_hours_total() {
        let dh = DailyHours {
            date: Date::new(2026, 7, 10).unwrap(),
            regular_seconds: 28_800,
            overtime_seconds: 7_200,
        };
        assert_eq!(dh.total_seconds(), 36_000);
        assert!((dh.total_hours_f64() - 10.0).abs() < 0.01);
    }

    #[test]
    fn status_distribution_rates() {
        let sd = StatusDistribution { full_days: 80, half_days: 10, absent_days: 10 };
        assert_eq!(sd.total_employee_days(), 100);
        assert!((sd.absence_rate_pct() - 10.0).abs() < 0.01);
        assert!((sd.full_pct() - 80.0).abs() < 0.01);
        assert!((sd.half_pct() - 10.0).abs() < 0.01);
    }

    #[test]
    fn status_distribution_zero_does_not_divide_by_zero() {
        let sd = StatusDistribution { full_days: 0, half_days: 0, absent_days: 0 };
        assert_eq!(sd.absence_rate_pct(), 0.0);
        assert_eq!(sd.full_pct(), 0.0);
    }

    #[test]
    fn employee_kpi_avg_hours() {
        let ek = EmployeeKpi {
            user_pin: "145".into(),
            days_present: 20,
            days_absent: 2,
            days_late: 3,
            total_regular_seconds: 144_000, // 40 hours
            total_overtime_seconds: 18_000, //  5 hours
            avg_seconds_per_day: 7_200,     //  2 hours
        };
        assert!((ek.avg_hours_per_day_f64() - 2.0).abs() < 0.01);
    }

    #[test]
    fn weekly_hours_hours() {
        let wh = WeeklyHours { year: 2026, week: 28, total_seconds: 144_000 };
        assert!((wh.total_hours_f64() - 40.0).abs() < 0.01);
    }
}
