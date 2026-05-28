# Timekeep — UX Deep Dive & Specification

> **Read this before writing any code.** Every page exists to answer a business question.
> If a page doesn't answer its question in under 3 seconds, it fails.

---

## 1. Dashboard — "Who is here right now?"

**Business question:** Do I have the people I need? Is anyone missing? Is a scanner broken?

**Core principle:** The dashboard is an operational live-view, not a report. It answers "right now" questions. Reports answer "over time" questions.

### Layout (top to bottom)

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard                                🕐 14:32 · Today   │
│  Last updated 12s ago                        [Refresh]       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Present │ │  Absent │ │   Late  │ │ On Time │          │
│  │   42    │ │    8    │ │    3    │ │   39    │          │
│  │ of 50   │ │ of 50   │ │  today  │ │  today  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Currently Checked In                          [42]  │   │
│  │                                                      │   │
│  │  Ahmed Al-Sabah    07:42  Main Gate    ·  6h 50m    │   │
│  │  Fatima Hassan     07:55  Main Gate    ·  6h 37m    │   │
│  │  Omar Khalid       08:02  Warehouse B  ·  6h 30m    │   │
│  │  Layla Noor        08:15  Main Gate    ·  6h 17m    │   │
│  │  ...                                                │   │
│  │                              [View all 42 →]        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────────┐  │
│  │  Hourly Arrivals     │ │  Recent Activity             │  │
│  │  ██                  │ │  Ahmed A.  Check In  14:31  │  │
│  │  ██  ██              │ │  Omar K.   Check Out 14:15  │  │
│  │  ██  ██  ██          │ │  Fatima H.  Check In  14:02 │  │
│  │  ██  ██  ██  █       │ │  Layla N.   Break Out 13:47 │  │
│  │  6   7   8   9  10   │ │  ...                        │  │
│  └──────────────────────┘ └──────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Device Status                                      │   │
│  │  🟢 Main Gate    🟢 Warehouse B    🔴 Office Floor  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Specification

**Header bar:**
- Page title "Dashboard"
- Current time displayed prominently, updates every 60s
- "Last updated Xs ago" with manual refresh button
- Date: "Today · Friday, July 11, 2026"

**Metric cards (4 across):**
- **Present:** Count of unique employees who checked in today (regardless of check-out). Show "of N" (total employees). Color: green.
- **Absent:** Total employees minus present. "of N". Color: red.
- **Late:** Employees who checked in after scheduled start (default: 08:00). Count only. Color: amber.
- **On Time:** Present minus late. Color: green.

**Currently Checked In (main section):**
- List of employees who checked in today but have NOT checked out yet
- Each row: employee name (bold), check-in time, device label, elapsed time since check-in ("6h 50m")
- Sorted by check-in time, earliest first
- Show first 5-8 rows, then "[View all N →]" link to a filtered punch view
- Empty state: "No one currently checked in" with illustration
- Auto-refreshes every 30s

**Hourly Arrivals chart:**
- Bar chart: X = hour of day (6, 7, 8, 9, ...), Y = number of check-ins
- Today only. Shows arrival pattern.
- Empty state: "No arrivals yet today"

**Recent Activity feed:**
- Last 10 punch events, newest first
- Each row: employee name, status badge (colored: green=in, red=out, amber=break, blue=OT), time (relative: "2m ago", "1h ago")
- Click a row → opens employee detail

**Device Status (compact footer):**
- Single row of colored dots + device names
- Green = online, red = offline, yellow = degraded (one protocol down)
- Click device → opens device detail panel
- Compact — 40px height, not full cards

### Data needed from backend:
```
GET /api/dashboard/today
→ present, absent, late, on_time, total_employees
→ currently_checked_in: [{pin, name, check_in_time, device_sn, device_label, elapsed_seconds}]
→ hourly_arrivals: [{hour, count}]
→ recent_events: [{pin, name, timestamp, status, device_sn}]
→ device_status: [{sn, label, online}]
```

**Backend work needed:**
- Add `absent`, `late`, `on_time`, `total_employees` to `TodaySummaryResponse`
- Add `currently_checked_in` list (employees with check-in but no check-out today)
- Late detection: compare check-in time against a configurable start time (default 08:00)
- Total employees: count from employees table

---

