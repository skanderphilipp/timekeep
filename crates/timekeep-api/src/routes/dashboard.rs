//! Dashboard summary and report handlers.

use std::collections::{BTreeMap, HashMap, HashSet};

use axum::Json;
use axum::extract::{Query, State};

use crate::app_state::AppState;
use crate::dto::{
    CurrentlyCheckedIn, DashboardDeviceHealth, DashboardHourlyBreakdown, DashboardRecentEvent,
    TodaySummaryResponse,
};
use crate::request::ReportSummaryQuery;
use crate::response::{
    ApiEnvelope, AppError, DailyBreakdown, DailyHoursBreakdown, EmployeeReportKpi,
    ReportSummaryResponse, WeeklyHours, status_distribution_to_response,
};

/// Get today's attendance summary.
#[utoipa::path(
    get,
    path = "/api/dashboard/today",
    tag = "Dashboard",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Today's summary", body = TodaySummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn today_summary(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<TodaySummaryResponse>>, AppError> {
    use timekeep_core::PunchStatus;
    use timekeep_core::model::AttendancePunch;

    let now = jiff::Timestamp::now();
    let settings = state.storage.get_system_settings().await?;
    let org_default = &settings.work_policy;

    // Today's date range (midnight to now)
    let today_start = {
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        jiff::civil::DateTime::from_parts(
            z.datetime().date(),
            jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
        )
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
    };

    let punches = state
        .storage
        .query_punches(&timekeep_core::PunchFilter {
            since: Some(today_start),
            until: Some(now),
            ..Default::default()
        })
        .await?;

    // ── Resolve per-employee policies for late detection ──
    let unique_pins: HashSet<&str> = punches.iter().map(|p| p.user_pin.as_str()).collect();
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        org_default,
    )
    .await;

    // ── Present / absent / late / on_time ──
    let mut all_users: HashSet<&str> = HashSet::new();
    let mut first_check_in: HashMap<&str, (&AttendancePunch, jiff::civil::Time)> = HashMap::new();
    let mut last_punch_per_user: HashMap<&str, &AttendancePunch> = HashMap::new();

    for p in &punches {
        all_users.insert(&p.user_pin);
        last_punch_per_user.insert(&p.user_pin, p);
        if p.status == PunchStatus::CheckIn {
            let z = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            let arrival = z.datetime().time();
            first_check_in.entry(&p.user_pin).or_insert((p, arrival));
        }
    }

    let present = all_users.len();
    // ── Total employees (from employee repository, fallback to unique users) ──
    let total_employees = if let Some(ref repo) = state.employees {
        repo.list_employees(&timekeep_core::query::ListParams::default())
            .await
            .map(|r| r.items.len())
            .unwrap_or(present)
    } else {
        present
    };
    let absent = total_employees.saturating_sub(present);

    // Late detection uses per-employee policy (department-specific thresholds)
    let late = first_check_in
        .iter()
        .filter(|(pin, (_, arrival))| {
            let effective = policy_map.get(&pin.to_string()).unwrap_or(org_default);
            effective.is_late(*arrival)
        })
        .count();
    let on_time = first_check_in.len().saturating_sub(late);

    let check_ins = punches.iter().filter(|p| p.status == PunchStatus::CheckIn).count();

    // ── Currently checked in ──
    let device_configs = state.storage.list_device_configs().await?;
    let device_label_map: HashMap<&str, &str> =
        device_configs.iter().map(|c| (c.serial_number.as_str(), c.label.as_str())).collect();

    let mut currently_checked_in: Vec<CurrentlyCheckedIn> = Vec::new();
    for pin in &all_users {
        let user_punches: Vec<&AttendancePunch> =
            punches.iter().filter(|p| p.user_pin == *pin).collect();
        let has_check_in = user_punches.iter().any(|p| p.status == PunchStatus::CheckIn);
        let has_check_out = user_punches.iter().any(|p| p.status == PunchStatus::CheckOut);
        if has_check_in
            && !has_check_out
            && let Some(check_in) = user_punches.iter().find(|p| p.status == PunchStatus::CheckIn)
        {
            let elapsed = now.duration_since(check_in.timestamp).as_secs().max(0);
            currently_checked_in.push(CurrentlyCheckedIn {
                user_pin: check_in.user_pin.clone(),
                employee_name: check_in.employee_name.clone(),
                check_in_time: check_in.timestamp.as_second(),
                device_sn: check_in.device_sn.clone(),
                device_label: device_label_map
                    .get(check_in.device_sn.as_str())
                    .map(|l| l.to_string()),
                elapsed_seconds: elapsed,
            });
        }
    }
    currently_checked_in.sort_by_key(|c| c.check_in_time);

    // ── Recent events: last 20 punches, newest first ──
    let recent_events: Vec<DashboardRecentEvent> = punches
        .iter()
        .rev()
        .take(20)
        .map(|p| DashboardRecentEvent {
            user_pin: p.user_pin.clone(),
            employee_name: p.employee_name.clone(),
            timestamp: p.timestamp.as_second(),
            status: p.status.to_string(),
            device_sn: p.device_sn.clone(),
        })
        .collect();

    // ── Hourly breakdown ──
    let mut hourly: [u32; 24] = [0; 24];
    for p in &punches {
        let z = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
        let hour = z.datetime().time().hour() as usize;
        if hour < 24 {
            hourly[hour] += 1;
        }
    }
    let hourly_breakdown: Vec<DashboardHourlyBreakdown> = (0..24u8)
        .map(|hour| DashboardHourlyBreakdown { hour, count: hourly[hour as usize] })
        .filter(|h| h.count > 0)
        .collect();

    // ── Device health ──
    let conn_states = state.device_state.get_all().await;
    let device_health: Vec<DashboardDeviceHealth> = device_configs
        .iter()
        .map(|cfg| {
            let conn = conn_states.get(&cfg.serial_number);
            let online = conn.is_some_and(|c| c.adms_active || c.sdk_active);
            DashboardDeviceHealth {
                serial_number: cfg.serial_number.clone(),
                label: cfg.label.clone(),
                online,
                adms_active: conn.is_some_and(|c| c.adms_active),
                sdk_poll_active: conn.is_some_and(|c| c.sdk_active),
                last_seen_at: conn.map(|c| c.last_seen),
                record_count: 0,
            }
        })
        .collect();

    let summary = TodaySummaryResponse {
        date: now.as_second(),
        present,
        absent,
        late,
        on_time,
        total_employees,
        total_punches: punches.len(),
        check_ins,
        check_outs: punches.len() - check_ins,
        last_punch_at: punches.last().map(|p| p.timestamp.as_second()),
        currently_checked_in,
        recent_events,
        device_health,
        hourly_breakdown,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Reports ──────────────────────────────────────────────────────────

/// Get aggregated punch summary for a date range.
///
/// Returns per-status counts, unique users, and daily breakdown.
/// Defaults to today if no date range is specified.
#[utoipa::path(
    get,
    path = "/api/reports/summary",
    tag = "Dashboard",
    security(("bearer_auth" = [])),
    params(ReportSummaryQuery),
    responses(
        (status = 200, description = "Aggregated report summary", body = ReportSummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn report_summary(
    State(state): State<AppState>,
    Query(params): Query<ReportSummaryQuery>,
) -> Result<Json<ApiEnvelope<ReportSummaryResponse>>, AppError> {
    use timekeep_core::{AttendanceCalculator, PunchStatus};

    let now = jiff::Timestamp::now();
    let settings = state.storage.get_system_settings().await?;
    let org_default = &settings.work_policy;

    // 1. Resolve date range
    let day_start = {
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        jiff::civil::DateTime::from_parts(
            z.datetime().date(),
            jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
        )
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
    };

    let date_from =
        params.date_from.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(day_start);
    let date_to =
        params.date_to.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(now);

    let from_date = date_from.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let to_date = date_to.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let work_days_count = org_default.count_working_days(from_date, to_date);

    // 2. Fetch raw data
    let filter = timekeep_core::PunchFilter {
        since: Some(date_from),
        until: Some(date_to),
        ..Default::default()
    };
    let punches = state.storage.query_punches(&filter).await?;

    // 3. Basic counts
    let mut check_ins: u64 = 0;
    let mut check_outs: u64 = 0;
    let mut break_outs: u64 = 0;
    let mut break_ins: u64 = 0;
    let mut overtime_ins: u64 = 0;
    let mut overtime_outs: u64 = 0;
    let mut users = std::collections::HashSet::new();
    let mut day_counts = BTreeMap::new();

    for punch in &punches {
        match punch.status {
            PunchStatus::CheckIn => check_ins += 1,
            PunchStatus::CheckOut => check_outs += 1,
            PunchStatus::BreakOut => break_outs += 1,
            PunchStatus::BreakIn => break_ins += 1,
            PunchStatus::OvertimeIn => overtime_ins += 1,
            PunchStatus::OvertimeOut => overtime_outs += 1,
        }
        users.insert(&punch.user_pin);
        let day_ts = {
            let z = punch.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            jiff::civil::DateTime::from_parts(
                z.datetime().date(),
                jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
            )
            .to_zoned(jiff::tz::TimeZone::UTC)
            .unwrap()
            .timestamp()
            .as_second()
        };
        *day_counts.entry(day_ts).or_insert(0u64) += 1;
    }

    let mut emp_names: HashMap<String, String> = HashMap::new();
    for p in &punches {
        if let Some(ref name) = p.employee_name {
            emp_names.entry(p.user_pin.clone()).or_insert(name.clone());
        }
    }

    // 4. Resolve per-employee policies and group computation
    let unique_pins: HashSet<&str> = punches.iter().map(|p| p.user_pin.as_str()).collect();
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        org_default,
    )
    .await;

    // Group punches by their effective policy for correct per-department computation
    let mut policy_groups: HashMap<String, Vec<&timekeep_core::model::AttendancePunch>> =
        HashMap::new();
    for p in &punches {
        let policy = policy_map.get(p.user_pin.as_str()).unwrap_or(org_default);
        // Use a deterministic string key for grouping (serialized policy)
        let key = format!(
            "{:02}:{:02}-{:02}:{:02}-{}-{}-{}-{:?}",
            policy.work_start.hour(),
            policy.work_start.minute(),
            policy.work_end.hour(),
            policy.work_end.minute(),
            policy.late_threshold_secs,
            policy.min_seconds_for_present,
            policy.daily_overtime_after_secs,
            policy.working_days,
        );
        policy_groups.entry(key).or_default().push(p);
    }

    // 5. Compute per policy group and merge results
    let mut all_work_days: Vec<timekeep_core::model::work_day::WorkDay> = Vec::new();
    let mut all_employee_kpis: Vec<timekeep_core::model::attendance_analytics::EmployeeKpi> =
        Vec::new();
    let mut total_full_days = 0u64;
    let mut total_half_days = 0u64;
    let mut total_absent_days = 0u64;

    for (_policy_key, group_punches) in &policy_groups {
        let punches_slice: Vec<timekeep_core::model::AttendancePunch> =
            group_punches.iter().map(|&p| p.clone()).collect();
        let group_policy = {
            let first_pin = group_punches.first().map(|p| p.user_pin.as_str()).unwrap_or("");
            policy_map.get(first_pin).cloned().unwrap_or_else(|| org_default.clone())
        };

        let work_days = AttendanceCalculator::compute_work_days(&punches_slice, &group_policy);
        let status_dist = AttendanceCalculator::compute_status_distribution(
            &work_days,
            &group_policy,
            from_date,
            to_date,
        );
        let kpis = AttendanceCalculator::compute_employee_kpis(
            &work_days,
            &group_policy,
            from_date,
            to_date,
        );

        total_full_days += status_dist.full_days;
        total_half_days += status_dist.half_days;
        total_absent_days += status_dist.absent_days;
        all_work_days.extend(work_days);
        all_employee_kpis.extend(kpis);
    }

    // 6. Aggregate across all policy groups
    let daily_hours = AttendanceCalculator::aggregate_daily_hours(&all_work_days);
    let weekly_hours = AttendanceCalculator::aggregate_weekly_hours(&daily_hours);

    // Combined status distribution
    let combined_status = timekeep_core::model::attendance_analytics::StatusDistribution {
        full_days: total_full_days,
        half_days: total_half_days,
        absent_days: total_absent_days,
    };

    // 7. Map to DTOs
    let daily_hours_dto: Vec<DailyHoursBreakdown> =
        daily_hours.iter().map(DailyHoursBreakdown::from).collect();
    let weekly_hours_dto: Vec<WeeklyHours> = weekly_hours.iter().map(WeeklyHours::from).collect();
    let status_dto = status_distribution_to_response(&combined_status);

    let employees: Vec<EmployeeReportKpi> = all_employee_kpis
        .iter()
        .map(|ek| {
            let mut kpi = EmployeeReportKpi::from(ek);
            kpi.employee_name = emp_names.get(&ek.user_pin).cloned();
            kpi
        })
        .collect();

    let avg_seconds_per_day = if !employees.is_empty() && work_days_count > 0 {
        employees.iter().map(|e| e.avg_seconds_per_day).sum::<i64>() / employees.len() as i64
    } else {
        0
    };
    let overtime_seconds = employees.iter().map(|e| e.overtime_seconds).sum();

    let daily_breakdown: Vec<DailyBreakdown> =
        day_counts.into_iter().map(|(date, count)| DailyBreakdown { date, count }).collect();

    let summary = ReportSummaryResponse {
        date_from: date_from.as_second(),
        date_to: date_to.as_second(),
        total_punches: punches.len() as u64,
        check_ins,
        check_outs,
        break_outs,
        break_ins,
        overtime_ins,
        overtime_outs,
        unique_users: users.len() as u64,
        work_days: work_days_count,
        avg_seconds_per_day,
        overtime_seconds,
        absence_rate: combined_status.absence_rate_pct(),
        daily_hours: daily_hours_dto,
        weekly_hours: weekly_hours_dto,
        status_distribution: status_dto,
        employees,
        daily_breakdown,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Helpers ───────────────────────────────────────────────────────────

/// Resolve effective work policies for a set of user PINs.
///
/// For each PIN:
/// 1. Look up the employee by PIN → get their department
/// 2. Look up the department → check for custom work_policy
/// 3. Fall back to `org_default` if no employee or no department policy
async fn resolve_policies_for_pins(
    storage: &dyn timekeep_core::traits::Storage,
    employees: Option<&dyn timekeep_core::traits::employee_store::EmployeeStore>,
    pins: &HashSet<&str>,
    org_default: &timekeep_core::model::work_policy::WorkPolicy,
) -> HashMap<String, timekeep_core::model::work_policy::WorkPolicy> {
    let mut map = HashMap::new();

    // Batch-load all departments once
    let departments = match storage.list_departments().await {
        Ok(depts) => depts,
        Err(_) => {
            // Fallback: all pins use org default
            for pin in pins {
                map.insert(pin.to_string(), org_default.clone());
            }
            return map;
        },
    };

    // Build a name→policy lookup from departments
    let dept_policies: HashMap<&str, &timekeep_core::model::work_policy::WorkPolicy> = departments
        .iter()
        .filter_map(|d| d.work_policy.as_ref().map(|p| (d.name.as_str(), p)))
        .collect();

    for pin in pins {
        let policy = if let Some(repo) = employees {
            match repo.find_employee_by_pin(pin).await {
                Ok(Some(emp)) => match &emp.department {
                    Some(dept_name) => dept_policies
                        .get(dept_name.as_str())
                        .map(|&p| p.clone())
                        .unwrap_or_else(|| org_default.clone()),
                    None => org_default.clone(),
                },
                _ => org_default.clone(),
            }
        } else {
            org_default.clone()
        };
        map.insert(pin.to_string(), policy);
    }

    map
}
