//! Attendance calculator — the core domain service for attendance business logic.
//!
//! This service is stateless. It takes raw punches and a work policy,
//! applies the domain rules (pairing, hour computation, anomaly detection),
//! and returns `WorkDay` aggregates. It also provides analytical projections
//! (daily/weekly hours, KPIs, trends, calendar, today snapshot).

use jiff::civil::Date;

use crate::model::anomaly::Anomaly;
use crate::model::attendance_analytics::{
    CalendarDay, CheckedInEmployee, DailyHours, EmployeeKpi, MonthlyTrendPoint, StatusDistribution,
    TodaySnapshot, WeeklyHours,
};
use crate::model::work_day::{DayStatus, WorkDay};
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

    /// Compute `WorkDay` aggregates respecting per-employee work policies.
    ///
    /// Unlike [`compute_work_days`] which applies a single policy to all punches,
    /// this method resolves each employee's effective policy via `per_pin_policies`
    /// (falling back to `org_default`). It groups punches by policy fingerprint,
    /// computes work days per group, and merges the results.
    ///
    /// This is the preferred entry point for org-wide report handlers that need
    /// correct late detection, overtime, and working-day classification when
    /// departments have different work schedules.
    pub fn compute_work_days_per_pin(
        punches: &[AttendancePunch],
        per_pin_policies: &std::collections::HashMap<String, WorkPolicy>,
        org_default: &WorkPolicy,
    ) -> Vec<WorkDay> {
        use std::collections::HashMap;

        // Group punches by policy fingerprint so each group gets the correct policy
        let mut policy_groups: HashMap<String, (Vec<&AttendancePunch>, &WorkPolicy)> =
            HashMap::new();

        for p in punches {
            let effective = per_pin_policies.get(&p.user_pin).unwrap_or(org_default);
            let key = Self::policy_fingerprint(effective);
            let entry = policy_groups.entry(key.clone()).or_insert_with(|| (Vec::new(), effective));
            entry.0.push(p);
        }

        let mut all_work_days: Vec<WorkDay> = Vec::new();
        for (_key, (group_punches, policy)) in policy_groups {
            let cloned: Vec<AttendancePunch> = group_punches.iter().map(|&p| p.clone()).collect();
            all_work_days.extend(Self::compute_work_days(&cloned, policy));
        }

        all_work_days.sort_by(|a, b| a.date.cmp(&b.date).then_with(|| a.user_pin.cmp(&b.user_pin)));

        all_work_days
    }

    /// Deterministic string key for a work policy, used to group punches
    /// that share the same effective policy.
    fn policy_fingerprint(policy: &WorkPolicy) -> String {
        format!(
            "{:02}:{:02}-{:02}:{:02}-{}-{}-{}-{:?}",
            policy.work_start.hour(),
            policy.work_start.minute(),
            policy.work_end.hour(),
            policy.work_end.minute(),
            policy.late_threshold_secs,
            policy.min_seconds_for_present,
            policy.daily_overtime_after_secs,
            policy.working_days,
        )
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

    // ── Aggregation ───────────────────────────────────────────────

    /// Group WorkDays by date and sum regular + overtime seconds.
    ///
    /// Pure aggregation — no policy decisions. Policy was already applied
    /// when WorkDays were computed.
    pub fn aggregate_daily_hours(work_days: &[WorkDay]) -> Vec<DailyHours> {
        let mut map: std::collections::BTreeMap<Date, (i64, i64)> =
            std::collections::BTreeMap::new();

        for wd in work_days {
            let entry = map.entry(wd.date).or_default();
            entry.0 += wd.net_work_seconds();
            entry.1 += wd.total_overtime_seconds;
        }

        map.into_iter()
            .map(|(date, (reg, ot))| DailyHours {
                date,
                regular_seconds: reg,
                overtime_seconds: ot,
            })
            .collect()
    }

    /// Roll daily hours into ISO weeks.
    pub fn aggregate_weekly_hours(daily_hours: &[DailyHours]) -> Vec<WeeklyHours> {
        let mut map: std::collections::BTreeMap<(i16, i8), i64> = std::collections::BTreeMap::new();

        for dh in daily_hours {
            let iso = dh.date.iso_week_date();
            let key = (iso.year(), iso.week());
            *map.entry(key).or_default() += dh.regular_seconds + dh.overtime_seconds;
        }

        map.into_iter()
            .map(|((year, week), total_seconds)| WeeklyHours { year, week, total_seconds })
            .collect()
    }

    // ── Distribution ───────────────────────────────────────────────

    /// Count work-days by status: Full, Half, Absent.
    ///
    /// Iterates over every working day in the range. Days with a matching
    /// WorkDay are classified as full or half; days without one are absent.
    pub fn compute_status_distribution(
        work_days: &[WorkDay],
        policy: &WorkPolicy,
        from_date: Date,
        to_date: Date,
    ) -> StatusDistribution {
        // Build a lookup: (user_pin, date) → &WorkDay
        let mut lookup: std::collections::HashMap<(String, Date), &WorkDay> =
            std::collections::HashMap::new();
        for wd in work_days {
            lookup.insert((wd.user_pin.clone(), wd.date), wd);
        }

        // Collect unique user pins
        let pins: Vec<String> = {
            let mut set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
            for wd in work_days {
                set.insert(wd.user_pin.clone());
            }
            set.into_iter().collect()
        };

        let mut full = 0u64;
        let mut half = 0u64;
        let mut absent = 0u64;

        for pin in &pins {
            let mut cursor = from_date;
            loop {
                if cursor > to_date {
                    break;
                }
                let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
                if policy.is_working_day(weekday) {
                    match lookup.get(&(pin.clone(), cursor)) {
                        Some(wd) => {
                            if wd.total_regular_seconds >= policy.min_seconds_for_present {
                                full += 1;
                            } else {
                                half += 1;
                            }
                        },
                        None => absent += 1,
                    }
                }
                cursor = match cursor.tomorrow() {
                    Ok(d) => d,
                    Err(_) => break,
                };
            }
        }

        StatusDistribution { full_days: full, half_days: half, absent_days: absent }
    }

    /// Per-employee attendance KPIs for a date range.
    pub fn compute_employee_kpis(
        work_days: &[WorkDay],
        policy: &WorkPolicy,
        from_date: Date,
        to_date: Date,
    ) -> Vec<EmployeeKpi> {
        // Group work_days by user_pin
        let mut by_pin: std::collections::HashMap<String, Vec<&WorkDay>> =
            std::collections::HashMap::new();
        for wd in work_days {
            by_pin.entry(wd.user_pin.clone()).or_default().push(wd);
        }

        let mut kpis = Vec::new();

        for (pin, days) in &by_pin {
            let mut days_present: u32 = 0;
            let mut days_absent: u32 = 0;
            let mut days_late: u32 = 0;
            let mut total_regular: i64 = 0;
            let mut total_overtime: i64 = 0;
            let mut days_with_hours: u32 = 0;

            // Build a set of dates where this employee has data
            let mut day_set: std::collections::HashSet<Date> = std::collections::HashSet::new();
            for wd in days {
                day_set.insert(wd.date);
            }

            // Iterate over all working days in range
            let mut cursor = from_date;
            loop {
                if cursor > to_date {
                    break;
                }
                let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
                if policy.is_working_day(weekday) {
                    if day_set.contains(&cursor) {
                        // Find matching WorkDays for this date
                        let matches: Vec<&&WorkDay> =
                            days.iter().filter(|wd| wd.date == cursor).collect();
                        for wd in matches {
                            total_regular += wd.net_work_seconds();
                            total_overtime += wd.total_overtime_seconds;
                            days_with_hours += 1;
                        }
                        days_present += 1;

                        // Late detection: check first regular period's check-in time
                        let is_late = days
                            .iter()
                            .filter(|wd| wd.date == cursor)
                            .any(|wd| wd.status == DayStatus::Late);
                        if is_late {
                            days_late += 1;
                        }
                    } else {
                        days_absent += 1;
                    }
                }
                cursor = match cursor.tomorrow() {
                    Ok(d) => d,
                    Err(_) => break,
                };
            }

            let avg_seconds =
                if days_with_hours > 0 { total_regular / days_with_hours as i64 } else { 0 };

            kpis.push(EmployeeKpi {
                user_pin: pin.clone(),
                days_present,
                days_absent,
                days_late,
                total_regular_seconds: total_regular,
                total_overtime_seconds: total_overtime,
                avg_seconds_per_day: avg_seconds,
            });
        }

        kpis.sort_by(|a, b| a.user_pin.cmp(&b.user_pin));
        kpis
    }

    // ── Trends ─────────────────────────────────────────────────────

    /// Monthly attendance % for the last N months.
    ///
    /// For each month: attendance_pct = (days_with_attendance / working_days) * 100
    pub fn compute_monthly_trend(
        work_days: &[WorkDay],
        policy: &WorkPolicy,
        from_date: Date,
        to_date: Date,
    ) -> Vec<MonthlyTrendPoint> {
        use std::collections::{BTreeMap, HashSet};

        // For each (user, year, month), track unique dates with attendance
        let mut attendance_by_month: BTreeMap<(i16, i8), HashSet<Date>> = BTreeMap::new();
        let mut working_days_by_month: BTreeMap<(i16, i8), u32> = BTreeMap::new();

        for wd in work_days {
            let month_key = (wd.date.year(), wd.date.month());
            attendance_by_month.entry(month_key).or_default().insert(wd.date);
        }

        // Count working days per month
        let mut cursor = from_date;
        loop {
            if cursor > to_date {
                break;
            }
            let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
            if policy.is_working_day(weekday) {
                let month_key = (cursor.year(), cursor.month());
                *working_days_by_month.entry(month_key).or_default() += 1;
            }
            cursor = match cursor.tomorrow() {
                Ok(d) => d,
                Err(_) => break,
            };
        }

        // To compute a meaningful percentage, we need to know how many unique employees
        // contributed per month. For simplicity, we count unique employee-days vs working days.
        let mut trend = Vec::new();
        for ((year, month), working_days) in &working_days_by_month {
            let attended_days =
                attendance_by_month.get(&(*year, *month)).map(|s| s.len() as u32).unwrap_or(0);

            let pct = if *working_days > 0 {
                (attended_days as f64 / *working_days as f64) * 100.0
            } else {
                0.0
            };

            trend.push(MonthlyTrendPoint {
                year: *year,
                month: *month,
                attendance_pct: pct.min(100.0),
            });
        }

        trend
    }

    // ── Projections ─────────────────────────────────────────────────

    /// Project WorkDays onto a calendar month view.
    ///
    /// Returns one CalendarDay per calendar day. Weekends get status_code=0.
    pub fn project_calendar(
        work_days: &[WorkDay],
        year: i16,
        month: i8,
        policy: &WorkPolicy,
    ) -> Vec<CalendarDay> {
        let mut lookup: std::collections::HashMap<Date, &WorkDay> =
            std::collections::HashMap::new();
        for wd in work_days {
            lookup.entry(wd.date).or_insert(wd);
        }

        // Determine the first and last day of the month
        let first = Date::new(year, month, 1).expect("valid date");

        // We'll iterate from the 1st until the month changes
        let mut days = Vec::new();
        let mut cursor = first;
        loop {
            let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
            let is_working = policy.is_working_day(weekday);

            let (status_code, hours) = if !is_working {
                (0, None)
            } else if let Some(wd) = lookup.get(&cursor) {
                let code = match wd.status {
                    DayStatus::Present => {
                        if wd.total_regular_seconds >= policy.min_seconds_for_present {
                            4
                        } else {
                            3
                        }
                    },
                    DayStatus::Late | DayStatus::EarlyLeave => 2,
                    DayStatus::HalfDay => 3,
                    DayStatus::Absent => 1,
                    DayStatus::Holiday => 0,
                };
                let h = wd.regular_hours_f64() + wd.overtime_hours_f64();
                (code, Some(h))
            } else {
                (1, None) // absent
            };

            days.push(CalendarDay { date: cursor, status_code, hours, is_working_day: is_working });

            // Move to next day; stop if we've left the month
            cursor = match cursor.tomorrow() {
                Ok(d) => {
                    if d.month() != month {
                        break;
                    }
                    d
                },
                Err(_) => break,
            };
        }

        days
    }

    /// Operational snapshot: who's here, who's late, hourly arrival pattern.
    ///
    /// This is the "right now" view — different from the analytical summary
    /// which answers "over time" questions.
    ///
    /// When `per_pin_policies` is provided, late detection uses per-employee
    /// department-specific thresholds instead of treating all employees against
    /// the same org-default policy. Each employee's first check-in time is
    /// compared against their effective policy's `is_late()` method.
    pub fn project_today_snapshot(
        punches: &[AttendancePunch],
        per_pin_policies: &std::collections::HashMap<String, WorkPolicy>,
        org_default: &WorkPolicy,
        total_employees: usize,
    ) -> TodaySnapshot {
        use std::collections::{HashMap, HashSet};

        // Collect unique users with activity today
        let mut all_users: HashSet<&str> = HashSet::new();
        // Track each user's first check-in of the day for late detection
        let mut first_check_in: HashMap<&str, jiff::civil::Time> = HashMap::new();
        // Track currently-checked-in users: those with a CheckIn but no CheckOut yet
        let mut has_check_in: HashSet<&str> = HashSet::new();
        let mut has_check_out: HashSet<&str> = HashSet::new();
        let mut check_in_by_user: HashMap<&str, &AttendancePunch> = HashMap::new();

        for p in punches {
            all_users.insert(&p.user_pin);
            match p.status {
                PunchStatus::CheckIn => {
                    has_check_in.insert(&p.user_pin);
                    let zoned = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
                    let arrival = zoned.datetime().time();
                    first_check_in.entry(&p.user_pin).or_insert(arrival);
                    check_in_by_user.entry(&p.user_pin).or_insert(p);
                },
                PunchStatus::CheckOut => {
                    has_check_out.insert(&p.user_pin);
                },
                _ => {},
            }
        }

        let present = all_users.len();
        let absent = total_employees.saturating_sub(present);

        // Late detection: per-employee policy applied to first check-in
        let late = first_check_in
            .iter()
            .filter(|(pin, arrival)| {
                let effective = per_pin_policies.get(&pin.to_string()).unwrap_or(org_default);
                effective.is_late(**arrival)
            })
            .count();
        let on_time = first_check_in.len().saturating_sub(late);

        // Currently checked in: users with check-in but no check-out
        let currently_checked_in: Vec<CheckedInEmployee> = has_check_in
            .difference(&has_check_out)
            .filter_map(|pin| {
                check_in_by_user.get(pin).map(|p| CheckedInEmployee {
                    user_pin: p.user_pin.clone(),
                    check_in_epoch: p.timestamp.as_second(),
                })
            })
            .collect();

        // Hourly breakdown from raw punches
        let mut hourly: [u32; 24] = [0; 24];
        for p in punches {
            let zoned = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            let hour = zoned.datetime().time().hour() as usize;
            if hour < 24 {
                hourly[hour] += 1;
            }
        }

        TodaySnapshot {
            present,
            absent,
            late,
            on_time,
            currently_checked_in,
            hourly_breakdown: hourly,
        }
    }

    /// Annotate punches in-place with anomaly flags from computed work days.
    ///
    /// After calling [`compute_work_days`] or [`compute_work_days_per_pin`],
    /// call this to persist which punches are anomalous. Matching is done by
    /// (user_pin, timestamp) — each anomaly variant carries the timestamps of
    /// the punches it applies to.
    ///
    /// This is the bridge between the in-memory anomaly computation and the
    /// persisted `is_anomaly` / `anomaly_type` columns used by the
    /// `anomalies_only` query filter.
    pub fn annotate_punches_with_anomalies(work_days: &[WorkDay], punches: &mut [AttendancePunch]) {
        // Build an index: (user_pin, timestamp_secs) -> mutable reference to punch
        let mut index: std::collections::HashMap<(String, i64), &mut AttendancePunch> =
            std::collections::HashMap::new();
        for punch in punches.iter_mut() {
            let ts = punch.timestamp.as_second();
            index.insert((punch.user_pin.clone(), ts), punch);
        }

        for wd in work_days {
            for anomaly in &wd.anomalies {
                let kind = anomaly.kind().to_string();
                match anomaly {
                    Anomaly::OrphanedCheckOut { timestamp } => {
                        let key = (wd.user_pin.clone(), timestamp.as_second());
                        if let Some(punch) = index.get_mut(&key) {
                            punch.is_anomaly = true;
                            punch.anomaly_type = Some(kind);
                        }
                    },
                    Anomaly::DuplicateCheckIn { first, second } => {
                        for ts in [first, second] {
                            let key = (wd.user_pin.clone(), ts.as_second());
                            if let Some(punch) = index.get_mut(&key) {
                                punch.is_anomaly = true;
                                punch.anomaly_type = Some(kind.clone());
                            }
                        }
                    },
                    Anomaly::MissingCheckOut { check_in } => {
                        let key = (wd.user_pin.clone(), check_in.as_second());
                        if let Some(punch) = index.get_mut(&key) {
                            punch.is_anomaly = true;
                            punch.anomaly_type = Some(kind);
                        }
                    },
                    // These anomalies don't point to a specific punch timestamp,
                    // so they can't be marked on individual punches. They still
                    // appear in the WorkDay's anomaly list for API consumers.
                    Anomaly::UnusualHours { .. } | Anomaly::BuddyPunchCandidate { .. } => {},
                }
            }
        }
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
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
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

    // ── Aggregation tests ──────────────────────────────────────────

    #[test]
    fn aggregate_daily_hours_sums_across_users() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d, time(10, 0, 0), PunchStatus::CheckIn),
            punch_at("146", d, time(14, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 2, "should have 1 work day per user");

        let daily = AttendanceCalculator::aggregate_daily_hours(&work_days);
        assert_eq!(daily.len(), 1, "both users on same date → one DailyHours");
        assert_eq!(daily[0].regular_seconds, 8 * 3600 + 4 * 3600);
        assert_eq!(daily[0].overtime_seconds, 0);
    }

    #[test]
    fn aggregate_daily_hours_multiple_dates() {
        let d1 = date_2026_07_09();
        let d2 = date_2026_07_10();
        let punches = vec![
            punch_at("145", d1, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d2, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d2, time(13, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let daily = AttendanceCalculator::aggregate_daily_hours(&work_days);
        assert_eq!(daily.len(), 2);
        assert!(daily[0].date < daily[1].date, "should be sorted by date");
        assert_eq!(daily[0].regular_seconds, 8 * 3600);
        assert_eq!(daily[1].regular_seconds, 4 * 3600);
    }

    #[test]
    fn aggregate_daily_hours_empty() {
        let daily = AttendanceCalculator::aggregate_daily_hours(&[]);
        assert!(daily.is_empty());
    }

    #[test]
    fn aggregate_weekly_hours_groups_by_iso_week() {
        let d1 = Date::new(2026, 7, 6).unwrap();
        let d2 = Date::new(2026, 7, 10).unwrap();

        let dh = vec![
            DailyHours { date: d1, regular_seconds: 28800, overtime_seconds: 0 },
            DailyHours { date: d2, regular_seconds: 14400, overtime_seconds: 3600 },
        ];

        let weeks = AttendanceCalculator::aggregate_weekly_hours(&dh);
        assert_eq!(weeks.len(), 1);
        assert_eq!(weeks[0].year, 2026);
        assert_eq!(weeks[0].week, 28);
        assert_eq!(weeks[0].total_seconds, 28800 + 14400 + 3600);
    }

    #[test]
    fn aggregate_weekly_hours_empty() {
        let weeks = AttendanceCalculator::aggregate_weekly_hours(&[]);
        assert!(weeks.is_empty());
    }

    // ── Distribution tests ──────────────────────────────────────────

    #[test]
    fn status_distribution_full_half_absent() {
        let d1 = Date::new(2026, 7, 6).unwrap();
        let d2 = Date::new(2026, 7, 7).unwrap();
        let d3 = Date::new(2026, 7, 8).unwrap();

        let punches = vec![
            punch_at("145", d1, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d2, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d2, time(12, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let dist = AttendanceCalculator::compute_status_distribution(&work_days, &policy, d1, d3);
        assert_eq!(dist.full_days, 1);
        assert_eq!(dist.half_days, 1);
        assert_eq!(dist.absent_days, 1);
    }

    #[test]
    fn status_distribution_empty_range() {
        let d = Date::new(2026, 7, 10).unwrap();
        let policy = WorkPolicy::standard_9to5();
        let dist = AttendanceCalculator::compute_status_distribution(&[], &policy, d, d);
        assert_eq!(dist.total_employee_days(), 0);
    }

    // ── Employee KPI tests ──────────────────────────────────────────

    #[test]
    fn employee_kpis_for_range() {
        let d1 = Date::new(2026, 7, 6).unwrap();
        let d2 = Date::new(2026, 7, 7).unwrap();

        let punches = vec![
            punch_at("145", d1, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d2, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("146", d2, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let kpis = AttendanceCalculator::compute_employee_kpis(&work_days, &policy, d1, d2);
        assert_eq!(kpis.len(), 2);

        let emp145 = kpis.iter().find(|k| k.user_pin == "145").unwrap();
        assert_eq!(emp145.days_present, 1);
        assert_eq!(emp145.days_absent, 1);
        assert_eq!(emp145.days_late, 0);

        let emp146 = kpis.iter().find(|k| k.user_pin == "146").unwrap();
        assert_eq!(emp146.days_present, 1);
        assert_eq!(emp146.days_absent, 1);
    }

    #[test]
    fn employee_kpis_detects_late() {
        let d1 = Date::new(2026, 7, 6).unwrap();

        let punches = vec![
            punch_at("145", d1, time(10, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d1, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let mut policy = WorkPolicy::standard_9to5();
        policy.late_threshold_secs = 15 * 60;
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let kpis = AttendanceCalculator::compute_employee_kpis(&work_days, &policy, d1, d1);
        assert_eq!(kpis.len(), 1);
        assert_eq!(kpis[0].days_late, 1);
        assert_eq!(kpis[0].days_present, 1);
    }

    #[test]
    fn employee_kpis_empty() {
        let d = Date::new(2026, 7, 6).unwrap();
        let policy = WorkPolicy::standard_9to5();
        let kpis = AttendanceCalculator::compute_employee_kpis(&[], &policy, d, d);
        assert!(kpis.is_empty());
    }

    // ── Trend tests ─────────────────────────────────────────────────

    #[test]
    fn monthly_trend_computes_pct() {
        let mut punches: Vec<AttendancePunch> = Vec::new();
        let policy = WorkPolicy::standard_9to5();

        let start = Date::new(2026, 7, 1).unwrap();
        let end = Date::new(2026, 7, 31).unwrap();

        let mut cursor = start;
        let mut days_added = 0;
        loop {
            if cursor > end || days_added >= 10 {
                break;
            }
            let wd = cursor.weekday().to_monday_zero_offset() as u8 % 7;
            if policy.is_working_day(wd) {
                punches.push(punch_at("145", cursor, time(9, 0, 0), PunchStatus::CheckIn));
                punches.push(punch_at("145", cursor, time(17, 0, 0), PunchStatus::CheckOut));
                days_added += 1;
            }
            cursor = cursor.tomorrow().unwrap();
        }

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        let trend = AttendanceCalculator::compute_monthly_trend(&work_days, &policy, start, end);
        assert_eq!(trend.len(), 1);
        assert_eq!(trend[0].year, 2026);
        assert_eq!(trend[0].month, 7);
        assert!((trend[0].attendance_pct - 10.0 / 23.0 * 100.0).abs() < 1.0);
    }

    #[test]
    fn monthly_trend_empty() {
        let start = Date::new(2026, 7, 1).unwrap();
        let end = Date::new(2026, 7, 31).unwrap();
        let policy = WorkPolicy::standard_9to5();
        let trend = AttendanceCalculator::compute_monthly_trend(&[], &policy, start, end);
        assert!(!trend.is_empty());
    }

    // ── Calendar projection tests ───────────────────────────────────

    #[test]
    fn project_calendar_marks_weekends() {
        let policy = WorkPolicy::standard_9to5();
        let days = AttendanceCalculator::project_calendar(&[], 2026, 7, &policy);

        assert_eq!(days.len(), 31);
        let sat = days.iter().find(|d| d.date.weekday().to_monday_zero_offset() == 5).unwrap();
        assert_eq!(sat.status_code, 0, "weekend should be status 0");
        assert!(!sat.is_working_day);
    }

    #[test]
    fn project_calendar_marks_present_and_absent() {
        let d = Date::new(2026, 7, 6).unwrap();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let days = AttendanceCalculator::project_calendar(&work_days, 2026, 7, &policy);

        let monday = days.iter().find(|cd| cd.date == d).unwrap();
        assert_eq!(monday.status_code, 4, "full day present");
        assert!(monday.hours.is_some());

        let tuesday = Date::new(2026, 7, 7).unwrap();
        let tue = days.iter().find(|cd| cd.date == tuesday).unwrap();
        assert_eq!(tue.status_code, 1, "absent");
    }

    #[test]
    fn project_calendar_short_month() {
        let policy = WorkPolicy::standard_9to5();
        let days = AttendanceCalculator::project_calendar(&[], 2026, 2, &policy);
        assert_eq!(days.len(), 28);
    }

    // ── Today snapshot tests ────────────────────────────────────────

    #[test]
    fn today_snapshot_counts_present_absent() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("146", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let per_pin = std::collections::HashMap::new(); // both use org default

        let snap = AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &policy, 10);
        assert_eq!(snap.present, 2);
        assert_eq!(snap.absent, 8);
        assert_eq!(snap.late, 0);
        assert_eq!(snap.on_time, 2);
        assert!(snap.currently_checked_in.is_empty());
    }

    #[test]
    fn today_snapshot_checked_in() {
        let d = date_2026_07_10();
        let punches = vec![punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn)];
        let policy = WorkPolicy::standard_9to5();
        let per_pin = std::collections::HashMap::new();

        let snap = AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &policy, 5);
        assert_eq!(snap.present, 1);
        assert_eq!(snap.currently_checked_in.len(), 1);
        assert_eq!(snap.currently_checked_in[0].user_pin, "145");
    }

    #[test]
    fn today_snapshot_late_detection() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(10, 30, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let mut policy = WorkPolicy::standard_9to5();
        policy.late_threshold_secs = 15 * 60;
        let per_pin = std::collections::HashMap::new();

        let snap = AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &policy, 5);
        assert_eq!(snap.late, 1);
        assert_eq!(snap.on_time, 0);
    }

    #[test]
    fn today_snapshot_hourly_breakdown() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(9, 30, 0), PunchStatus::CheckOut),
            punch_at("145", d, time(13, 0, 0), PunchStatus::CheckIn),
        ];
        let policy = WorkPolicy::standard_9to5();
        let per_pin = std::collections::HashMap::new();

        let snap = AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &policy, 5);
        assert_eq!(snap.hourly_breakdown[9], 2);
        assert_eq!(snap.hourly_breakdown[13], 1);
        assert_eq!(snap.hourly_breakdown[0], 0);
    }

    #[test]
    fn today_snapshot_per_pin_policies() {
        let d = date_2026_07_10();
        // Warehouse employee checks in at 06:10 (not late for warehouse policy which starts at 06:00)
        // Office employee checks in at 09:10 (not late for standard 9-to-5 with 15 min grace)
        let punches = vec![
            punch_at("145", d, time(6, 10, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(14, 0, 0), PunchStatus::CheckOut),
            punch_at("146", d, time(9, 10, 0), PunchStatus::CheckIn),
        ];

        let warehouse_policy = WorkPolicy {
            work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
            late_threshold_secs: 15 * 60,
            ..WorkPolicy::standard_9to5()
        };
        let office_policy = WorkPolicy::standard_9to5();

        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("145".to_string(), warehouse_policy), ("146".to_string(), office_policy.clone())]
                .into();

        let snap =
            AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &office_policy, 10);
        // 06:10 is not late for warehouse (within 15 min of 06:00)
        // 09:10 is not late for office (within 15 min of 09:00)
        assert_eq!(snap.late, 0);
        assert_eq!(snap.on_time, 2);
        assert_eq!(snap.present, 2);
    }

    #[test]
    fn today_snapshot_per_pin_late_one_dept() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 20, 0), PunchStatus::CheckIn), // late for everyone
            punch_at("146", d, time(6, 5, 0), PunchStatus::CheckIn),  // on time for warehouse
        ];

        let warehouse_policy = WorkPolicy {
            work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
            late_threshold_secs: 10 * 60, // 10 min grace
            ..WorkPolicy::standard_9to5()
        };
        let office_policy = WorkPolicy::standard_9to5(); // 15 min grace from 09:00

        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("145".to_string(), office_policy.clone()), ("146".to_string(), warehouse_policy)]
                .into();

        let snap =
            AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &office_policy, 10);
        // 09:20 is late for office (past 09:00 + 15min grace)
        // 06:05 is on time for warehouse (within 10min of 06:00)
        assert_eq!(snap.late, 1);
        assert_eq!(snap.on_time, 1);
    }

    #[test]
    fn today_snapshot_falls_back_to_org_default() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 20, 0), PunchStatus::CheckIn),
            punch_at("146", d, time(9, 5, 0), PunchStatus::CheckIn),
        ];
        let policy = WorkPolicy::standard_9to5();
        // Empty per-pin map → both use org default
        let per_pin = std::collections::HashMap::new();

        let snap = AttendanceCalculator::project_today_snapshot(&punches, &per_pin, &policy, 10);
        // 09:20 is late (past 09:00 + 15min)
        // 09:05 is on time
        assert_eq!(snap.late, 1);
        assert_eq!(snap.on_time, 1);
    }

    // ── Edge-case tests ──────────────────────────────────────────────

    /// Edge case: Two breaks in one day (BreakOut→BreakIn→BreakOut→BreakIn).
    #[test]
    fn consecutive_breaks_in_one_day() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(10, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(10, 15, 0), PunchStatus::BreakIn),
            punch_at("145", d, time(12, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(12, 30, 0), PunchStatus::BreakIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        // Two break periods: 15min + 30min = 45min total break
        assert_eq!(day.total_break_seconds, 45 * 60);
        // Regular = 8h, Net = 8h - 45min = 7h15m
        assert_eq!(day.total_regular_seconds, 8 * 3600);
        assert_eq!(day.net_work_seconds(), 8 * 3600 - 45 * 60);
        assert!(day.anomalies.is_empty());
    }

    /// Edge case: Duplicate BreakOut anomaly — BreakOut followed by
    /// another BreakOut without intervening BreakIn.
    #[test]
    fn duplicate_break_out_anomaly() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(10, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(10, 30, 0), PunchStatus::BreakOut), // duplicate
            punch_at("145", d, time(11, 0, 0), PunchStatus::BreakIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        // The pairing algorithm closes the first BreakOut with the duplicate
        // (treating it as a BreakIn that closes the break), then the
        // duplicate opens a new break that gets closed by the real BreakIn.
        // Both breaks contribute to total_break_seconds.
        let break_periods: Vec<_> =
            day.periods.iter().filter(|p| p.kind == PeriodKind::Break).collect();
        assert_eq!(break_periods.len(), 2, "two break periods from duplicate");
    }

    /// Edge case: Orphaned BreakIn — BreakIn without preceding BreakOut.
    #[test]
    fn orphaned_break_in_without_break_out() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(10, 0, 0), PunchStatus::BreakIn), // orphaned
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        // The BreakIn without a BreakOut becomes a 0-duration break period
        // that is immediately opened and closed at the same timestamp.
        // Main thing: it shouldn't crash and should produce a valid WorkDay.
        assert_eq!(day.total_regular_seconds, 8 * 3600);
    }

    /// Edge case: Early leave detection — employee checks out before work_end.
    #[test]
    fn early_leave_detection() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(16, 0, 0), PunchStatus::CheckOut), // 1h early
        ];
        let policy = WorkPolicy::standard_9to5(); // work_end = 17:00

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);
        assert_eq!(
            work_days[0].status,
            DayStatus::EarlyLeave,
            "leaving at 16:00 should be EarlyLeave when work_end is 17:00"
        );
    }

    /// Edge case: All punch types in one day.
    #[test]
    fn all_punch_types_in_one_day() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(12, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(12, 30, 0), PunchStatus::BreakIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
            punch_at("145", d, time(17, 0, 0), PunchStatus::OvertimeIn),
            punch_at("145", d, time(19, 0, 0), PunchStatus::OvertimeOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        assert_eq!(day.total_regular_seconds, 8 * 3600);
        assert_eq!(day.total_break_seconds, 30 * 60);
        assert_eq!(day.total_overtime_seconds, 2 * 3600);
        assert_eq!(day.net_work_seconds(), 8 * 3600 - 30 * 60);
        assert_eq!(day.status, DayStatus::Present);
        assert!(day.anomalies.is_empty());

        // Verify all three period kinds are present
        let kinds: Vec<PeriodKind> = day.periods.iter().map(|p| p.kind).collect();
        assert!(kinds.contains(&PeriodKind::Regular));
        assert!(kinds.contains(&PeriodKind::Break));
        assert!(kinds.contains(&PeriodKind::Overtime));
    }

    /// Edge case: Net work seconds calculation — CheckIn 09:00, CheckOut 17:00,
    /// BreakOut 12:00, BreakIn 12:30 → net = 7.5h (regular - breaks).
    #[test]
    fn net_work_seconds_excludes_breaks() {
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
        assert_eq!(day.total_regular_seconds, 28800); // 8h
        assert_eq!(day.total_break_seconds, 1800); // 30min
        // net = regular - break = 27000s = 7.5h
        assert_eq!(day.net_work_seconds(), 27000);
        assert_eq!(day.net_work_seconds(), 7 * 3600 + 1800); // explicitly 7.5h
    }

    /// Edge case: Zero-duration period — CheckIn and CheckOut at the same
    /// second should produce a 0-duration period, not crash.
    #[test]
    fn zero_duration_period() {
        let d = date_2026_07_10();
        let t = time(12, 0, 0);
        let punches = vec![
            punch_at("145", d, t, PunchStatus::CheckIn),
            punch_at("145", d, t, PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        assert_eq!(work_days.len(), 1);

        let day = &work_days[0];
        assert_eq!(day.total_regular_seconds, 0);
        assert_eq!(day.total_break_seconds, 0);
        assert_eq!(day.net_work_seconds(), 0);
    }

    /// Edge case: Only BreakOut/BreakIn without CheckIn — orphaned break
    /// punches should be handled without crashing.
    #[test]
    fn only_break_punches_without_check_in() {
        let d = date_2026_07_10();
        let punches = vec![
            punch_at("145", d, time(12, 0, 0), PunchStatus::BreakOut),
            punch_at("145", d, time(12, 30, 0), PunchStatus::BreakIn),
        ];
        let policy = WorkPolicy::standard_9to5();

        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
        // Should produce a WorkDay (not crash), even though there's no CheckIn
        assert_eq!(work_days.len(), 1);
        let day = &work_days[0];
        assert_eq!(day.total_regular_seconds, 0);
        assert_eq!(day.total_break_seconds, 30 * 60);
    }

    /// Edge case: Multi-month weekly aggregation — test that
    /// `aggregate_weekly_hours` correctly splits across ISO week boundaries
    /// when dates span month/year boundaries.
    #[test]
    fn aggregate_weekly_hours_crosses_month_boundary() {
        // Monday 2026-06-29 (ISO week 27 of 2026) and Tuesday 2026-07-01
        // These are in different months but potentially the same ISO week.
        // ISO week 27 2026 runs from June 29 to July 5.
        let d1 = Date::new(2026, 6, 29).unwrap(); // Mon
        let d2 = Date::new(2026, 7, 1).unwrap(); // Wed
        let d3 = Date::new(2026, 7, 6).unwrap(); // Mon (ISO week 28)

        let dh = vec![
            DailyHours { date: d1, regular_seconds: 28800, overtime_seconds: 0 },
            DailyHours { date: d2, regular_seconds: 14400, overtime_seconds: 0 },
            DailyHours { date: d3, regular_seconds: 3600, overtime_seconds: 3600 },
        ];

        let weeks = AttendanceCalculator::aggregate_weekly_hours(&dh);
        // d1 and d2 should be in the same ISO week, d3 in the next
        assert_eq!(weeks.len(), 2, "should produce two ISO weeks");
        assert!(weeks.iter().any(|w| w.total_seconds == 28800 + 14400));
        assert!(weeks.iter().any(|w| w.total_seconds == 3600 + 3600));
    }

    /// Edge case: Status distribution skips weekends — verify that weekends
    /// don't count as absent days even when no punches exist.
    #[test]
    fn status_distribution_skips_weekends() {
        // Mon 2026-07-06 to Fri 2026-07-10 (5 working days)
        let from = Date::new(2026, 7, 6).unwrap();
        let to = Date::new(2026, 7, 10).unwrap();

        // Employee "145" punches on Tue only
        let d_tue = Date::new(2026, 7, 7).unwrap();
        let punches = vec![
            punch_at("145", d_tue, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d_tue, time(17, 0, 0), PunchStatus::CheckOut),
        ];
        let policy = WorkPolicy::standard_9to5();
        let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

        let dist = AttendanceCalculator::compute_status_distribution(&work_days, &policy, from, to);
        // Only 5 working days (Mon-Fri). Tue is full, the other 4 are absent.
        assert_eq!(dist.full_days, 1);
        assert_eq!(dist.half_days, 0);
        assert_eq!(dist.absent_days, 4);
        // Total = 5 working days, weekends (Sat/Sun) excluded entirely.
        assert_eq!(dist.total_employee_days(), 5);
    }

    // ── compute_work_days_per_pin tests ──────────────────────────────

    /// Verify that compute_work_days_per_pin respects per-employee policies
    /// when employees belong to departments with different schedules.
    #[test]
    fn compute_work_days_per_pin_respects_per_pin_policies() {
        let d = date_2026_07_10();

        // Warehouse: 06:00 start, 10 min grace → late after 06:10
        let warehouse = WorkPolicy {
            work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
            late_threshold_secs: 10 * 60,
            ..WorkPolicy::standard_9to5()
        };
        let office = WorkPolicy::standard_9to5(); // 09:00 start, 15 min grace

        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("wh".to_string(), warehouse.clone()), ("ofc".to_string(), office.clone())].into();

        // Warehouse employee punches at 06:05 (ON TIME for warehouse)
        // Office employee punches at 09:20 (LATE for office — past 09:15 grace)
        let punches = vec![
            punch_at("wh", d, time(6, 5, 0), PunchStatus::CheckIn),
            punch_at("wh", d, time(14, 0, 0), PunchStatus::CheckOut),
            punch_at("ofc", d, time(9, 20, 0), PunchStatus::CheckIn),
            punch_at("ofc", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &office);

        assert_eq!(work_days.len(), 2);

        let wh_day = work_days.iter().find(|w| w.user_pin == "wh").unwrap();
        let ofc_day = work_days.iter().find(|w| w.user_pin == "ofc").unwrap();

        // Warehouse employee at 06:05 should be ON TIME (within 10-min grace from 06:00)
        assert_eq!(wh_day.status, DayStatus::Present, "warehouse should be on time");

        // Office employee at 09:20 should be LATE (past 09:15 grace)
        assert_eq!(ofc_day.status, DayStatus::Late, "office should be late");
    }

    /// Verify that pins not found in the per-pin map fall back to org_default.
    #[test]
    fn compute_work_days_per_pin_falls_back_to_org_default() {
        let d = date_2026_07_10();

        let office = WorkPolicy::standard_9to5();
        // Empty per-pin map → all use org default
        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            std::collections::HashMap::new();

        let punches = vec![
            punch_at("145", d, time(9, 20, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &office);

        assert_eq!(work_days.len(), 1);
        // 09:20 is late for standard 9-to-5 (past 09:15 grace)
        assert_eq!(work_days[0].status, DayStatus::Late);
    }

    /// Verify that mixed policies produce correct day status based on
    /// different `min_seconds_for_present` thresholds.
    /// A short-shift policy (2h minimum, ends at 12:00) classifies 3h as full day,
    /// while standard policy (4h minimum) classifies it as half day.
    #[test]
    fn compute_work_days_per_pin_min_seconds_differs_by_policy() {
        let d = date_2026_07_10();

        // Short-shift: ends at 12:00, only 2h needed for full-day status
        let short_shift = WorkPolicy {
            work_start: jiff::civil::Time::new(9, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(12, 0, 0, 0).unwrap(),
            min_seconds_for_present: 2 * 3600,
            ..WorkPolicy::standard_9to5()
        };
        let standard = WorkPolicy::standard_9to5(); // 4h needed for full-day

        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("short".to_string(), short_shift.clone()), ("std".to_string(), standard.clone())]
                .into();

        // Both employees punch only 3h
        let punches = vec![
            punch_at("short", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("short", d, time(12, 0, 0), PunchStatus::CheckOut),
            punch_at("std", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("std", d, time(12, 0, 0), PunchStatus::CheckOut),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &standard);

        assert_eq!(work_days.len(), 2);

        let short_day = work_days.iter().find(|w| w.user_pin == "short").unwrap();
        let std_day = work_days.iter().find(|w| w.user_pin == "std").unwrap();

        // 3h >= 2h minimum -> full day (ends at 12:00, no early-leave trigger)
        assert_eq!(short_day.status, DayStatus::Present, "3h should be full day with 2h minimum");

        // 3h < 4h minimum -> half day for standard employee
        assert_eq!(std_day.status, DayStatus::HalfDay, "3h should be half day with 4h minimum");
    }

    /// Verify that empty input produces empty output (no panic).
    #[test]
    fn compute_work_days_per_pin_empty_punches() {
        let policy = WorkPolicy::standard_9to5();
        let per_pin = std::collections::HashMap::new();

        let work_days = AttendanceCalculator::compute_work_days_per_pin(&[], &per_pin, &policy);

        assert!(work_days.is_empty());
    }

    /// Verify that the method produces anomaly-laden work days correctly.
    /// Anomalies are detected during pairing — this test ensures they survive
    /// the per-pin grouping.
    #[test]
    fn compute_work_days_per_pin_preserves_anomalies() {
        let d = date_2026_07_10();
        let policy = WorkPolicy::standard_9to5();
        let per_pin = std::collections::HashMap::new();

        // Duplicate check-in SHOULD produce an anomaly
        let punches = vec![
            punch_at("145", d, time(9, 0, 0), PunchStatus::CheckIn),
            punch_at("145", d, time(9, 1, 0), PunchStatus::CheckIn),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &policy);

        assert_eq!(work_days.len(), 1);
        assert!(!work_days[0].anomalies.is_empty(), "duplicate check-in should produce anomaly");
    }

    /// Regression test: org_default should NEVER be used for an employee who
    /// has a per-pin policy.
    ///
    /// IT department: 12:00-20:00 shift. Employee punches 09:30-17:00.
    ///
    /// - Under org default (09:00-17:00): 09:30 > 09:15 grace → **Late**
    /// - Under IT policy (12:00-20:00): 09:30 is before 12:15, not late.
    ///   But 17:00 < 20:00 → **EarlyLeave**
    ///
    /// If the handler incorrectly uses `org_work_policy()` instead of resolving
    /// per-employee policies, this employee is flagged Late instead of EarlyLeave.
    #[test]
    fn per_pin_policy_must_override_org_default() {
        let d = date_2026_07_10();

        // IT department: work starts at 12:00, 15 minute grace after that
        let it_policy = WorkPolicy {
            work_start: Time::new(12, 0, 0, 0).unwrap(),
            work_end: Time::new(20, 0, 0, 0).unwrap(),
            late_threshold_secs: 15 * 60, // 15 min grace (late after 12:15)
            min_seconds_for_present: 4 * 3600,
            ..WorkPolicy::standard_9to5()
        };

        // Org default: standard 9-to-5 (late after 09:15)
        let org_default = WorkPolicy::standard_9to5();

        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("it-emp".to_string(), it_policy.clone())].into();

        // IT employee arrives at 09:30 — this is 3h EARLY for the 12:00 policy
        let punches = vec![
            punch_at("it-emp", d, time(9, 30, 0), PunchStatus::CheckIn),
            punch_at("it-emp", d, time(17, 0, 0), PunchStatus::CheckOut),
        ];

        // ── The CORRECT behaviour (what per-pin resolution produces) ──
        let work_days_correct =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &org_default);

        assert_eq!(work_days_correct.len(), 1);
        assert_eq!(
            work_days_correct[0].status,
            DayStatus::EarlyLeave,
            "IT employee (12-20) leaving 17:00 = EarlyLeave, got {:?}",
            work_days_correct[0].status,
        );

        // ── The BUGGY behaviour (org default applied to everyone) ──
        let work_days_buggy = AttendanceCalculator::compute_work_days(&punches, &org_default);

        assert_eq!(work_days_buggy.len(), 1);
        assert_eq!(
            work_days_buggy[0].status,
            DayStatus::Late,
            "BUG: org default (09:00) incorrectly flags 09:30 arrival as Late",
        );

        // The mismatch is the bug — correct and buggy MUST differ
        assert_ne!(
            work_days_correct[0].status, work_days_buggy[0].status,
            "per-pin policy (12:00) must produce different status than org default (09:00)",
        );
    }

    /// Late detection under per-pin policy: employee with 12:00 start, punching
    /// at 12:20, should be Late (> 12:15 grace).
    #[test]
    fn per_pin_policy_detects_late_correctly() {
        let d = date_2026_07_10();

        let it_policy = WorkPolicy {
            work_start: Time::new(12, 0, 0, 0).unwrap(),
            work_end: Time::new(20, 0, 0, 0).unwrap(),
            late_threshold_secs: 15 * 60, // late after 12:15
            min_seconds_for_present: 4 * 3600,
            ..WorkPolicy::standard_9to5()
        };

        let org_default = WorkPolicy::standard_9to5();
        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("it-emp".to_string(), it_policy.clone())].into();

        // IT employee arrives at 12:20 — past the 12:15 grace → Late
        let punches = vec![
            punch_at("it-emp", d, time(12, 20, 0), PunchStatus::CheckIn),
            punch_at("it-emp", d, time(20, 0, 0), PunchStatus::CheckOut),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &org_default);

        assert_eq!(work_days.len(), 1);
        assert_eq!(
            work_days[0].status,
            DayStatus::Late,
            "IT employee arriving at 12:20 (grace ends 12:15) should be Late"
        );
    }

    /// Early Leave under per-pin policy: employee with 12:00-20:00 shift,
    /// leaving at 19:00, should be Early Leave.
    #[test]
    fn per_pin_policy_detects_early_leave_correctly() {
        let d = date_2026_07_10();

        let it_policy = WorkPolicy {
            work_start: Time::new(12, 0, 0, 0).unwrap(),
            work_end: Time::new(20, 0, 0, 0).unwrap(),
            late_threshold_secs: 15 * 60,
            min_seconds_for_present: 4 * 3600,
            ..WorkPolicy::standard_9to5()
        };

        let org_default = WorkPolicy::standard_9to5();
        let per_pin: std::collections::HashMap<String, WorkPolicy> =
            [("it-emp".to_string(), it_policy.clone())].into();

        // IT employee leaves at 19:00 — before 20:00 → Early Leave
        let punches = vec![
            punch_at("it-emp", d, time(12, 0, 0), PunchStatus::CheckIn),
            punch_at("it-emp", d, time(19, 0, 0), PunchStatus::CheckOut),
        ];

        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &per_pin, &org_default);

        assert_eq!(work_days.len(), 1);
        assert_eq!(
            work_days[0].status,
            DayStatus::EarlyLeave,
            "IT employee leaving at 19:00 (shift ends 20:00) should be Early Leave"
        );
    }
}