## 2. Reports — "How did we do?"

**Business question:** What are our attendance trends? Who are our problem employees? How many hours did we work?

**Core principle:** Reports answer "over time" questions. They must load with data immediately (default to "This Month"). Every chart must have a business purpose — not decoration.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Reports                                                    │
│  Attendance trends, workforce hours, and employee KPIs      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Today] [This Week] [This Month] [Last Month] [Custom ▾]   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Work Days│ │ Avg Hours│ │ Overtime │ │ Absence Rate │   │
│  │    22    │ │   8.2h   │ │  12.5h   │ │    4.2%      │   │
│  │ this mo. │ │ per day  │ │  total   │ │  this month  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Daily Hours — This Month                           │   │
│  │                                                      │   │
│  │  8.5h │         ██                                   │   │
│  │       │     ██  ██  ██      ██                       │   │
│  │  8.0h │ ██  ██  ██  ██  ██  ██  ██  ██             │   │
│  │       │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██     │   │
│  │  7.5h │ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██     │   │
│  │       ├───┬───┬───┬───┬───┬───┬───┬───┬───┬───     │   │
│  │        1   2   3   4   5   8   9  10  11  12         │   │
│  │                                                      │   │
│  │  ██ Regular Hours  ██ Overtime                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────────┐  │
│  │  Week-over-Week      │ │  Attendance Status           │  │
│  │                      │ │  Distribution                │  │
│  │  W27  280h ████████  │ │       ┌─────┐               │  │
│  │  W28  295h █████████ │ │  Full │█████│ 78%           │  │
│  │  W27  310h ██████████│ │  Half │█░░░░│ 12%           │  │
│  │                      │ │ Absent│██░░░│ 10%           │  │
│  └──────────────────────┘ └──────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Employee Attendance — This Month            [Search]│   │
│  │                                                      │   │
│  │  Name           Present  Absent  Late  Avg Hrs  OT   │   │
│  │  ─────────────  ───────  ──────  ────  ───────  ───  │   │
│  │  Ahmed Al-Sabah   21       1       2     8.3h   2.5  │   │
│  │  Fatima Hassan    22       0       0     8.1h   0    │   │
│  │  Omar Khalid      18       4       5     7.8h   1.0  │   │  ← anomalies
│  │  Layla Noor       20       2       1     8.5h   4.0  │   │
│  │  ...                                                │   │
│  │                              [Export CSV/Excel/PDF] │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Specification

**Period selector (top, always visible):**
- Preset buttons: Today, This Week, This Month, Last Month
- Custom date range picker (from/to)
- Default: **This Month** (page loads with data immediately)
- Changing period refetches all data on the page

**Summary cards (4 across):**
- **Work Days:** Number of working days in the period (excludes weekends by default)
- **Avg Hours:** Average hours worked per employee per day (total regular hours / work days / employees)
- **Overtime:** Total overtime hours in the period
- **Absence Rate:** Percentage of employee-days where the employee was absent (no check-in)

**Daily Hours chart (full width, main chart):**
- Stacked bar chart: X = each working day in the period, Y = hours
- Two stacks: Regular Hours (green) + Overtime Hours (blue)
- Reference line at standard work hours (e.g., 8h)
- Tooltip on hover: date, total hours, regular, overtime
- This chart answers: "Are we working enough? Too much overtime?"

**Week-over-Week comparison (left column):**
- Horizontal bar chart: each bar = one week, value = total hours worked
- Shows trend: increasing/decreasing workforce hours
- This chart answers: "Is our workforce utilization changing?"

**Attendance Status Distribution (right column):**
- Donut chart: Full days (check-in + check-out, ≥ standard hours), Half days (check-in + check-out, < standard hours), Absent (no check-in)
- Percentages with counts
- This chart answers: "What's the quality of our attendance?"

**Employee Attendance Table (full width, bottom):**
- The core report. Every row is an employee, every column is a KPI for the period.
- Columns: Name, Present (days), Absent (days), Late (days), Avg Hours/Day, Overtime Hours, Anomalies (count)
- Sortable by any column. Default sort: anomalies descending (problem employees first)
- Search by name
- Rows with anomalies (>0) highlighted with amber background
- Click employee → opens employee detail page with full attendance history
- Bottom: Export buttons (CSV, Excel, PDF)

