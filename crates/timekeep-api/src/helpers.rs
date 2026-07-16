//! Shared helpers for API route handlers.
//!
//! Pure functions that are reused across multiple handlers.
//! These are NOT domain logic — they're infrastructure/coordination helpers
//! for the HTTP layer. Domain logic lives in `timekeep-core`.

use jiff::Timestamp;

/// Compute "midnight today" in UTC as a `jiff::Timestamp`.
///
/// Returns the timestamp corresponding to `00:00:00` of the current
/// UTC date. Used by dashboard and report handlers to define "today's"
/// date range.
///
/// # Panics
///
/// Panics if the system clock produces an invalid date/time combination.
/// In practice this only happens with garbage time values from the OS.
pub fn today_midnight_utc(now: Timestamp) -> Timestamp {
    let z = now.to_zoned(jiff::tz::TimeZone::UTC);
    jiff::civil::DateTime::from_parts(
        z.datetime().date(),
        jiff::civil::Time::new(0, 0, 0, 0).expect("00:00:00 is valid"),
    )
    .to_zoned(jiff::tz::TimeZone::UTC)
    .expect("midnight UTC is always a valid zoned instant")
    .timestamp()
}

/// Resolve the organization's default `WorkPolicy` from system settings.
///
/// Used by dashboard, report, and employee handlers that need the
/// company-wide work schedule for attendance calculations.
///
/// Returns `WorkPolicy::default()` if settings cannot be loaded
/// (graceful degradation when storage is unavailable).
pub async fn org_work_policy(
    storage: &dyn timekeep_core::traits::Storage,
) -> timekeep_core::WorkPolicy {
    storage.get_system_settings().await.map(|s| s.work_policy).unwrap_or_default()
}

/// Resolve date range from optional epoch-second `from`/`to` parameters.
///
/// Defaults to the last 7 days when no bounds are provided.
/// Returns `(Some(since), Some(until))` — both are always `Some`.
pub fn resolve_date_range(
    from: Option<i64>,
    to: Option<i64>,
) -> (Option<Timestamp>, Option<Timestamp>) {
    let now = Timestamp::now();
    let default_since =
        now.saturating_sub(jiff::Span::new().try_days(7).expect("7 days")).unwrap_or(now);
    let since = from.and_then(|ts| Timestamp::from_second(ts).ok()).unwrap_or(default_since);
    let until = to.and_then(|ts| Timestamp::from_second(ts).ok()).unwrap_or(now);
    (Some(since), Some(until))
}

/// Collect unique user PINs from a slice of punches.
///
/// Returns a `HashSet<&str>` of all distinct PINs present in the data.
#[inline]
pub fn unique_pins(punches: &[timekeep_core::AttendancePunch]) -> std::collections::HashSet<&str> {
    punches.iter().map(|p| p.user_pin.as_str()).collect()
}

/// Extract employee name from a punch, falling back to the PIN.
///
/// When the employee repository has enriched the punch with a name,
/// it's used. Otherwise the PIN is returned as a display fallback.
#[inline]
pub fn punch_display_name(punch: &timekeep_core::AttendancePunch) -> String {
    punch.employee_name.clone().unwrap_or_else(|| punch.user_pin.clone())
}

/// Build a map of PIN → employee name from a list of enriched punches.
///
/// First non-None name wins per PIN (consistent with punch enrichment order).
pub fn collect_employee_names(
    punches: &[timekeep_core::AttendancePunch],
) -> std::collections::HashMap<String, String> {
    let mut names = std::collections::HashMap::new();
    for p in punches {
        if let Some(ref name) = p.employee_name {
            names.entry(p.user_pin.clone()).or_insert_with(|| name.clone());
        }
    }
    names
}


