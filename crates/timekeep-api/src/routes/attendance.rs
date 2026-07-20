//! Attendance calendar & timeline endpoints.
//!
//! These endpoints serve pre-computed, view-optimized responses instead of
//! sending raw punches over HTTP. The backend is the single source of truth
//! for classification, aggregation, and block-building.
//!
//! ## Endpoints
//!
//! | Method | Path                       | Auth   | Description |
//! |--------|----------------------------|--------|-------------|
//! | GET    | /api/attendance/calendar   | Viewer | Month calendar with per-employee day status |
//! | GET    | /api/attendance/timeline   | Viewer | Single day with timeline blocks per employee |

use axum::{
    Json,
    extract::{Query, State},
};
use jiff::civil::Date;
use std::collections::{HashMap, HashSet};

use crate::AppState;
use crate::dto::{
    CalendarEmployeeDay, CalendarMonthResponse, TimelineBlock, TimelineDayResponse,
    TimelineEmployeeBlocks,
};
use crate::request::{CalendarQuery, TimelineQuery};
use crate::response::{ApiEnvelope, AppError};
use crate::routes::dashboard::resolve_policies_for_pins;
use timekeep_core::query::ListParams;
use timekeep_core::services::attendance_calculator::AttendanceCalculator;
use timekeep_core::{PunchFilter, PunchStatus, REPORT_MAX_ROWS};

// ── Shared helpers ────────────────────────────────────────────────────

fn parse_csv(opt: &Option<String>) -> Vec<String> {
    opt.as_deref()
        .map(|s| s.split(',').map(str::trim).filter(|s| !s.is_empty()).map(String::from).collect())
        .unwrap_or_default()
}

/// Build optional punch status filter from comma-separated string.
fn build_status_filter(raw: &Option<String>) -> Option<Vec<PunchStatus>> {
    raw.as_deref().map(|s| s.split(',').filter_map(|part| parse_status(part.trim())).collect())
}

fn parse_status(s: &str) -> Option<PunchStatus> {
    match s {
        "check_in" => Some(PunchStatus::CheckIn),
        "check_out" => Some(PunchStatus::CheckOut),
        "break_in" => Some(PunchStatus::BreakIn),
        "break_out" => Some(PunchStatus::BreakOut),
        "overtime_in" => Some(PunchStatus::OvertimeIn),
        "overtime_out" => Some(PunchStatus::OvertimeOut),
        _ => None,
    }
}

/// Build a PunchFilter for a date range with optional view filters.
fn build_filter(
    since: jiff::Timestamp,
    until: jiff::Timestamp,
    device_sns: Option<Vec<String>>,
    user_pins: Option<Vec<String>>,
    status: &Option<String>,
) -> PunchFilter {
    PunchFilter {
        since: Some(since),
        until: Some(until),
        device_sns,
        user_pins,
        statuses: build_status_filter(status),
        unlimited: true,
        params: ListParams { limit: REPORT_MAX_ROWS, ..Default::default() },
        ..Default::default()
    }
}