### PDF Export Specification:
The PDF export is NOT just a table dump. It's a formatted report:
1. **Cover/header:** "Attendance Report — [Period]" with company name, date generated
2. **Summary section:** The 4 metric cards as a summary block
3. **Daily Hours chart:** Embedded as an image
4. **Status Distribution chart:** Embedded as an image
5. **Employee table:** Full employee attendance table with all columns
6. **Footer:** "Generated by Timekeep — Confidential" with page numbers
7. **Anomaly report:** Separate section listing all anomalies found in the period

### Data needed:
```
GET /api/reports/summary?from=&to=
→ work_days, avg_hours, overtime_hours, absence_rate
→ daily_hours: [{date, regular_hours, overtime_hours}]
→ weekly_hours: [{week, total_hours}]
→ status_distribution: [{status: "full"|"half"|"absent", count, percentage}]
→ employees: [{pin, name, present, absent, late, avg_hours, overtime, anomalies[]}]
```

---

## 3. Punches — "What happened, and was it normal?"

**Business question:** Is there anything wrong with the attendance records? Can I find and fix issues?

**Core principle:** The punches page is for investigation and correction. It must surface anomalies, not just dump raw data.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Punch Records                                              │
│  ⚠️ 3 anomalies detected in current view                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [🔍 Search name/PIN...] [Device ▾] [Status ▾] [Date ▾]    │
│  [✓ Show only anomalies]                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⚠ Time       Employee      Device      Type    Method│   │
│  │ ───────────────────────────────────────────────────── │   │
│  │   14:31:22  Ahmed A.      Main Gate   Check In  Face │   │
│  │ ⚠14:15:00  Omar K.       Warehouse   Check Out Card │   │  ← missing check-in
│  │ ⚠09:02:00  Omar K.       Main Gate   Check In  FP   │   │  ← duplicate (prev 08:45)
│  │   08:45:30  Omar K.       Main Gate   Check In  FP   │   │
│  │   07:55:00  Fatima H.     Main Gate   Check In  FP   │   │
│  │   07:42:15  Ahmed A.      Main Gate   Check In  Face │   │
│  │   ...                                              │   │
│  │                              [Load more ↓]          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Detail Panel ───────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Omar Khalid — PIN 147                               │   │
│  │                                                      │   │
│  │  Today's Punches:                                    │   │
│  │  ⚠ 08:45  Check In   Main Gate   Fingerprint        │   │
│  │  ⚠ 09:02  Check In   Main Gate   Fingerprint  DUPE  │   │
│  │  ⚠ 14:15  Check Out  Warehouse   Card       ORPHAN  │   │
│  │                                                      │   │
│  │  Anomalies: 3                                        │   │
│  │  · Duplicate check-in at 09:02 (previous: 08:45)    │   │
│  │  · Orphaned check-out at 14:15 (no check-in today   │   │
│  │    for this device)                                  │   │
│  │                                                      │   │
│  │  [Correct this punch]                                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Specification

**Anomaly banner (top, always visible when anomalies exist):**
- "⚠️ N anomalies detected in current view" with amber background
- Click → filters to show only anomalous punches
- Toggle: "Show only anomalies" checkbox in filter bar

**Filter bar:**
- Search: searches employee name AND PIN (not just PIN)
- Device filter: dropdown of configured devices with labels
- Status filter: Check In, Check Out, Break Out, Break In, Overtime In, Overtime Out, All
- Date range: presets + custom
- "Show only anomalies" toggle
- Active filters shown as removable chips below the bar

**Punch table:**
- Columns: Time, Employee (name), Device (label), Type (colored badge), Method (icon), Anomaly indicator (⚠)
- Anomalous rows: amber left-border, ⚠ icon prefix
- Hover: row highlights
- Click row → opens detail panel on the right
- Infinite scroll (cursor-based, works)

**Detail panel (opens on click, right side):**
- Employee header: name, PIN
- "Today's Punches" list: all punches for this employee today
- Anomalies section: lists each anomaly with description (duplicate check-in, orphaned check-out, missing check-out, late arrival)
- "Correct this punch" button → opens correction form
- "View full history" link → employee detail page

