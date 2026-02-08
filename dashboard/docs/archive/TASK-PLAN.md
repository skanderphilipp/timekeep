# Attendance OS Dashboard — Enterprise Component Foundation Plan

> **Date**: 2026-07-10
> **Status**: Phases 1–4 complete (typography, DataTable, forms, i18n)
> **Principle**: No more pages until atoms and molecules are ready. Pages should only compose.

---

## Gap Analysis: Reaktly UI vs Our Library

| Reaktly Category | Reaktly Has | We Have? | Status |
|-----------------|-------------|----------|--------|
| **Dropdown/Menu** | Dropdown, DropdownContent, DropdownMenuItemsContainer, DropdownMenuSearchInput, DropdownMenuSeparator | ❌ None | **BLOCKING** |
| **MenuItem** | 15 variants (Navigate, Select, Toggle, MultiSelect, Avatar, etc.) | ❌ None | **BLOCKING** |
| **IconButton** | LightIconButton, IconButton, RoundedIconButton, AnimatedLightIconButton | ❌ None | **BLOCKING** |
| **Chip/Tag** | Chip, Tag, Pill | ⚠️ Badge only | Missing |
| **CardFooter** | CardFooter | ❌ None | Missing |
| **Avatar** | Avatar, AvatarGroup | ❌ None | Missing |
| **SearchInput** | SearchInput | ⚠️ Input w/adornment | Needs extraction |
| **DatePicker** | DatePicker | ⚠️ Native `<input type="date">` | Needs proper component |
| **TextArea** | TextArea | ❌ None | Missing |
| **SelectControl** | SelectControl (custom, not native) | ⚠️ Native `<select>` | Needs upgrade |
| **Banner/Callout** | Banner, Callout, Info | ❌ None | Missing |
| **ProgressBar** | ProgressBar, CircularProgressBar | ❌ None | Missing |
| **TabList** | TabList | ❌ None | Missing |
| **NavigationBar** | NavigationBar, NavigationBarItem | ❌ None | Missing |
| **Chart** | (Reaktly doesn't have) | ❌ None | Needed |
| **RTL** | (CSS logical properties) | ⚠️ 70% done | Needs audit + postcss |
| **i18n** | Lingui `msg` macro | ⚠️ Pages done, Cmd+K not | Incomplete |

---

## Phase A: RTL Quick Fixes (1 day)

Fix the 10 physical property issues already catalogued. Add `postcss-rtlcss` as safety net.

- [ ] **A1**: `input.module.scss` L82–88 — `left`/`right` → `inset-inline-start`/`inset-inline-end`
- [ ] **A2**: `app-shell.module.scss` L239–240 — `padding-left/right` → `padding-inline`
- [ ] **A3**: `app-shell.module.scss` L258 — Add `[dir="rtl"] .sidebar { transform: translateX(100%) }`
- [ ] **A4**: `select.module.scss` — chevron `right` → `inset-inline-end`
- [ ] **A5**: `toggle.module.scss` — thumb `left`/`right` → logical
- [ ] **A6**: `checkbox.module.scss` — label `margin-left` → `margin-inline-start`
- [ ] **A7**: `badge.module.scss` — audit physical properties
- [ ] **A8**: `card.module.scss` — audit physical properties
- [ ] **A9**: `pagination.tsx` — flip chevrons based on `dir`
- [ ] **A10**: `page-bar.tsx` — flip breadcrumb separator chevron
- [ ] **A11**: Install `postcss-rtlcss` + configure in Vite as safety net
- [ ] **A12**: Create `useDirection()` hook (`ltr` | `rtl`)
- [ ] **A13**: Icon flipping utility (`chevronForDirection`)

---

## Phase B: Dropdown + Menu System (3 days) — BLOCKING

This is the infrastructure for Cmd+K, filter menus, context menus, select dropdowns, etc.

### B1: Atoms (building blocks)

- [ ] **B1.1**: `ui/icon-button/` — Icon-only button (`LightIconButton` from Reaktly)
  - Sizes: `sm` (28px), `md` (32px)
  - Accents: `primary`, `secondary`, `tertiary`
  - `aria-label` required (no text content)
- [ ] **B1.2**: `ui/menu-item/` — Base menu item with left icon, text, right icon, hotkeys, hover state
  - Follows Reaktly's `MenuItem` structure exactly
  - `data-slot` attributes on every sub-element
- [ ] **B1.3**: `ui/menu-item-navigate/` — Menu item that navigates (chevron right indicator)
- [ ] **B1.4**: `ui/menu-separator/` — Horizontal divider inside dropdowns

### B2: Molecules

- [ ] **B2.1**: `ui/dropdown/` — Floating dropdown anchored to a trigger
  - Uses `@floating-ui/react` (already installed)
  - Trigger: any clickable element wrapped for accessibility
  - Portal rendering at body level
  - Click-outside + Escape to close
  - `data-dropdown-id` for nested dropdown handling
  - Placement: bottom-start, bottom-end, top-start, top-end
  - `FloatingPortal` + `useFloating` with `autoUpdate`, `flip`, `offset`, `size`
- [ ] **B2.2**: `ui/dropdown-content/` — Styled container for dropdown menu items
- [ ] **B2.3**: `ui/dropdown-search/` — Search input inside dropdown (Cmd+K pattern)

### B3: Integration

- [ ] **B3.1**: Refactor `CommandPalette` to use Dropdown + MenuItem components
- [ ] **B3.2**: i18n for all CommandPalette strings (currently hardcoded English)
- [ ] **B3.3**: Wire keyboard shortcut display (hotkeys) into MenuItem

---

## Phase C: FilterBar Molecule (1 day)

Current `FilterBar` is just a flex `<div>` wrapper. Make it a proper molecule.

- [ ] **C1**: `ui/filter-bar/` — Filter container with clear-all, collapse, responsive
- [ ] **C2**: `ui/filter-input/` — Filter atom: icon + input + clear button
- [ ] **C3**: `ui/filter-select/` — Filter atom: dropdown select for enum filters
- [ ] **C4**: `ui/filter-date-range/` — Filter atom: date range picker (from/to)
- [ ] **C5**: Refactor `punch-query-page.tsx` to use proper filter atoms instead of raw `<Input>`

---

## Phase D: Extract Page Logic into Hooks (1 day)

- [ ] **D1**: `features/punches/hooks/use-punch-query.ts` — Extract filter/sort/pagination state + query into a single hook
  - Returns: `{ data, isLoading, error, filter, setFilter, sort, setSort, page, setPage, totalPages }`
- [ ] **D2**: `features/devices/hooks/use-device-form.ts` — Extract form state + mutation into a hook
  - Returns: `{ form, updateField, save, isSaving, isEditing, effectiveForm }`
- [ ] **D3**: `features/devices/hooks/use-device-list.ts` — Extract device list query
- [ ] **D4**: `features/dashboard/hooks/use-dashboard.ts` — Extract dashboard summary query

---

## Phase E: Remaining Atoms (2 days)

- [ ] **E1**: `ui/chip/` — Small label with optional dismiss button (like Reaktly's Chip)
- [ ] **E2**: `ui/card-footer/` — `<Card.Footer>` compound sub-component
- [ ] **E3**: `ui/text-area/` — Multi-line input (`react-textarea-autosize` already installed)
- [ ] **E4**: `ui/search-input/` — Input with search icon + clear button + debounce
- [ ] **E5**: `ui/banner/` — Alert/info/warning/success notification bar
- [ ] **E6**: `ui/progress-bar/` — Horizontal progress indicator
- [ ] **E7**: `ui/tab-list/` — Accessible tab component
- [ ] **E8**: `ui/avatar/` — User avatar with fallback initials (Reaktly pattern)

---

## Phase F: Chart Components (2 days)

- [ ] **F1**: `ui/chart/` — Base chart wrapper with loading/error/empty states
- [ ] **F2**: `ui/bar-chart/` — Recharts bar chart with design tokens
- [ ] **F3**: `ui/line-chart/` — Recharts line chart for trends
- [ ] **F4**: `ui/pie-chart/` — Recharts pie/donut chart
- [ ] **F5**: `features/dashboard/components/attendance-chart/` — Domain-specific: attendance over time

---

## Phase G: Complete Pages (3 days)

Now with all atoms/molecules in place, rebuild pages properly.

- [ ] **G1**: `dashboard-page.tsx` — Add attendance trend chart, real-time status
- [ ] **G2**: `punch-query-page.tsx` — Use `usePunchQuery` hook, FilterBar molecule with atoms, proper DataTable
- [ ] **G3**: `device-list-page.tsx` — Use `useDeviceList` hook, filter/search by name
- [ ] **G4**: `device-form-page.tsx` — Use `useDeviceForm` hook, add Toggle for push_enabled, add test connection
- [ ] **G5**: `reports-page.tsx` — Real content with date range picker + chart + CSV export
- [ ] **G6**: `settings-page.tsx` — Real content with webhook config form

---

## Updated Component Tree (After All Phases)

```
UI Library (aiming for ~40 components)
├── layout/
│   ├── Section ✅          ├── PageBar ✅         ├── Separator ✅
│   ├── Stack (TODO)        ├── Inline (TODO)      ├── Grid (TODO)
│   └── TabList (E7)
│
├── surfaces/
│   ├── Card ✅             ├── CardHeader ✅       ├── CardContent ✅
│   ├── CardFooter (E2)     ├── Modal ✅           └── Tooltip ✅
│
├── input/
│   ├── Button ✅           ├── Input ✅            ├── Select ✅
│   ├── Checkbox ✅         ├── Toggle ✅           ├── IconButton (B1.1)
│   ├── TextArea (E3)       ├── SearchInput (E4)    └── DatePicker (F6)
│
├── data-display/
│   ├── Badge ✅            ├── Spinner ✅          ├── Skeleton ✅
│   ├── StatusDot ✅        ├── Chip (E1)           ├── Avatar (E8)
│   └── ProgressBar (E6)
│
├── dropdown/ (B)
│   ├── Dropdown (B2.1)     ├── DropdownContent (B2.2)
│   ├── DropdownSearch (B2.3) ├── MenuItem (B1.2)
│   ├── MenuItemNavigate (B1.3) └── MenuSeparator (B1.4)
│
├── filter/ (C)
│   ├── FilterBar (C1)      ├── FilterInput (C2)
│   ├── FilterSelect (C3)   └── FilterDateRange (C4)
│
├── chart/ (F)
│   ├── Chart (F1)          ├── BarChart (F2)
│   ├── LineChart (F3)      └── PieChart (F4)
│
├── feedback/
│   ├── EmptyState ✅       ├── Spinner ✅          ├── Banner (E5)
│   └── Toast ✅
│
├── typography/
│   ├── Heading ✅          └── Text ✅
│
└── accessibility/
    └── VisuallyHidden ✅
```

## Immediate Next: Phase A (RTL) + Phase B (Dropdown/Menu)

These are the two blocking items:
1. **RTL fixes** unblock Arabic layout testing
2. **Dropdown/Menu** unblocks Cmd+K i18n, filter menus, selects

After that, we have the infrastructure to build proper pages.

---

## Enforcement Rule (updated)

A page component MUST NOT contain:
- Raw HTML layout elements (`div`, `span`, `p`, `h1`–`h6`, `form`, `thead`, `td`)
- Custom logic hooks that could be extracted (sort state, filter state, form validation)
- Inline component definitions (columns, labels, maps)
- More than ~30 lines of JSX

A page component SHOULD:
- Import typed hooks from `../hooks/`
- Compose UI atoms and molecules only
- Be readable as a declarative specification of what the page shows