// ── Calendar endpoint ─────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/attendance/calendar",
    tag = "Attendance",
    security(("bearer_auth" = [])),
    params(CalendarQuery),
    responses(
        (status = 200, description = "Calendar month data", body = CalendarMonthResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn calendar(
    State(state): State<AppState>,
    Query(q): Query<CalendarQuery>,
) -> Result<Json<ApiEnvelope<CalendarMonthResponse>>, AppError> {
    let (since, until) = month_bounds(q.year, q.month)?;
    let punches = fetch_punches(&state, since, until, &q).await?;
    let work_days = compute_work_days(&state, &punches).await?;

    let mut days: HashMap<String, Vec<CalendarEmployeeDay>> = HashMap::new();
    for wd in &work_days {
        let entry = CalendarEmployeeDay::from_work_day(wd);
        days.entry(wd.date.to_string()).or_default().push(entry);
    }

    Ok(Json(ApiEnvelope::success(CalendarMonthResponse { year: q.year, month: q.month, days })))
}

/// Calculate since/until for a calendar month with ±7 days padding.
fn month_bounds(year: i16, month: i8) -> Result<(jiff::Timestamp, jiff::Timestamp), AppError> {
    use jiff::civil::{Date, Time};
    use jiff::tz::TimeZone;

    let first = Date::new(year, month, 1)
        .map_err(|e| AppError::validation(format!("invalid year/month: {e}")))?;

    // Walk forward to find the last day of the month
    let mut last = first;
    loop {
        let next =
            last.tomorrow().map_err(|e| AppError::validation(format!("date overflow: {e}")))?;
        if next.month() != month {
            break;
        }
        last = next;
    }

    // Build UTC timestamps at midnight
    let first_ts = jiff::civil::DateTime::from_parts(first, Time::midnight())
        .to_zoned(TimeZone::UTC)
        .map_err(|e| AppError::validation(format!("tz: {e}")))?
        .timestamp();
    let last_ts = jiff::civil::DateTime::from_parts(last, Time::midnight())
        .to_zoned(TimeZone::UTC)
        .map_err(|e| AppError::validation(format!("tz: {e}")))?
        .timestamp();

    let pad = jiff::Span::new().try_days(7).expect("7 days");
    let since = first_ts.saturating_sub(pad).unwrap_or(first_ts);
    let until = last_ts.saturating_add(pad).unwrap_or(last_ts);

    Ok((since, until))
}

async fn fetch_punches(
    state: &AppState,
    since: jiff::Timestamp,
    until: jiff::Timestamp,
    q: &CalendarQuery,
) -> Result<Vec<timekeep_core::AttendancePunch>, AppError> {
    let device_sns = q.device_sns.as_ref().map(|s| parse_csv(&Some(s.clone())));
    let user_pins = q.user_pins.as_ref().map(|s| parse_csv(&Some(s.clone())));
    let filter = build_filter(since, until, device_sns, user_pins, &q.status);
    Ok(state.storage.query_punches(&filter).await?)
}

async fn compute_work_days(
    state: &AppState,
    punches: &[timekeep_core::AttendancePunch],
) -> Result<Vec<timekeep_core::model::WorkDay>, AppError> {
    let org_policy = crate::helpers::org_work_policy(&*state.storage).await;
    let pins: HashSet<&str> = punches.iter().map(|p| p.user_pin.as_str()).collect();
    let policy_map =
        resolve_policies_for_pins(&*state.storage, state.employees.as_deref(), &pins, &org_policy)
            .await;
    Ok(AttendanceCalculator::compute_work_days_per_pin(punches, &policy_map, &org_policy))
}

// ── Timeline endpoint ─────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/attendance/timeline",
    tag = "Attendance",
    security(("bearer_auth" = [])),
    params(TimelineQuery),
    responses(
        (status = 200, description = "Timeline day data", body = TimelineDayResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn timeline(
    State(state): State<AppState>,
    Query(q): Query<TimelineQuery>,
) -> Result<Json<ApiEnvelope<TimelineDayResponse>>, AppError> {
    let date = q
        .date
        .parse::<Date>()
        .map_err(|e| AppError::validation(format!("invalid date '{}': {e}", q.date)))?;

    let start_dt = jiff::civil::DateTime::from_parts(date, jiff::civil::Time::midnight());
    let end_dt =
        jiff::civil::DateTime::from_parts(date, jiff::civil::Time::new(23, 59, 59, 0).unwrap());

    let since = start_dt
        .to_zoned(jiff::tz::TimeZone::UTC)
        .map_err(|e| AppError::validation(format!("tz: {e}")))?
        .timestamp();
    let until = end_dt
        .to_zoned(jiff::tz::TimeZone::UTC)
        .map_err(|e| AppError::validation(format!("tz: {e}")))?
        .timestamp();

    let device_sns = q.device_sns.as_ref().map(|s| parse_csv(&Some(s.clone())));
    let user_pins = q.user_pins.as_ref().map(|s| parse_csv(&Some(s.clone())));
    let filter = build_filter(since, until, device_sns, user_pins, &q.status);
    let punches = state.storage.query_punches(&filter).await?;

    let employees = build_timeline_employees(&punches);

    Ok(Json(ApiEnvelope::success(TimelineDayResponse { date: q.date, employees })))
}

// ── Timeline block building (ported from frontend compute.ts) ─────────

fn build_timeline_employees(
    punches: &[timekeep_core::AttendancePunch],
) -> Vec<TimelineEmployeeBlocks> {
    let mut groups: HashMap<String, Vec<&timekeep_core::AttendancePunch>> = HashMap::new();
    for p in punches {
        groups.entry(p.user_pin.clone()).or_default().push(p);
    }

    let mut employees: Vec<TimelineEmployeeBlocks> = groups
        .into_iter()
        .map(|(pin, day_punches)| build_single_employee(&pin, &day_punches))
        .collect();

    employees.sort_by(|a, b| a.name.cmp(&b.name));
    employees
}

fn build_single_employee(
    pin: &str,
    punches: &[&timekeep_core::AttendancePunch],
) -> TimelineEmployeeBlocks {
    let mut sorted: Vec<&timekeep_core::AttendancePunch> = punches.to_vec();
    sorted.sort_by_key(|p| p.timestamp);

    let name =
        sorted.iter().find_map(|p| p.employee_name.clone()).unwrap_or_else(|| pin.to_string());

    let summary = compute_summary(pin, &sorted);
    let blocks = build_timeline_blocks(&sorted);

    TimelineEmployeeBlocks { pin: pin.to_string(), name, blocks, summary }
}

fn compute_summary(pin: &str, punches: &[&timekeep_core::AttendancePunch]) -> CalendarEmployeeDay {
    let _events: Vec<crate::dto::AttendanceEvent> = punches
        .iter()
        .map(|p| {
            let ts = p.timestamp.as_second();
            let d = jiff::Timestamp::from_second(ts)
                .unwrap()
                .to_zoned(jiff::tz::TimeZone::UTC)
                .datetime();
            let time = format!("{:02}:{:02}", d.hour(), d.minute());
            crate::dto::AttendanceEvent {
                timestamp: ts,
                time,
                status: p.status.to_string(),
                is_anomaly: p.is_anomaly,
            }
        })
        .collect();

    let mut present = 0i64;
    let mut break_mins = 0i64;
    let mut overtime = 0i64;
    let mut block_start: Option<(i64, String)> = None;

    for p in punches {
        let ts = p.timestamp.as_second();
        let status = p.status.to_string();
        if is_block_start(&status) {
            if let Some((start, ref s)) = block_start {
                add_duration(s, ts - start, &mut present, &mut break_mins, &mut overtime);
            }
            block_start = Some((ts, status));
        } else if let Some((start, ref s)) = block_start {
            add_duration(s, ts - start, &mut present, &mut break_mins, &mut overtime);
            block_start = None;
        }
    }

    if let Some((start, ref s)) = block_start {
        if let Some(last) = punches.last() {
            add_duration(
                s,
                (last.timestamp.as_second() - start).max(0),
                &mut present,
                &mut break_mins,
                &mut overtime,
            );
        }
    }

    let anomaly_count = punches.iter().filter(|p| p.is_anomaly).count() as u32;

    CalendarEmployeeDay {
        pin: pin.to_string(),
        name: punches.iter().find_map(|p| p.employee_name.clone()).unwrap_or_default(),
        status: String::new(),
        hours: present as f64 / 3600.0,
        overtime_hours: overtime as f64 / 3600.0,
        break_minutes: (break_mins / 60) as u32,
        anomaly_count,
        is_late: false,
    }
}

fn is_block_start(status: &str) -> bool {
    matches!(status, "check_in" | "break_out" | "break_in" | "overtime_in")
}

fn add_duration(
    status: &str,
    seconds: i64,
    present: &mut i64,
    breaks: &mut i64,
    overtime: &mut i64,
) {
    let secs = seconds.max(0);
    match status {
        "check_in" | "break_in" => *present += secs,
        "break_out" => *breaks += secs,
        s if s.starts_with("overtime") => *overtime += secs,
        _ => {},
    }
}

fn build_timeline_blocks(punches: &[&timekeep_core::AttendancePunch]) -> Vec<TimelineBlock> {
    let mut blocks = Vec::new();
    let mut open: Option<(u32, String)> = None;

    for p in punches {
        let minute = timestamp_to_minute(p.timestamp.as_second());
        let status = p.status.to_string();

        if is_block_start(&status) {
            if let Some((start, ref s)) = open {
                blocks.push(make_block(start, minute, s));
            }
            open = Some((minute, status));
        } else if let Some((start, ref s)) = open {
            blocks.push(make_block(start, minute, s));
            open = None;
        } else {
            blocks.push(make_block(minute.saturating_sub(1), minute, &status));
        }
    }

    if let Some((start, ref s)) = open {
        let end = (start + 30).min(24 * 60);
        blocks.push(make_block(start, end, s));
    }

    blocks
}

fn timestamp_to_minute(ts: i64) -> u32 {
    let dt = jiff::Timestamp::from_second(ts).unwrap().to_zoned(jiff::tz::TimeZone::UTC).datetime();
    (dt.hour() as u32) * 60 + dt.minute() as u32
}

fn make_block(start_minute: u32, end_minute: u32, status: &str) -> TimelineBlock {
    let total = (24 * 60) as f64;
    let left = (start_minute as f64 / total) * 100.0;
    let width = ((end_minute.saturating_sub(start_minute)) as f64 / total * 100.0).max(0.5);
    let color = block_color(status);
    let title = format!(
        "{}: {:02}:{:02} - {:02}:{:02}",
        block_label(status),
        start_minute / 60,
        start_minute % 60,
        end_minute / 60,
        end_minute % 60,
    );
    TimelineBlock { left, width, color, title }
}

fn block_color(status: &str) -> String {
    match status {
        "check_in" | "check_out" => "present",
        "break_in" | "break_out" => "warning",
        s if s.starts_with("overtime") => "overtime",
        _ => "default",
    }
    .to_string()
}

fn block_label(status: &str) -> &str {
    match status {
        "check_in" => "Check In",
        "check_out" => "Check Out",
        "break_in" => "Break In",
        "break_out" => "Break Out",
        "overtime_in" => "Overtime In",
        "overtime_out" => "Overtime Out",
        _ => status,
    }
}