**Anomaly types to detect:**
- **Duplicate check-in:** Two check-ins without an intervening check-out
- **Orphaned check-out:** Check-out without a preceding check-in on that device
- **Missing check-out:** Employee checked in but hasn't checked out (and it's past end of day)
- **Late arrival:** Check-in after configured start time
- **Early departure:** Check-out before configured end time

### Data needed:
```
GET /api/punches?anomalies_only=true&...
→ same PunchResponse but with anomaly flags

POST /api/punches/correct (already exists, needs UI)
```

---

## 4. Employee Detail — "Tell me about this person"

**Business question:** What is this employee's attendance pattern? Are they reliable?

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Employees                                        │
│                                                              │
│  Fatima Hassan — PIN 146                                    │
│  Department: Operations · External ID: EMP-042 · Active      │
│  Enrolled on: Main Gate, Warehouse B                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ This Mo. │ │ Last Mo. │ │ Absence  │ │ On-Time      │   │
│  │  100%    │ │   95%    │ │   2%     │ │   98%        │   │
│  │attendance│ │attendance│ │  rate    │ │  rate        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                              │
│  [This Month ▾]                                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Attendance Calendar — July 2026                     │   │
│  │                                                      │   │
│  │  Mon    Tue    Wed    Thu    Fri    Sat    Sun       │   │
│  │        1️⃣      2️⃣      3️⃣      4️⃣      --      --      │   │
│  │       8.2h    8.0h    8.5h    8.1h                   │   │
│  │                                                      │   │
│  │  7️⃣      8️⃣      9️⃣      🔟     1️⃣1️⃣      --      --      │   │
│  │  8.0h    8.3h    7.9h L  8.4h    8.1h               │   │
│  │                                                      │   │
│  │  ✅ Full day  ⚠️ Late  ❌ Absent  — Weekend         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Monthly Trend                                       │   │
│  │                                                      │   │
│  │  100% │ ██     ██     ██     ██                      │   │
│  │       │ ██     ██     ██     ██     ██               │   │
│  │   95% │ ██     ██     ██     ██     ██               │   │
│  │       │ ██     ██     ██     ██     ██               │   │
│  │   90% │ ██     ██     ██     ██     ██               │   │
│  │       ├──────┬──────┬──────┬──────┬──────            │   │
│  │         Mar    Apr    May    Jun    Jul              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Daily Detail — July 11, 2026                        │   │
│  │                                                      │   │
│  │  07:42  Check In   Main Gate   Fingerprint           │   │
│  │  12:05  Break Out  Main Gate   Fingerprint           │   │
│  │  12:35  Break In   Main Gate   Fingerprint           │   │
│  │  17:02  Check Out  Main Gate   Fingerprint           │   │
│  │                                                      │   │
│  │  Regular: 8.0h  Break: 0.5h  Total: 8.5h            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Specification

**Header:**
- Back button "← Back to Employees"
- Employee name (large), PIN, Department, External ID, Status badge
- Enrolled devices: list of device labels

**Metric cards (4 across):**
- This Month Attendance % (present days / working days)
- Last Month Attendance %
- Absence Rate (all time)
- On-Time Rate (% of check-ins that were on time)

**Period selector:** Month dropdown

**Attendance Calendar:**
- Visual calendar for the selected month
- Each working day shows: hours worked, color-coded status
- Green = full day (≥ standard hours), Amber = late, Red = absent, Gray = weekend/holiday
- Click a day → shows "Daily Detail" section below
- This answers: "What days did they miss? Pattern visible at a glance."

**Monthly Trend chart:**
- Line/bar chart: X = months, Y = attendance %
- Shows 6-12 months trend
- This answers: "Is this employee getting better or worse?"

**Daily Detail (below calendar, context-sensitive):**
- Shows when a specific day is clicked in the calendar
- Lists all punches for that day chronologically
- Summary: Regular hours, Break time, Overtime, Total
- Anomalies for that day highlighted

---

## 5. Employee Directory — "Who works here?"

