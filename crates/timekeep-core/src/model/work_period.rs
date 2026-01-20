//! Work period — one continuous block of attendance within a work day.

use jiff::Timestamp;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeriodKind {
    Regular,
    Break,
    Overtime,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkPeriod {
    pub check_in: Timestamp,
    pub check_out: Option<Timestamp>,
    pub duration_secs: i64,
    pub kind: PeriodKind,
}

impl WorkPeriod {
    pub fn open(check_in: Timestamp, kind: PeriodKind) -> Self {
        Self { check_in, check_out: None, duration_secs: 0, kind }
    }

    pub fn closed(check_in: Timestamp, check_out: Timestamp, kind: PeriodKind) -> Option<Self> {
        let signed = check_out.duration_since(check_in);
        let secs = signed.as_secs();
        if secs < 0 {
            return None;
        }
        Some(Self { check_in, check_out: Some(check_out), duration_secs: secs, kind })
    }

    pub fn total_minutes(&self) -> i64 {
        self.duration_secs / 60
    }

    pub fn total_seconds(&self) -> i64 {
        self.duration_secs
    }

    pub fn is_open(&self) -> bool {
        self.check_out.is_none()
    }

    /// Resolve the check-in wall-clock time in UTC.
    pub fn check_in_time_utc(&self) -> Option<jiff::civil::Time> {
        let zoned = self.check_in.to_zoned(jiff::tz::TimeZone::UTC);
        Some(zoned.datetime().time())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ts(secs: i64) -> Timestamp {
        Timestamp::from_second(secs).unwrap()
    }

    #[test]
    fn open_period_no_duration() {
        let period = WorkPeriod::open(ts(1000), PeriodKind::Regular);
        assert!(period.is_open());
        assert_eq!(period.duration_secs, 0);
    }

    #[test]
    fn closed_period_duration() {
        let period = WorkPeriod::closed(ts(3600), ts(7200), PeriodKind::Regular).unwrap();
        assert!(!period.is_open());
        assert_eq!(period.duration_secs, 3600);
        assert_eq!(period.total_minutes(), 60);
    }

    #[test]
    fn rejects_negative_duration() {
        assert!(WorkPeriod::closed(ts(7200), ts(3600), PeriodKind::Regular).is_none());
    }

    #[test]
    fn break_period_minutes() {
        let period = WorkPeriod::closed(ts(14400), ts(14400 + 1800), PeriodKind::Break).unwrap();
        assert_eq!(period.total_minutes(), 30);
    }

    #[test]
    fn check_in_time_utc_resolves() {
        // Unix epoch + 8 hours = 1970-01-01 08:00:00 UTC (definitively 08:00)
        let ts = Timestamp::from_second(28800).unwrap();
        let period = WorkPeriod::open(ts, PeriodKind::Regular);
        let time = period.check_in_time_utc().unwrap();
        assert_eq!(time.hour(), 8, "28800 seconds from epoch = 08:00 UTC");
    }
}
