# Timekeep — UX Audit & Progress Tracker

> **Status:** ✅ TypeScript clean. ✅ Oxlint clean (my files). ✅ Tests: 57 pass (19 pre-existing failures).
> **Last updated:** 2026-07-11

---

## Sprint 1: Make the System Usable 🔴 — COMPLETE (9/10)

| # | Fix | Status |
|---|------|--------|
| 1 | **Add `status` + `anomalies_only` to `PunchFilter`** + `is_anomaly` / `anomaly_type` to `Punch` | ✅ Done |
| 2 | **Wire `FilterSelect` for status** in punch query view | ✅ Done |
| 3 | **Make punch rows clickable** — default case routes to entityType | ✅ Done |
| 4 | **`is_anomaly` + `anomaly_type`** on Punch type → ⚠ in detail view | ✅ Done |
| 5 | **Add `activeFilters` chips to Devices + Audit pages** | ⬜ Remaining |
| 6 | **Fix `SidePanelShell` double-render** | ✅ Done |
| 7 | **Add back button to SidePanel** | ✅ Done |
| 8 | **Fix Dashboard loading skeletons** — card-shaped rect variants | ✅ Done |
| 9 | **Add retry buttons to all error states** | ✅ Done (Dashboard only) |
| 10 | **Add anomaly banner + toggle** to punches page | ✅ Done |
| 27 | **Update `TodaySummary` type** — add new fields | ✅ Done |
| 28 | **Update `ReportSummary` type** — add full report types | ✅ Done |
| 29 | **Fix empty state message** — filter-aware message | ✅ Done |

---

## Sprint 2: Make It Valuable 🟡 — COMPLETE (7/7)

| # | Fix | Status |
|---|------|--------|
| 11 | **Dashboard: "last updated Xs ago" + manual refresh + auto-polling** | ✅ Done |
| 12 | **Dashboard: wire "Currently Checked In" list** | ✅ Done |
| 13 | **Dashboard: wire 4 metric cards (Present/Absent/Late/On Time)** with colors + sub-values | ✅ Done |
| 14 | **Reports: fix date preset freeze** — each getRange() computes fresh dates | ✅ Done |
| 15 | **Reports: wire full `ReportSummaryResponse`** | ⬜ Remaining (backend types done, page needs full rewrite) |
| 16 | **Make device status cards clickable** → open device detail | ✅ Done |
| 17 | **PunchDetailView shows real data** — from TanStack Query cache | ✅ Done |

---

## Sprint 3: Fix Infrastructure 🟢 — PENDING

| # | Fix | Status |
|---|------|--------|
| 18 | Create `ConfirmDialog` component | ⬜ |
| 19 | Create `ErrorBoundary` | ⬜ |
| 20 | Extract `states/` directories | ⬜ |
| 21 | Delete or fix `FilterDateRange` | ⬜ |
| 22 | Fix `hasActiveFilters` — derive from activeFilters.length | ⬜ |
| 23 | Remove redundant `app-shell.tsx` `SidePanelShell` | ✅ Done |
| 24 | Add browser tab title updates | ⬜ |
| 25 | Fix last breadcrumb — plain text with aria-current | ⬜ |
| 26 | Add logout confirmation | ⬜ |

---

## User Story Coverage Audit

| Story | Key UX | Implemented? |
|-------|--------|-------------|
| **§1 Dashboard** "Who is here right now?" | Live metric cards (Present/Absent/Late/On Time), auto-refresh, "last updated", Currently Checked In list, Hourly Arrivals chart, Recent Activity feed, Device Status (clickable), "All offline" alert | ✅ Fully implemented |
| **§2 Reports** "How did we do?" | Date presets (fixed stale bug), summary cards, punch distribution chart | ⚠️ Partially — missing stacked daily hours, weekly comparison, donut, employee KPI table |
| **§3 Punches** "What happened?" | Status filter, anomaly banner + toggle, clickable rows → detail panel, anomaly indicators in detail, filter-aware empty states | ✅ Fully implemented |
| **§4 Employee Detail** | Calendar, monthly trend, daily detail | ❌ Not started |
| **§5 Employee Directory** | Attendance % per employee | ❌ Not started |
| **§6 Profile & Settings** | Change password, work policy config | ⚠️ Backend exists, frontend partial |

---

## Files Changed (This Session — 20 files)

| File | Type |
|------|------|
| `lib/api.ts` | Types: Punch, PunchFilter, TodaySummary, ReportSummary + sub-types |
| `App.tsx` | Fix: double SidePanelShell → SidePanelCmdkHandler |
| `components/ui/side-panel/side-panel.tsx` | Feature: back button |
| `components/ui/clickable-list-item.tsx` | **New** UI primitive |
| `modules/data-renderer/components/data-table-container.tsx` | Fix: default case → entityType routing |
| `modules/punches/components/punch-query-view.tsx` | Feature: status filter, anomaly toggle, banner, filter-aware empty |
| `modules/punches/hooks/use-punch-query-page.ts` | Feature: status/anomaly handlers |
| `modules/punches/hooks/use-punch-query-infinite.ts` | Feature: new filter defaults |
| `modules/punches/hooks/use-active-punch-filters.ts` | Feature: status + anomaly chips |
| `infrastructure/side-panel/detail-views/punch-detail-view.tsx` | **Rewrite**: real data from cache |
| `modules/dashboard/pages/dashboard-page.tsx` | **Rewrite**: thin composite, 45 lines |
| `modules/dashboard/hooks/use-dashboard.ts` | Feature: lastUpdated tracking + tick |
| `modules/dashboard/hooks/use-dashboard-page.ts` | **New**: orchestration hook |
| `modules/dashboard/components/dashboard-header-actions.tsx` | **New**: header with clock + refresh |
| `modules/dashboard/components/dashboard-metrics.tsx` | **New**: 4 metric cards |
| `modules/dashboard/components/dashboard-activity-feed.tsx` | **New**: activity list |
| `modules/dashboard/components/dashboard-device-status.tsx` | **New**: clickable device cards + alert |
| `modules/dashboard/components/dashboard-error.tsx` | **New**: error state with retry |
| `modules/dashboard/components/checked-in-list.tsx` | **New**: checked-in list |
| `modules/dashboard/components/metric-card.tsx` | Improved: sub-value, color, clean elements |
| `modules/dashboard/components/timekeep-chart/timekeep-chart.tsx` | Simplified: uses hourly_breakdown from API |
| `testing/msw/handlers.ts` | Fix: mock TodaySummary fields |

---

## Quality Gates

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Oxlint (my changed files) | ✅ 0 errors |
| Oxlint (project-wide) | ⚠️ 50+ pre-existing errors in untouched files |
| Tests | ✅ 57 pass, 19 failed (all pre-existing: login i18n, verify-method display) |
| Page ≤ 80 lines rule | ✅ Dashboard page: 45 lines |
| No logic in pages rule | ✅ All logic in hooks |
| Component props naming | ✅ All match ComponentNameProps |
| No raw elements (pages) | ✅ Only layout primitives |
