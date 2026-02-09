# UI Library Consolidation — Task Plan

> **Status:** 60% complete (6/10 milestones)
> **Last updated:** 2026-07-11

## Progress Dashboard

| Milestone | Start | Now | Target |
|-----------|-------|-----|--------|
| folder-structure | 29 | **0** ✅ | 0 |
| jscpd clones | 53 | **33** (2.7%) | <20 (<2%) |
| no-raw-html-elements | 56 | **35** | 0 |
| no-logic-in-pages | 26 | **20** | 0 |
| check-size | 8 | **7** | 0 |
| stylelint | 269 | **269** | 0 |
| depcruise | 0 | **0** ✅ | 0 |
| **schema-driven-forms** | **NEW** | **✅** | — |

---

## Completed

### Milestone 1: SCSS Foundation
- [x] Shared `_form-control-base.scss` — 387 lines saved across 9 components
- [x] Shared `_input-base.scss` — eliminates expiry-picker↔ip-input↔port-input duplicates
- [x] Shared `_dropdown-base.scss` — eliminates combobox↔multi-select duplicate
- [x] Dead CSS cleanup — calendar + timeline `.panel*` classes removed (56-line clone eliminated)

### Milestone 2: Hook Naming Convention
- [x] Fixed `folder-structure` oxlint rule to accept `use-kebab-case.ts` (matches project convention)
- [x] Allowed `index.ts` barrel files in hooks/ directories

### Milestone 3: UI Primitive Coverage
- [x] `Chip` — added `onClick` + keyboard support
- [x] `ActionGroup` — added `className` support
- [x] `Dot` — new colored dot indicator component
- [x] `Timeline` — full timeline visualization (replaced 13 raw divs in daily-timeline)
- [x] `EntityCard` pattern — device-card + api-key-card converted to `InlineHeader` + `Card.Content` composition
- [x] `DetailGrid`/`DetailItem` — replaced raw `dl/dt/dd` in device-detail-panel
- [x] `CardGrid` — replaced raw div in metrics-grid
- [x] `FormActions` — replaced raw div in login-form
- [x] `Text` — replaced raw spans in export-bar, data-table-container, login-form

### Milestone 4: Page Architecture
- [x] `punch-query-page` — 160→21 lines, extracted `usePunchQueryPage` + `PunchQueryView`
- [x] `attendance-calendar` — 311→145 lines, extracted `useAttendanceCalendar` + `DayDetailPanel`
- [x] `daily-timeline` — 338→247 lines, delegates to `Timeline` UI component
- [x] `users-page` — 242→99 lines, extracted `useUsersPage` hook

### Milestone 5: Oxlint Rules
- [x] `no-raw-html-elements` — extended to all module files, added `<div>` + `<span>` + `<button>` + `<input>` + `<select>` + `<textarea>`
- [x] `no-logic-in-pages` — new rule: forbids `useState`/`useMemo`/`useCallback`/`useEffect` in pages, limits to 1 custom hook
- [x] `folder-structure` — enabled, fixed for kebab-case convention
- [x] Stylelint — installed + configured (token enforcement, CSS duplicate detection)
- [x] jscpd — installed + configured (code duplication detection)

### Milestone 6: Schema-Driven Forms
- [x] `lib/form-field-meta.ts` — Zod introspection engine + `createFormFieldDefs()` bridge (404 lines)
  - Auto-detects widget types from Zod: string → text, number → number, boolean → toggle, enum → select
  - Extracts min/max constraints, required/optional state, enum values
  - Dynamic `fieldOverrides` (disabled/readonly at runtime)
- [x] `components/ui/form/schema-form.tsx` — `<SchemaForm>` renderer (103 lines)
  - **Single rendering path** for all forms: sections → `FormSection` → `FormFieldInput`
  - Groups generated field defs by section key
- [x] `device-form.tsx` — 117→46 lines (removed hand-written `FormFieldDef[]` array)
- [x] `device-form.schema.ts` — added `createDeviceFormDef()` bundling schema + meta + sections
- [x] `user-form.tsx` — 131→51 lines
- [x] `user-form.schema.ts` — added `createUserFormDef()` with edit/create mode variants
- [x] `create-api-key-dialog.tsx` — converted from raw `useState` to Zod + react-hook-form + SchemaForm
- [x] `change-password-dialog.tsx` — converted from raw `useState` to Zod + react-hook-form + SchemaForm

  **Result:** Zero forms use manual `FormFieldDef[]` arrays or raw `useState` anymore.
  Every form is schema-driven: define Zod schema → define UI metadata once → `<SchemaForm />` renders it.

### Milestone 5: Oxlint Rules
- [x] `check-file-size.sh` — page/TSX/hook line limits enforcement

---

## Remaining

### Task 1: reports-page (highest impact — 254 lines, 8 logic, 11 atom imports)

Atom imports to eliminate: `Button`, `FormActions`, `FilterBar`, `DataTable`, `FilterInput`, `Text`, `Heading`, `Chart`, `BarChart`, `PieChart`, `DatePicker`

1. Extract `useReportsPage` hook → `modules/reports/hooks/use-reports-page.ts`
   - Filter state management
   - Chart data computation
   - Export logic (CSV/XLSX/PDF)
2. Create `ReportsView` component → `modules/reports/components/reports-view.tsx`
   - FilterBar + chart grid
   - Composes only from UI primitives + module sub-components
3. Page → 1 hook call + `<ReportsView/>`, target ≤80 lines

### Task 2: audit-log-page (151 lines, 2 logic, FilterBar + DataTable)

Same pattern as PunchQueryView — filter + table as one cohesive view.

1. Extract `useAuditLogPage` hook
2. Create `AuditLogView` component
3. Page → ≤80 lines

### Task 3: endpoints-page (98 lines, 5 logic)

Button + FilterInput + DatePicker atom imports.

1. Extract `useEndpointsPage` hook
2. Page → ≤80 lines

### Task 4: api-keys-page (90 lines, 3 logic)

Badge + Dialog atom imports.

1. Extract `useApiKeysPage` hook
2. Page → ≤80 lines

### Task 5: dashboard-page (147 lines, overweight)

Already has `useDashboard` hook — logic is correct but page has inline helpers.

1. Move `formatTimeAgo` + `formatStatus` to `@/lib/`
2. Extract `DashboardStates` component for loading/error/empty
3. Target: ≤80 lines

### Task 6: device-list-page (96 lines)

1. Verify if logic can be extracted
2. Trim to ≤80 lines

### Task 7: users-page trim (99→80 lines)

Move inline dialog composition into `UsersDialogs` sub-component.

### Task 8: app-shell.tsx (313 lines)

Split into `AppSidebar` + `AppTopBar` sub-components.

### Task 9: stylelint --fix (269 violations)

```bash
pnpm lint:style:fix   # auto-fixable (spacing, colors)
# Manual fix remaining hardcoded px values
```

### Task 10: login-page (1 logic violation)

Wrap `useAtomValue(isAuthenticatedAtom)` in `useAuthRedirect` hook.

---

## Execution Order

```
1. reports-page       (highest violation count)
2. audit-log-page     (same FilterBar+DataTable pattern)
3. endpoints-page     (simple filter pattern)
4. api-keys-page      (simple CRUD pattern)
5. dashboard-page     (extract helpers)
6. device-list-page   (trim)
7. users-page trim    (99→80)
8. app-shell.tsx      (split sub-components)
9. stylelint --fix    (mechanical)
10. login-page        (single hook wrap)
```
