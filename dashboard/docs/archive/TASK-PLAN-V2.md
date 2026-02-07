# Attendance OS Dashboard — Enterprise Polish Plan (TASK-PLAN v2)

> **Date**: 2026-07-10 (updated after Sprint 0–4 completion)
> **Status**: 47 components built, 4 module hooks, all 6 pages functional
> **Gap**: i18n incomplete, form fields lack enterprise UX, missing searchable selects

---

## Assessment: What's Done vs. What's Enterprise-Grade

### ✅ Solid Foundation (keep as-is)

| Area | Status | Notes |
|------|--------|-------|
| Component library | 47 components | Structure, naming, data-slot convention all correct |
| Module architecture | `modules/` with hooks + schemas | Clean separation, pages compose atoms |
| State management | Jotai atoms + TanStack Query | Correct pattern, no prop drilling |
| Build pipeline | Vite + oxlint + Lingui | Fast, strict, working |
| RTL support | ~85% | postcss-rtlcss safety net active |
| Dropdown system | Floating UI + framer-motion | Works, needs polish (see Phase B) |
| Charts | Recharts wrappers | Works, design tokens used |

### 🔴 BLOCKING: i18n Debt (29 hardcoded English strings)

**UI components with untranslated strings:**

| File | Hardcoded String | Type |
|------|-----------------|------|
| `pagination.tsx` | `"Pagination"`, `"Previous page"`, `"Next page"` | aria-label |
| `chart.tsx` | `"Failed to load chart data"`, `"No data"` | UI text |
| `chip.tsx` | `` `Remove ${label}` `` | aria-label |
| `spinner.tsx` | `"Loading"` | aria-label |
| `dialog.tsx` | `"Close"` | aria-label |
| `filter-input.tsx` | `"Clear"` (aria-label), `"Search…"` (placeholder) | aria-label + placeholder |
| `filter-bar.tsx` | `"Clear"` (button text) | UI text |
| `dropdown-search.tsx` | `"Clear search"` (aria-label), `"Search…"` (placeholder) | aria-label + placeholder |
| `search-input.tsx` | `"Clear search"` (aria-label), `"Search…"` (placeholder) | aria-label + placeholder |
| `banner.tsx` | `"Dismiss"` | aria-label |
| `settings-page.tsx` | inline `style={{ }}` instead of SCSS module | code quality |
| `reports-page.tsx` | data-slot missing on Card.Footer span | lint warning |

**Zod validation messages** are all English:
```
"Serial number is required"
"Host is required"
```

**Lingui catalog is stale**: `.po` files reference old `src/features/` paths; need `lingui extract` + `lingui compile`.

### 🟡 Component UX Gaps (the "2026 enterprise" gap)

| Component | Current | Enterprise Target |
|-----------|---------|-------------------|
| **FilterInput / SearchInput** | Basic `<input>` with icon | Cmd+K-style search with dropdown results, keyboard nav, async suggestions |
| **FilterSelect** | Dropdown with static options | Searchable select (type to filter), multi-select with chips, async options |
| **FilterDateRange** | Native `<input type="date">` | Calendar popup with range selection (react-datepicker already installed) |
| **Combobox** | ❌ Doesn't exist | Search + select hybrid: type to filter, click to select, keyboard nav |
| **MultiSelect** | ❌ Doesn't exist | Select multiple with chips, searchable, removable |
| **DataTable** | Sort only | + column resize, row selection, sticky header |
| **Form validation** | Zod schemas are English-only | i18n'd error messages via Lingui |

---

## Phase Plan v2

### Phase A: i18n Completion (1 day) 🔴 BLOCKING

Fix every hardcoded English string. Regenerate Lingui catalogs.

- [ ] **A1**: Audit all 29 hardcoded strings (list above) → wrap in `_(msg`...`)` or `t` macro
- [ ] **A2**: `pagination.tsx` — i18n aria-labels
- [ ] **A3**: `chart.tsx` — i18n error/empty titles
- [ ] **A4**: `chip.tsx` — i18n `Remove` prefix
- [ ] **A5**: `spinner.tsx` — i18n `Loading`
- [ ] **A6**: `dialog.tsx` — i18n `Close`
- [ ] **A7**: `filter-input.tsx` — i18n `Clear` + default placeholder
- [ ] **A8**: `filter-bar.tsx` — i18n `Clear` button
- [ ] **A9**: `dropdown-search.tsx` — i18n `Clear search` + default placeholder
- [ ] **A10**: `search-input.tsx` — i18n `Clear search` + default placeholder
- [ ] **A11**: `banner.tsx` — i18n `Dismiss`
- [ ] **A12**: Zod schemas — extract validation messages into i18n keys
- [ ] **A13**: Run `lingui extract` to regenerate `.po` files
- [ ] **A14**: Fill Arabic translations in `ar.po`
- [ ] **A15**: Run `lingui compile`
- [ ] **A16**: Fix settings/reports Card.Footer data-slot warnings
- [ ] **A17**: settings-page.tsx — replace inline `style={{ }}` with SCSS module class

