//! Dashboard summary and report handlers.

use std::collections::{BTreeMap, HashMap, HashSet};

use axum::Json;
use axum::extract::{Query, State};

use crate::app_state::AppState;
use crate::dto::{
    AnomalyResponse, CurrentlyCheckedIn, DashboardDeviceHealth, DashboardHourlyBreakdown,
    DashboardRecentEvent, DepartmentAttendanceResponse, MonthlyTrendResponse, TodaySummaryResponse,
};
use crate::request::{ReportSummaryQuery, WorkDayQuery};
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
    use timekeep_core::AttendanceCalculator;
    use timekeep_core::PunchStatus;

    let now = jiff::Timestamp::now();
    let org_default = crate::helpers::org_work_policy(&*state.storage).await;
    let today_start = crate::helpers::today_midnight_utc(now);

    let punches =
        state.storage.query_punches_unpaged(&Default::default(), Some(today_start), None).await?;

    // ── Resolve per-employee policies for late detection ──
    let unique_pins = crate::helpers::unique_pins(&punches);
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        &org_default,
    )
    .await;

    // ── Total employees (from employee repository, fallback to unique users today) ──
    let total_employees = if let Some(ref repo) = state.employees {
        repo.count_active_employees().await.unwrap_or(unique_pins.len() as u64) as usize
    } else {
        unique_pins.len()
    };

    // ── Domain logic: present/absent/late/on_time/checked-in/hourly ──
    let snapshot = AttendanceCalculator::project_today_snapshot(
        &punches,
        &policy_map,
        &org_default,
        total_employees,
    );

    let check_ins = punches.iter().filter(|p| p.status == PunchStatus::CheckIn).count();

    // ── Infrastructure: device labels for checked-in employees ──
    let device_configs = state.storage.list_device_configs().await?;
    let device_label_map: HashMap<&str, &str> =
        device_configs.iter().map(|c| (c.serial_number.as_str(), c.label.as_str())).collect();

    let currently_checked_in: Vec<CurrentlyCheckedIn> = snapshot
        .currently_checked_in
        .iter()
        .filter_map(|c| {
            // Find the matching punch to get device_sn, employee_name, and compute elapsed
            let check_in_punch = punches.iter().find(|p| {
                p.user_pin == c.user_pin
                    && p.status == PunchStatus::CheckIn
                    && p.timestamp.as_second() == c.check_in_epoch
            })?;
            let elapsed = now.duration_since(check_in_punch.timestamp).as_secs().max(0);
            Some(CurrentlyCheckedIn {
                user_pin: c.user_pin.clone(),
                employee_name: check_in_punch.employee_name.clone(),
                check_in_time: c.check_in_epoch,
                device_sn: check_in_punch.device_sn.clone(),
                device_label: device_label_map
                    .get(check_in_punch.device_sn.as_str())
                    .map(|l| l.to_string()),
                elapsed_seconds: elapsed,
            })
        })
        .collect();

    // ── Infrastructure: recent events, device health, hourly breakdown ──
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

    let hourly_breakdown: Vec<DashboardHourlyBreakdown> = (0..24u8)
        .map(|hour| DashboardHourlyBreakdown {
            hour,
            count: snapshot.hourly_breakdown[hour as usize],
        })
        .filter(|h| h.count > 0)
        .collect();

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
        present: snapshot.present,
        absent: snapshot.absent,
        late: snapshot.late,
        on_time: snapshot.on_time,
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
    let org_default = crate::helpers::org_work_policy(&*state.storage).await;

    // 1. Resolve date range
    let day_start = crate::helpers::today_midnight_utc(now);

    let date_from =
        params.date_from.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(day_start);
    let date_to =
        params.date_to.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(now);

    // Validation: date_from must be before date_to
    if date_from > date_to {
        return Err(AppError::validation("date_from must be before date_to"));
    }

    let from_date = date_from.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let to_date = date_to.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let work_days_count = org_default.count_working_days(from_date, to_date);

    // 2. Parse filter criteria from shared PunchCriteria
    let criteria = &params.criteria;
    let user_pins: Option<Vec<String>> = {
        let pins = criteria.user_pins_vec();
        if pins.is_empty() { None } else { Some(pins) }
    };
    let device_sns: Vec<String> = criteria.device_sns_vec();

    // 3. Resolve department_ids → employee PINs
    let department_pins: Option<Vec<String>> = if let Some(ref dept_csv) = params.department_ids {
        let dept_ids: Vec<String> =
            dept_csv.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        if dept_ids.is_empty() {
            None
        } else if let Some(ref repo) = state.employees {
            let filter = timekeep_core::EmployeeFilter {
                department_ids: Some(dept_ids),
                active: Some(true),
                ..Default::default()
            };
            match repo.list_employees_filtered(&filter).await {
                Ok(result) => {
                    let pins: Vec<String> = result.items.iter().map(|e| e.pin.clone()).collect();
                    if pins.is_empty() { None } else { Some(pins) }
                },
                Err(e) => {
                    tracing::warn!(error = %e, "failed to list employees in departments");
                    None
                },
            }
        } else {
            tracing::warn!("department_ids filter requested but no employee repository available");
            None
        }
    } else {
        None
    };

    // 4. Merge user_pins + department_pins (union, OR logic)
    let effective_user_pins: Option<Vec<String>> = match (user_pins, department_pins) {
        (Some(mut u), Some(d)) => {
            for pin in d {
                if !u.contains(&pin) {
                    u.push(pin);
                }
            }
            Some(u)
        },
        (Some(u), None) => Some(u),
        (None, Some(d)) => Some(d),
        (None, None) => None,
    };

    // 5. Fetch raw data via the dedicated aggregate query method
    let mut criteria = params.criteria.clone();
    if let Some(ref pins) = effective_user_pins {
        criteria.user_pins = Some(pins.join(","));
    }
    let punches = state
        .storage
        .query_punches_unpaged(&criteria, Some(date_from), Some(date_to))
        .await?;

    // 6. Basic counts
    let mut check_ins: u64 = 0;
    let mut check_outs: u64 = 0;
    let mut break_outs: u64 = 0;
    let mut break_ins: u64 = 0;
    let mut overtime_ins: u64 = 0;
    let mut overtime_outs: u64 = 0;
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
        let day_ts = crate::helpers::today_midnight_utc(punch.timestamp).as_second();
        *day_counts.entry(day_ts).or_insert(0u64) += 1;
    }

    let users_count = crate::helpers::unique_pins(&punches).len();
    let emp_names = crate::helpers::collect_employee_names(&punches);

    // 7. Resolve per-employee policies and department mappings
    let unique_pins = crate::helpers::unique_pins(&punches);
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        &org_default,
    )
    .await;

    // Resolve employee → department mapping for KPI enrichment
    let pin_department_map: HashMap<String, (String, String)> = {
        let mut map = HashMap::new();
        if let Some(ref repo) = state.employees {
            let departments = state.storage.list_departments().await.unwrap_or_default();
            let dept_name_map: HashMap<&str, &str> =
                departments.iter().map(|d| (d.id.0.as_str(), d.name.as_str())).collect();
            for pin in &unique_pins {
                if let Ok(Some(emp)) = repo.find_employee_by_pin(pin).await {
                    if let Some(ref dept_id) = emp.department_id {
                        let name =
                            dept_name_map.get(dept_id.as_str()).copied().unwrap_or("Unknown");
                        map.insert(pin.to_string(), (dept_id.clone(), name.to_string()));
                    }
                }
            }
        }
        map
    };

    // 8. Group punches by their effective policy for correct per-policy computation
    let mut policy_groups: HashMap<String, Vec<&timekeep_core::model::AttendancePunch>> =
        HashMap::new();
    for p in &punches {
        let policy = policy_map.get(p.user_pin.as_str()).unwrap_or(&org_default);
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

    // 9. Compute per policy group and merge results
    let mut all_work_days: Vec<timekeep_core::model::work_day::WorkDay> = Vec::new();
    let mut all_employee_kpis: Vec<timekeep_core::model::attendance_analytics::EmployeeKpi> =
        Vec::new();
    let mut total_full_days = 0u64;
    let mut total_half_days = 0u64;
    let mut total_absent_days = 0u64;

    for group_punches in policy_groups.values() {
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

    // 10. Aggregate across all policy groups
    let daily_hours = AttendanceCalculator::aggregate_daily_hours(&all_work_days);
    let weekly_hours = AttendanceCalculator::aggregate_weekly_hours(&daily_hours);

    // Combined status distribution
    let combined_status = timekeep_core::model::attendance_analytics::StatusDistribution {
        full_days: total_full_days,
        half_days: total_half_days,
        absent_days: total_absent_days,
    };

    // 11. Map to DTOs with department enrichment
    let daily_hours_dto: Vec<DailyHoursBreakdown> =
        daily_hours.iter().map(DailyHoursBreakdown::from).collect();
    let weekly_hours_dto: Vec<WeeklyHours> = weekly_hours.iter().map(WeeklyHours::from).collect();
    let status_dto = status_distribution_to_response(&combined_status);

    let employees: Vec<EmployeeReportKpi> = all_employee_kpis
        .iter()
        .map(|ek| {
            let mut kpi = EmployeeReportKpi::from(ek);
            kpi.employee_name = emp_names.get(&ek.user_pin).cloned();
            if let Some((dept_id, dept_name)) = pin_department_map.get(&ek.user_pin) {
                kpi.department_id = Some(dept_id.clone());
                kpi.department_name = Some(dept_name.clone());
            }
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

    // Build applied_filters echo
    let applied_filters = crate::response::AppliedFilters {
        user_pins: Some(params.criteria.user_pins_vec()).filter(|v| !v.is_empty()),
        department_ids: params.department_ids.as_ref().map(|s| {
            s.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
        }),
        device_sns: Some(params.criteria.device_sns_vec()).filter(|v| !v.is_empty()),
        statuses: params.criteria.statuses.clone().map(|s| {
            s.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
        }),
    };

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
        unique_users: users_count as u64,
        work_days: work_days_count,
        avg_seconds_per_day,
        overtime_seconds,
        absence_rate: combined_status.absence_rate_pct(),
        daily_hours: daily_hours_dto,
        weekly_hours: weekly_hours_dto,
        status_distribution: status_dto,
        employees,
        daily_breakdown,
        applied_filters: Some(applied_filters),
        generated_at: now.as_second(),
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
pub(crate) async fn resolve_policies_for_pins(
    storage: &dyn timekeep_core::traits::Storage,
    employees: Option<&dyn timekeep_core::traits::employee_store::EmployeeStore>,
    pins: &HashSet<&str>,
    org_default: &timekeep_core::WorkPolicy,
) -> HashMap<String, timekeep_core::WorkPolicy> {
    let mut map = HashMap::new();

    let departments = match storage.list_departments().await {
        Ok(depts) => depts,
        Err(_) => {
            for pin in pins {
                map.insert(pin.to_string(), org_default.clone());
            }
            return map;
        },
    };

    let dept_policies: HashMap<&str, &timekeep_core::WorkPolicy> = departments
        .iter()
        .filter_map(|d| d.work_policy.as_ref().map(|p| (d.id.0.as_str(), p)))
        .collect();

    for pin in pins {
        let policy = if let Some(repo) = employees {
            match repo.find_employee_by_pin(pin).await {
                Ok(Some(emp)) => match &emp.department_id {
                    Some(dept_id) => dept_policies
                        .get(dept_id.as_str())
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

// ── Org-level monthly trend ──────────────────────────────────────

/// Get organisation-wide monthly attendance trend.
///
/// Returns one data point per month with the attendance percentage
/// across all employees for the given date range.
#[utoipa::path(
    get,
    path = "/api/reports/monthly-trend",
    tag = "Reports",
    security(("bearer_auth" = [])),
    params(WorkDayQuery),
    responses(
        (status = 200, description = "Monthly attendance trend", body = Vec<MonthlyTrendResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn monthly_trend(
    State(state): State<AppState>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<Vec<MonthlyTrendResponse>>>, AppError> {
    use timekeep_core::AttendanceCalculator;

    let org_default = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches_unpaged(&Default::default(), since, until)
        .await?;

    // ── Resolve per-employee policies for correct late/status detection ──
    let unique_pins = crate::helpers::unique_pins(&punches);
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        &org_default,
    )
    .await;

    let work_days =
        AttendanceCalculator::compute_work_days_per_pin(&punches, &policy_map, &org_default);

    let from_date = since.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());
    let to_date = until.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());

    let trend = if let (Some(from), Some(to)) = (from_date, to_date) {
        AttendanceCalculator::compute_monthly_trend(&work_days, &org_default, from, to)
    } else {
        Vec::new()
    };

    let responses: Vec<MonthlyTrendResponse> =
        trend.iter().map(MonthlyTrendResponse::from).collect();

    Ok(Json(ApiEnvelope::success(responses)))
}

// ── Department attendance summary ─────────────────────────────────

/// Get attendance summary grouped by department.
///
/// Returns per-department present/late counts, hours, and attendance
/// percentage for the given date range.
#[utoipa::path(
    get,
    path = "/api/reports/by-department",
    tag = "Reports",
    security(("bearer_auth" = [])),
    params(WorkDayQuery),
    responses(
        (status = 200, description = "Department attendance summary", body = Vec<DepartmentAttendanceResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn department_attendance(
    State(state): State<AppState>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<Vec<DepartmentAttendanceResponse>>>, AppError> {
    use timekeep_core::AttendanceCalculator;

    let org_default = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches_unpaged(&Default::default(), since, until)
        .await?;

    // ── Resolve per-employee policies for correct late/status detection ──
    let unique_pins = crate::helpers::unique_pins(&punches);
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        &org_default,
    )
    .await;

    let work_days =
        AttendanceCalculator::compute_work_days_per_pin(&punches, &policy_map, &org_default);

    // ── Resolve employee → department mapping ──
    let departments = state.storage.list_departments().await.unwrap_or_default();
    let dept_name_map: HashMap<&str, &str> =
        departments.iter().map(|d| (d.id.0.as_str(), d.name.as_str())).collect();

    // Build department → effective policy map
    let dept_policy_map: HashMap<String, timekeep_core::WorkPolicy> = departments
        .iter()
        .map(|d| {
            let policy = d.work_policy.as_ref().cloned().unwrap_or_else(|| org_default.clone());
            (d.id.0.clone(), policy)
        })
        .collect();

    let mut pin_to_dept: HashMap<String, (String, String)> = HashMap::new(); // pin → (dept_id, dept_name)
    if let Some(ref repo) = state.employees {
        for pin in &unique_pins {
            if let Ok(Some(emp)) = repo.find_employee_by_pin(pin).await
                && let Some(ref dept_id) = emp.department_id
            {
                let name = dept_name_map.get(dept_id.as_str()).copied().unwrap_or("Unknown");
                pin_to_dept.insert(pin.to_string(), (dept_id.clone(), name.to_string()));
            }
        }
    }

    // ── Aggregate work days by department ──
    let mut dept_work_days: HashMap<String, (String, Vec<&timekeep_core::WorkDay>)> =
        HashMap::new();
    for wd in &work_days {
        if let Some((dept_id, dept_name)) = pin_to_dept.get(&wd.user_pin) {
            dept_work_days
                .entry(dept_id.clone())
                .or_insert_with(|| (dept_name.clone(), Vec::new()))
                .1
                .push(wd);
        }
    }

    let from_date = since.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());
    let to_date = until.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());

    let mut results = Vec::new();
    if let (Some(from), Some(to)) = (from_date, to_date) {
        for (dept_id, (dept_name, days)) in &dept_work_days {
            // Use this department's effective policy for working-day counting
            let dept_policy = dept_policy_map.get(dept_id).unwrap_or(&org_default);

            // Count unique employee-days with attendance
            let mut attended_days: HashSet<(String, jiff::civil::Date)> = HashSet::new();
            let mut late_count: u64 = 0;
            let mut total_regular: i64 = 0;
            let mut total_overtime: i64 = 0;

            for wd in days {
                attended_days.insert((wd.user_pin.clone(), wd.date));
                total_regular += wd.net_work_seconds();
                total_overtime += wd.total_overtime_seconds;
                if wd.status == timekeep_core::DayStatus::Late {
                    late_count += 1;
                }
            }

            // Count working days in range using the department's effective policy
            let mut working_days_in_range: u64 = 0;
            let mut cursor = from;
            loop {
                if cursor > to {
                    break;
                }
                let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
                if dept_policy.is_working_day(weekday) {
                    working_days_in_range += 1;
                }
                cursor = match cursor.tomorrow() {
                    Ok(d) => d,
                    Err(_) => break,
                };
            }

            let unique_dept_employees: HashSet<&str> =
                days.iter().map(|d| d.user_pin.as_str()).collect();
            let max_possible = working_days_in_range * unique_dept_employees.len() as u64;
            let attendance_pct = if max_possible > 0 {
                (attended_days.len() as f64 / max_possible as f64 * 100.0).min(100.0)
            } else {
                0.0
            };

            results.push(DepartmentAttendanceResponse {
                department_id: dept_id.clone(),
                department_name: dept_name.clone(),
                present: unique_dept_employees.len() as u64,
                late: late_count,
                total_regular_seconds: total_regular,
                total_overtime_seconds: total_overtime,
                attendance_pct: (attendance_pct * 100.0).round() / 100.0,
            });
        }
    }

    // Sort by attendance % descending
    results.sort_by(|a, b| {
        b.attendance_pct.partial_cmp(&a.attendance_pct).unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(Json(ApiEnvelope::success(results)))
}

// ── Anomalies list ────────────────────────────────────────────────

/// List detected attendance anomalies for a date range.
#[utoipa::path(
    get,
    path = "/api/reports/anomalies",
    tag = "Reports",
    security(("bearer_auth" = [])),
    params(WorkDayQuery),
    responses(
        (status = 200, description = "List of anomalies", body = Vec<AnomalyResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_anomalies(
    State(state): State<AppState>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<Vec<AnomalyResponse>>>, AppError> {
    use timekeep_core::AttendanceCalculator;

    let org_default = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches_unpaged(&Default::default(), since, until)
        .await?;

    // ── Resolve per-employee policies for correct anomaly detection ──
    let unique_pins = crate::helpers::unique_pins(&punches);
    let policy_map = resolve_policies_for_pins(
        &*state.storage,
        state.employees.as_deref(),
        &unique_pins,
        &org_default,
    )
    .await;

    let work_days =
        AttendanceCalculator::compute_work_days_per_pin(&punches, &policy_map, &org_default);

    let mut responses = Vec::new();
    for wd in &work_days {
        let date_str = wd.date.to_string();
        for anomaly in &wd.anomalies {
            responses.push(AnomalyResponse::from_anomaly(anomaly, &wd.user_pin, &date_str));
        }
    }

    // Sort by timestamp descending (most recent first)
    responses.sort_by_key(|r| std::cmp::Reverse(r.timestamp));

    Ok(Json(ApiEnvelope::success(responses)))
}
