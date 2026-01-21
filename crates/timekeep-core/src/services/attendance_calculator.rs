//! Attendance calculator — the core domain service for attendance business logic.
//!
//! This service is stateless. It takes raw punches and a work policy,
//! applies the domain rules (pairing, hour computation, anomaly detection),
//! and returns `WorkDay` aggregates.

use jiff::civil::Date;

use crate::model::anomaly::Anomaly;
use crate::model::work_day::WorkDay;
use crate::model::work_period::{PeriodKind, WorkPeriod};
use crate::model::work_policy::WorkPolicy;
use crate::model::{AttendancePunch, PunchStatus};

pub struct AttendanceCalculator;

impl AttendanceCalculator {
    /// Compute `WorkDay` aggregates from raw punches, grouped by (user_pin, date).
    pub fn compute_work_days(punches: &[AttendancePunch], policy: &WorkPolicy) -> Vec<WorkDay> {
        let mut groups: std::collections::BTreeMap<(String, Date), Vec<&AttendancePunch>> =
            std::collections::BTreeMap::new();

        for punch in punches {
            if let Some(date) = Self::punch_date_utc(punch) {
                groups.entry((punch.user_pin.clone(), date)).or_default().push(punch);
            }
        }

        let mut work_days = Vec::new();

        for ((user_pin, date), mut day_punches) in groups {
            day_punches.sort_by_key(|p| p.timestamp);

            let (periods, anomalies) = Self::pair_punches(&day_punches);

            if let Some(mut work_day) = WorkDay::from_periods(date, &user_pin, periods, policy) {
                work_day.anomalies = anomalies;
                work_days.push(work_day);
            }
        }

        work_days.sort_by(|a, b| a.date.cmp(&b.date).then_with(|| a.user_pin.cmp(&b.user_pin)));

        work_days
    }

    /// Compute a single `WorkDay` for one user on one date.
    pub fn compute_work_day(
        punches: &[AttendancePunch],
        user_pin: &str,
        date: Date,
        policy: &WorkPolicy,
    ) -> Option<WorkDay> {
        let mut filtered: Vec<&AttendancePunch> = punches
            .iter()
            .filter(|p| p.user_pin == user_pin && Self::punch_date_utc(p) == Some(date))
            .collect();

        if filtered.is_empty() {
            return None;
        }

        filtered.sort_by_key(|p| p.timestamp);

        let (periods, anomalies) = Self::pair_punches(&filtered);

        WorkDay::from_periods(date, user_pin, periods, policy).map(|mut wd| {
            wd.anomalies = anomalies;
            wd
        })
    }

    // ── Private ────────────────────────────────────────────────────

    fn punch_date_utc(punch: &AttendancePunch) -> Option<Date> {
        let zoned = punch.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
        Some(zoned.datetime().date())
    }