### Phase B: Searchable Select / Combobox (2 days) 🔴 BLOCKING

This is the main "2026 enterprise" gap the user identified. The Cmd+K pattern
(search → filter → navigate) needs to exist inside form fields.

- [ ] **B1**: `ui/combobox/` — Hybrid input + dropdown
  - Type to filter options from a provided list or async fetcher
  - Keyboard navigation (ArrowUp/Down, Enter, Escape)
  - Selected item highlight
  - Empty state ("No results")
  - Loading state (async fetch)
  - `data-slot` on every sub-element
  - Uses our existing `Dropdown` + `DropdownContent` + `MenuItem` internally
  - Props: `options`, `value`, `onChange`, `onSearch`, `placeholder`, `loading`, `emptyMessage`

- [ ] **B2**: `ui/multi-select/` — Multiple selection with chips
  - Selected items shown as `Chip` components inside the input
  - Click chip to remove, or press Backspace
  - Dropdown for remaining options
  - Searchable
  - Props: `options`, `values`, `onChange`, `placeholder`

- [ ] **B3**: Refactor `FilterSelect` to use Combobox internally
  - Currently: static dropdown with checkmark
  - Target: searchable within dropdown, keyboard nav, loading state

- [ ] **B4**: Refactor `SearchInput` to support optional dropdown results
  - Add `results` prop for displaying suggestions below
  - Keyboard nav through results
  - Press Enter to select, Escape to clear

### Phase C: Enterprise Date Picker (1 day)

- [ ] **C1**: `ui/date-picker/` — Wrap `react-datepicker` with design tokens
  - Calendar popup styled with `--ao-*` tokens
  - Single date + date range modes
  - i18n: Arabic month names, Hijri calendar support flag
  - Clear button
  - `data-slot` convention
  - Props: `value`, `onChange`, `mode` ("single" | "range"), `placeholder`, `locale`

- [ ] **C2**: Refactor `FilterDateRange` to use `DatePicker` in range mode
  - Currently: native `<input type="date">`
  - Target: Calendar popup, range selection visual

### Phase D: Form i18n + Validation Polish (1 day)

- [ ] **D1**: Create `lib/zod-i18n.ts` — helper to produce Lingui-aware zod error messages
  - `z.string().min(1, t`Required`)` — where `t` is the Lingui translate function
  - This means schemas become functions that accept `_` from `useLingui()`

- [ ] **D2**: Update `device-form.schema.ts` to use i18n'd messages

- [ ] **D3**: Add `FormField` support for translated error display (already renders `error` prop from react-hook-form, but the messages come from zod)

### Phase E: DataTable Enterprise Features (1.5 days)

- [ ] **E1**: Column resize handles (drag to resize)
- [ ] **E2**: Row selection (checkboxes) with `selectedRows` + `onSelectionChange`
- [ ] **E3**: Sticky header row on scroll
- [ ] **E4**: Column visibility toggle (hide/show columns via dropdown)

### Phase F: Visual Polish & Accessibility (1 day)

- [ ] **F1**: Focus ring animation on all input components (smooth transition, not instant)
- [ ] **F2**: `Tooltip` component integration on icon buttons (hover to see label)
- [ ] **F3**: Skeleton loading for async select/combobox components
- [ ] **F4**: Smooth height transition on filter bar expand/collapse
- [ ] **F5**: Toast animation polish (slide-in from top-right, auto-dismiss timer)

---

## Updated Priority Order

```
Phase A (i18n) → Phase B (Combobox/Searchable Select) → Phase C (Date Picker)
   🔴 BLOCKING        🔴 BLOCKING (user's main request)       🟡 Important
        ↓                         ↓                              ↓
Phase D (Form i18n) → Phase E (DataTable) → Phase F (Visual Polish)
   🟡 Important          🟢 Enhancement          🟢 Enhancement
```

**Start with Phase A + B in parallel** — these are the two blocking items.

---

## Impact Summary

| Dimension | Before (Current) | After (Phase A–F) |
|-----------|-----------------|-------------------|
| **i18n coverage** | ~70% (29 hardcoded EN strings) | 100% (every string through Lingui) |
| **Search UX** | Basic `<input>` | Cmd+K-style with dropdown, keyboard nav, async |
| **Select UX** | Static dropdown | Searchable, multi-select with chips |
| **Date input** | Native browser widget | Calendar popup, range mode, Hijri-aware |
| **Form validation** | English error messages | Arabic + English via Lingui |
| **DataTable** | Sort only | + resize, selection, sticky header |
| **Visual quality** | Functional | Animated focus rings, skeletons, transitions |