**Business question:** Which employees are active? Who needs attention?

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Employees                                    [+ Add]       │
├──────────────────────────────────────────────────────────────┤
│  [🔍 Search...] [Department ▾] [Status ▾]                  │
│                                                              │
│  Name               PIN   Department   Attendance  Status   │
│  ─────────────────  ────  ───────────  ──────────  ───────  │
│  Ahmed Al-Sabah     145   Operations   100% 🟢     Active   │
│  Fatima Hassan      146   Operations    95% 🟢     Active   │
│  Omar Khalid    ⚠   147   Warehouse     72% 🟡     Active   │
│  Layla Noor         148   Admin         98% 🟢     Active   │
│  Bilal Mahmoud      149   Warehouse     —          Inactive │
└──────────────────────────────────────────────────────────────┘
```

### Specification
- Table with attendance % for current month as a color-coded indicator
- ⚠ icon next to employees with anomalies in current month
- Click row → Employee Detail page
- "Add Employee" button opens create dialog
- Department filter dropdown populated from data

---

## 6. Profile & Settings — Separate Concerns

### Profile Page (every user can access)
```
┌──────────────────────────────────────────────────────┐
│  My Profile                                         │
│                                                      │
│  Username:   admin                                   │
│  Role:       Administrator                           │
│  Permissions:  read:punches write:punches ...        │
│                                                      │
│  ┌─ Change Password ────────────────────────────┐   │
│  │  Current Password:   [          ]            │   │
│  │  New Password:       [          ]            │   │
│  │  Confirm Password:   [          ]            │   │
│  │                    [Change Password]         │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Settings Page (Admin only)
```
┌──────────────────────────────────────────────────────┐
│  System Settings                                     │
│                                                      │
│  ┌─ Device Polling ─────────────────────────────┐   │
│  │                                               │   │
│  │  Poll Interval:  [60] seconds                 │   │
│  │  How often the system pulls new attendance    │   │
│  │  records from connected devices. Lower values │   │
│  │  mean more real-time data but higher load.    │   │
│  │                                               │   │
│  │  Auto-discover:  [✓] Enabled                  │   │
│  │  Automatically detect new ZKTeco devices on   │   │
│  │  the local network.                           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Work Schedule ──────────────────────────────┐   │
│  │                                               │   │
│  │  Work Start:  [08:00]                         │   │
│  │  Work End:    [17:00]                         │   │
│  │  Grace Period: [15] minutes                   │   │
│  │  Employees checking in within the grace       │   │
│  │  period after start are marked "On Time".     │   │
│  │                                               │   │
│  │  Working Days: [✓]Mon [✓]Tue [✓]Wed [✓]Thu   │   │
│  │                [✓]Fri [ ]Sat [ ]Sun           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│                          [Save Settings]             │
└──────────────────────────────────────────────────────┘
```

### Specification:
- Profile page: accessible from user menu (top-right avatar/icon)
- Settings page: Admin only, in navigation
- Every setting has a human-readable description
- Work schedule settings affect late/absence calculations across the entire app
- Settings are NOT mixed with user profile info

---

## Backend Changes Required

### New/changed endpoints:

| Endpoint | Change |
|----------|--------|
| `GET /api/dashboard/today` | Add: `absent`, `late`, `on_time`, `total_employees`, `currently_checked_in[]` |
| `GET /api/reports/summary` | Add: `work_days`, `avg_hours`, `overtime_hours`, `absence_rate`, `daily_hours[]`, `weekly_hours[]`, `status_distribution[]`, `employees[]` |
| `GET /api/punches` | Add: `anomalies_only` filter, anomaly flags in response |
| `GET /api/employees/{id}/timekeep-calendar` | New: monthly calendar data per employee |
| `GET /api/employees/{id}/monthly-trend` | New: monthly attendance % over time |
| `PUT /api/auth/password` | New: change own password |
| `GET/PUT /api/settings/work-schedule` | New: work hours config |

### Domain model additions:
- `WorkPolicy` already exists in the calculator — needs to be configurable via settings
- Anomaly detection logic already exists in `AttendanceCalculator` — needs to be surfaced in API responses
- "Currently checked in" = employees with a CheckIn today but no CheckOut today — simple query

---

## Implementation Order

1. **Dashboard overhaul** — "who is here right now" is the #1 feature. Immediate value.
2. **Reports overhaul** — default to This Month, add employee table, add business charts
3. **Employee pages** — directory + detail with calendar
4. **Punches anomaly detection** — surface existing calculator logic in UI
5. **Profile + Settings separation** — clean up the confusion
6. **PDF export with charts** — embed charts in PDF