    /// The core pairing algorithm. Walks sorted punches and pairs them
    /// into work periods by matching open/close markers.
    fn pair_punches(punches: &[&AttendancePunch]) -> (Vec<WorkPeriod>, Vec<Anomaly>) {
        let mut periods: Vec<WorkPeriod> = Vec::new();
        let mut anomalies: Vec<Anomaly> = Vec::new();

        let mut open_regular: Option<&AttendancePunch> = None;
        let mut open_break: Option<&AttendancePunch> = None;
        let mut open_overtime: Option<&AttendancePunch> = None;

        for punch in punches {
            match punch.status {
                PunchStatus::CheckIn => {
                    if let Some(prev) = open_regular.take() {
                        anomalies.push(Anomaly::DuplicateCheckIn {
                            first: prev.timestamp,
                            second: punch.timestamp,
                        });
                        if let Some(period) =
                            WorkPeriod::closed(prev.timestamp, punch.timestamp, PeriodKind::Regular)
                        {
                            periods.push(period);
                        }
                    }
                    open_regular = Some(punch);
                },
                PunchStatus::CheckOut => {
                    if let Some(check_in) = open_regular.take() {
                        if let Some(period) = WorkPeriod::closed(
                            check_in.timestamp,
                            punch.timestamp,
                            PeriodKind::Regular,
                        ) {
                            periods.push(period);
                        } else {
                            periods.push(WorkPeriod {
                                check_in: check_in.timestamp,
                                check_out: Some(punch.timestamp),
                                duration_secs: 0,
                                kind: PeriodKind::Regular,
                            });
                        }
                    } else {
                        anomalies.push(Anomaly::OrphanedCheckOut { timestamp: punch.timestamp });
                        periods.push(WorkPeriod {
                            check_in: punch.timestamp,
                            check_out: Some(punch.timestamp),
                            duration_secs: 0,
                            kind: PeriodKind::Regular,
                        });
                    }
                },
                PunchStatus::BreakOut => {
                    if let Some(bs) = open_break.take()
                        && let Some(period) =
                            WorkPeriod::closed(bs.timestamp, punch.timestamp, PeriodKind::Break)
                    {
                        periods.push(period);
                    }
                    open_break = Some(punch);
                },
                PunchStatus::BreakIn => {
                    if let Some(bs) = open_break.take()
                        && let Some(period) =
                            WorkPeriod::closed(bs.timestamp, punch.timestamp, PeriodKind::Break)
                    {
                        periods.push(period);
                    }
                },
                PunchStatus::OvertimeIn => {
                    if let Some(ot) = open_overtime.take()
                        && let Some(period) =
                            WorkPeriod::closed(ot.timestamp, punch.timestamp, PeriodKind::Overtime)
                    {
                        periods.push(period);
                    }
                    open_overtime = Some(punch);
                },
                PunchStatus::OvertimeOut => {
                    if let Some(ot) = open_overtime.take()
                        && let Some(period) =
                            WorkPeriod::closed(ot.timestamp, punch.timestamp, PeriodKind::Overtime)
                    {
                        periods.push(period);
                    }
                },
            }
        }

        if let Some(check_in) = open_regular {
            periods.push(WorkPeriod::open(check_in.timestamp, PeriodKind::Regular));
            anomalies.push(Anomaly::MissingCheckOut { check_in: check_in.timestamp });
        }
        if let Some(bs) = open_break {
            periods.push(WorkPeriod::open(bs.timestamp, PeriodKind::Break));
        }
        if let Some(ot) = open_overtime {
            periods.push(WorkPeriod::open(ot.timestamp, PeriodKind::Overtime));
        }

        periods.sort_by_key(|p| p.check_in);
        (periods, anomalies)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::punch::VerifyMode;
    use crate::model::work_day::DayStatus;
    use jiff::civil::{Date, DateTime, Time};

    /// Build a UTC timestamp at a specific civil date and time.
    fn ts_at(date: Date, time: Time) -> jiff::Timestamp {
        DateTime::from_parts(date, time)
            .to_zoned(jiff::tz::TimeZone::UTC)
            .expect("valid UTC datetime")
            .timestamp()
    }

    fn date_2026_07_10() -> Date {
        Date::new(2026, 7, 10).unwrap()
    }

    fn date_2026_07_09() -> Date {
        Date::new(2026, 7, 9).unwrap()
    }

    fn time(h: i8, m: i8, s: i8) -> Time {
        Time::new(h, m, s, 0).unwrap()
    }

    /// Create a test punch at a specific UTC civil date/time.
    fn punch_at(pin: &str, date: Date, time: Time, status: PunchStatus) -> AttendancePunch {
        let ts = ts_at(date, time);
        let mut p = AttendancePunch {
            id: String::new(),
            device_sn: "DEV001".into(),
            user_pin: pin.into(),
            timestamp: ts,
            status,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };
        p.id = p.generate_deduplication_id();
        p
    }

    // ── Pairing algorithm tests ─────────────────────────────────────

    #[test]
    fn simple_checkin_checkout_pairing() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        assert_eq!(day.user_pin, "145");
        assert_eq!(day.periods.len(), 1);
        assert!(!day.periods[0].is_open());
        assert_eq!(day.periods[0].total_minutes(), 480); // 8 hours
        assert_eq!(day.status, DayStatus::Present);
        assert!(day.anomalies.is_empty());
    }

    #[test]
    fn missing_checkout_anomaly() {
        let d = date_2026_07_10();
        let punches = vec![punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn)];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);
        assert!(work_days[0].is_present_now());
        assert_eq!(work_days[0].anomalies.len(), 1);
        assert!(matches!(work_days[0].anomalies[0], Anomaly::MissingCheckOut { .. }));
    }

    #[test]
    fn duplicate_checkin_anomaly() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(10, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);
        assert_eq!(work_days[0].periods.len(), 2);
        assert_eq!(work_days[0].anomalies.len(), 1);
        assert!(matches!(work_days[0].anomalies[0], Anomaly::DuplicateCheckIn { .. }));
    }

    #[test]
    fn orphaned_checkout_anomaly() {
        let d = date_2026_07_10();
        let punches = vec![punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut)];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);
        assert_eq!(work_days[0].anomalies.len(), 1);
        assert!(matches!(work_days[0].anomalies[0], Anomaly::OrphanedCheckOut { .. }));
    }

    #[test]
    fn break_pairing() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(12, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(12, 30, 0), PunchStatus::BreakIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        assert_eq!(day.periods.len(), 2);

        let regular = day.periods.iter().find(|p| p.kind == PeriodKind::Regular).unwrap();
        // Regular period spans the full work day (9:00–17:00 = 8h).
        // total_regular_seconds = 8h, total_break_seconds = 0.5h.
        // Net work time = regular - break = 7.5h.
        assert_eq!(regular.total_minutes(), 480);
        assert_eq!(day.total_regular_seconds, 480 * 60);
        assert_eq!(day.total_break_seconds, 30 * 60);

        // Net work time = regular minus breaks
        let net_work = day.total_regular_seconds - day.total_break_seconds;
        assert_eq!(net_work, 27000); // 7.5h

        let bp = day.periods.iter().find(|p| p.kind == PeriodKind::Break).unwrap();
        assert_eq!(bp.total_minutes(), 30);

        assert!(day.anomalies.is_empty());
    }

    #[test]
    fn overtime_pairing() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d, time(17, 0, 0), PunchStatus::OvertimeIn),
            punch_at("145", d, time(19, 0, 0), PunchStatus::OvertimeOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let overtime =
            work_days[0].periods.iter().find(|p| p.kind == PeriodKind::Overtime).unwrap();
        assert_eq!(overtime.total_minutes(), 120);
    }

    #[test]
    fn multiple_users_grouped_separately() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d, time(9, 30, 0), PunchStatus::CheckIn),
            punch_at("146", d, time(17, 30, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 2);
    }

    #[test]
    fn single_user_single_day_via_compute_work_day() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d, time(9, 30, 0), PunchStatus::CheckIn), // different user
        ];
        let policy = WorkPolicy::standard_9to5();

        let day = AttendanceCalculator::compute_work_day(&punches, "145", d, &policy);
        assert!(day.is_some(), "should find work day for user 145");
        assert_eq!(day.unwrap().periods.len(), 1);
    }

    #[test]
    fn empty_punches_returns_none() {
        let policy = WorkPolicy::standard_9to5();
        assert!(
            AttendanceCalculator::compute_work_day(&[], "145", date_2026_07_10(), &policy)
                .is_none()
        );
    }

    #[test]
    fn two_separate_regular_periods() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(12, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d, time(13, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let regular: Vec<_> =
            work_days[0].periods.iter().filter(|p| p.kind == PeriodKind::Regular).collect();
        assert_eq!(regular.len(), 2);
        let total: i64 = regular.iter().map(|p| p.total_minutes()).sum();
        assert_eq!(total, 420); // 3h + 4h
    }

    #[test]
    fn cross_day_punches_are_separated() {
        let d1 = date_2026_07_09();
        let d2 = date_2026_07_10();
        let punches = vec![
            punch_at("145", d1, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d2, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d2, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 2, "two days → two WorkDay aggregates");
    }

    #[test]
    fn no_anomalies_on_clean_day() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert!(work_days[0].anomalies.is_empty());
    }

    #[test]
    fn work_days_sorted_by_date_then_user() {
        let d1 = date_2026_07_09();
        let d2 = date_2026_07_10();
        let punches = vec![
            punch_at("146", d2, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("146", d2, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d1, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 2);
        assert!(work_days[0].date < work_days[1].date, "should be sorted by date");
    }
}
