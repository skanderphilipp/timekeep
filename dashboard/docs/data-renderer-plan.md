# Data Object Renderer — Architecture Plan

> **Modeled after**: pulse's `record-table/` (349 files) + `record-field/` (420 files)
> **Scope**: ~50 files (focused on our 5 entity types, not 30+ field types)
> **Status**: Planning — to be implemented

---

## 1. Current State Audit

### What's Broken

| Issue | Root Cause |
|---|---|
| Row click always opens device detail | `handleRowClick` hardcodes `DeviceDetailPanel` regardless of which cell was clicked |
| Device SN cells not clickable | `usePunchColumns` returns plain `DataTableColumn` without `onCellClick` |
| User PIN cells not clickable | Same — no `onCellClick`, no user detail panel exists |
| Sort doesn't work | `sortState` passed to `DataTable` but backend query doesn't receive sort params correctly |
| Filter doesn't work | Filter atoms stored in URL params, not synced with Jotai → table doesn't re-render |
| `renderContent is not a function` | Side panel uses `?.()` but atom can be set to a non-function value |
| Side panel looks ugly | `DeviceDetailPanel` is a hardcoded `<dl>` with static text, no live data |
| Tag/Badge components unused | Punch status/direction rendered as plain text, not `Tag` or `StatusDot` |
| No user detail panel | Clicking a user PIN does nothing |
| No proper column type dispatch | One monolithic `createCellRenderer` with switch — no type guards |

### What Pulse Does Differently

1. **Type guard + dispatch**: Every field type has an `isField*()` guard. A central dispatcher renders the right component.
2. **Component-scoped Jotai atoms**: Every table instance gets its own atom slice via `atomFamily(instanceId)`.
3. **Context hierarchy**: `RecordTableContext` → `RecordTableRowContext` → `RecordTableCellContext` → `FieldContext`
4. **LinkChip navigation**: Clicking a relation cell navigates to the related record via React Router `to` prop.
5. **Side panel with stack navigation**: `useOpenRecordInSidePanel` generates UUID instance IDs, pushes onto navigation stack.
6. **Sort/filter as flat arrays**: `currentRecordSortsComponentState` is `RecordSort[]`, not a single `sortState` object.

---

## 2. Architecture Design

### Directory Structure

```
src/modules/data-renderer/               ← New: unified data object rendering
│
├── index.ts                             ← Barrel
│
├── types.ts                             ← Core types (FieldDefinition, ColumnDefinition, etc.)
│
├── guards/                              ← Type guard functions (one per entity field type)
│   ├── index.ts
│   ├── is-field-text.ts
│   ├── is-field-device-sn.ts
│   ├── is-field-user-pin.ts
│   ├── is-field-timestamp.ts
│   ├── is-field-status.ts
│   └── is-field-direction.ts
│
├── field-displays/                      ← Display-only cell renderers (used in tables)
│   ├── index.ts                         ← Central dispatcher (FieldDisplay)
│   ├── text-field-display.tsx           ← Plain text
│   ├── device-sn-field-display.tsx      ← Clickable chip → opens device detail
│   ├── user-pin-field-display.tsx       ← Clickable chip → opens user detail
│   ├── timestamp-field-display.tsx      ← Formatted date/time
│   ├── status-field-display.tsx         ← Tag with color coding
│   └── direction-field-display.tsx      ← Tag IN/OUT
│
├── field-inputs/                        ← Edit-mode inputs (used in forms, side panel)
│   ├── index.ts                         ← Central dispatcher (FieldInput)
│   ├── text-field-input.tsx
│   ├── device-sn-field-input.tsx
│   ├── user-pin-field-input.tsx
│   ├── timestamp-field-input.tsx
│   ├── status-field-input.tsx
│   └── direction-field-input.tsx
│
├── field-hooks/                         ← Per-field data fetching + formatting hooks
│   ├── index.ts
│   ├── use-device-field-display.ts
│   ├── use-user-field-display.ts
│   ├── use-timestamp-field-display.ts
│   └── use-status-field-display.ts
│
├── contexts/                            ← React Context providers for table/cell/field
│   ├── data-table-context.tsx
│   ├── data-table-row-context.tsx
│   ├── data-table-cell-context.tsx
│   └── field-context.tsx
│
├── states/                              ← Jotai atoms for table state (component-scoped)
│   ├── atoms/
│   │   ├── sort-state.ts
│   │   ├── filter-state.ts
│   │   ├── row-selection-state.ts
│   │   ├── column-visibility-state.ts
│   │   └── table-loading-state.ts
│   ├── selectors/
│   │   ├── selected-row-ids-selector.ts
│   │   ├── all-rows-selected-selector.ts
│   │   └── visible-columns-selector.ts
│   └── index.ts
│
├── hooks/                               ← Cross-cutting table hooks
│   ├── use-data-table-instance.ts       ← Creates scoped Jotai atoms for a table instance
│   ├── use-column-definitions.ts        ← Generates ColumnDefinition[] from entity type
│   ├── use-table-sort.ts               ← Sort state + handlers
│   ├── use-table-filter.ts             ← Filter state + handlers
│   ├── use-table-row-selection.ts       ← Row selection state
│   ├── use-cell-click-handler.ts        ← Routes cell clicks to the right detail panel
│   └── use-open-detail-panel.ts         ← Opens side panel with the right entity detail
│
├── components/                          ← Table UI components
│   ├── data-table-container.tsx         ← Top-level table (replaces current DataTableV2)
│   ├── data-table-header.tsx            ← Column headers with sort indicators
│   ├── data-table-row.tsx              ← Single row with context
│   ├── data-table-cell.tsx             ← Single cell with field context + click handling
│   ├── data-table-body.tsx             ← Body with loading/empty/error states
│   └── data-table-footer.tsx           ← Pagination + row count
│
├── column-definitions/                  ← Per-entity column definitions
│   ├── punch-columns.ts
│   ├── device-columns.ts
│   ├── user-columns.ts
│   ├── api-key-columns.ts
│   └── audit-columns.ts
│
└── __tests__/                           ← Tests for guards, hooks, atoms
    ├── guards.test.ts
    ├── use-table-sort.test.ts
    ├── use-table-filter.test.ts
    └── use-cell-click-handler.test.ts

src/infrastructure/side-panel/           ← Overhauled side panel
│
├── side-panel-shell.tsx                 ← Bridge to UI component (defensive renderContent check)
├── side-panel-router.tsx               ← Routes between entity detail views
├── side-panel-navigation-stack.ts       ← Stack-based navigation state (Jotai)
│
├── detail-views/                        ← Per-entity detail views for side panel
│   ├── device-detail-view.tsx           ← Live device data, status, config
│   ├── punch-detail-view.tsx            ← Punch metadata, correction UI
│   ├── user-detail-view.tsx             ← User enrollment info, recent punches
│   └── detail-view-skeleton.tsx         ← Loading skeleton for detail views
│
└── hooks/
    ├── use-side-panel-navigation.ts     ← Push/pop/back navigation
    └── use-entity-detail.ts             ← Fetch entity detail for any type
```

### Total: ~50 files (manageable, not 300)

---

## 3. Core Patterns (ported from pulse)

### 3a. Type Guard + Dispatch

```typescript
// guards/is-field-device-sn.ts
export function isFieldDeviceSn(
  field: FieldDefinition
): field is DeviceSnFieldDefinition {
  return field.type === "device_sn";
}

// field-displays/index.ts — Central dispatcher
export function FieldDisplay({ field, value, context }: FieldDisplayProps) {
  if (isFieldDeviceSn(field)) return <DeviceSnFieldDisplay value={value} context={context} />;
  if (isFieldUserPin(field))    return <UserPinFieldDisplay value={value} context={context} />;
  if (isFieldTimestamp(field))  return <TimestampFieldDisplay value={value} />;
  if (isFieldStatus(field))     return <StatusFieldDisplay value={value} />;
  if (isFieldDirection(field))  return <DirectionFieldDisplay value={value} />;
  // Default: plain text
  return <TextCell text={String(value)} />;
}
```

### 3b. Component-Scoped Jotai Atoms

```typescript
// states/atoms/sort-state.ts
import { atomFamily } from "jotai";

type SortEntry = { columnId: string; direction: "asc" | "desc" };

// One sort array per table instance
export const tableSortStateFamily = atomFamily<string, SortEntry[]>(
  () => atom<SortEntry[]>([])
);

// Usage in hook:
function useTableSort(instanceId: string) {
  const [sorts, setSorts] = useAtom(tableSortStateFamily(instanceId));
  // ...
}
```

### 3c. Context Hierarchy

```typescript
// contexts/data-table-context.tsx
const DataTableContext = createContext<{
  instanceId: string;
  entityType: EntityType;
  onCellClick: (entityType: EntityType, id: string) => void;
} | null>(null);

// contexts/field-context.tsx
const FieldContext = createContext<{
  field: FieldDefinition;
  value: unknown;
  recordId: string;
  entityType: EntityType;
  isClickable: boolean;
  onClick: () => void;
} | null>(null);
```

### 3d. Cell Click → Entity Router

```typescript
// hooks/use-cell-click-handler.ts
function useCellClickHandler() {
  const openSidePanel = useOpenDetailPanel();

  return useCallback((entityType: EntityType, id: string) => {
    switch (entityType) {
      case "device":
        openSidePanel({ entityType: "device", id, title: `Device ${id}` });
        break;
      case "user":
        openSidePanel({ entityType: "user", id, title: `User ${id}` });
        break;
      // Row click on punch → opens device (the punch's device)
      case "punch":
        openSidePanel({ entityType: "device", id, title: `Device ${id}` });
        break;
    }
  }, [openSidePanel]);
}
```

### 3e. Side Panel Navigation Stack

```typescript
// side-panel-navigation-stack.ts
type SidePanelEntry = {
  instanceId: string;       // UUID — scopes Jotai atoms
  entityType: EntityType;
  entityId: string;
  title: string;
};

const sidePanelStackAtom = atom<SidePanelEntry[]>([]);
const sidePanelActiveIndexAtom = atom(0);

// push/pop/back operations
const pushSidePanelAtom = atom(null, (get, set, entry: SidePanelEntry) => {
  set(sidePanelStackAtom, [...get(sidePanelStackAtom), entry]);
});

const popSidePanelAtom = atom(null, (get, set) => {
  const stack = get(sidePanelStackAtom);
  if (stack.length > 0) set(sidePanelStackAtom, stack.slice(0, -1));
});
```

---

## 4. Implementation Phases

### Phase 1: Foundation (types, guards, contexts)
- `types.ts` — FieldDefinition, ColumnDefinition, EntityType enum
- `guards/` — 6 type guard functions
- `contexts/` — DataTableContext, RowContext, CellContext, FieldContext

### Phase 2: State Management
- `states/atoms/` — sort, filter, row selection, column visibility atoms (atomFamily-based)
- `states/selectors/` — derived selectors
- `hooks/use-data-table-instance.ts` — creates scoped atoms

### Phase 3: Field Displays
- `field-displays/` — 6 display components + central dispatcher
- Each uses proper Tag, Badge, StatusDot, Chip components
- Device SN → clickable Chip → side panel
- User PIN → clickable Chip → side panel

### Phase 4: Table Components
- `data-table-container.tsx` — replaces current DataTableV2
- `data-table-header.tsx` — sort indicators, proper click handlers
- `data-table-cell.tsx` — wraps FieldDisplay in FieldContext
- `data-table-row.tsx` — wraps cells in RowContext

### Phase 5: Side Panel Overhaul
- Navigation stack (Jotai atoms)
- Side panel router
- Per-entity detail views (device, user, punch)
- Loading skeletons

### Phase 6: Column Definitions
- Per-entity column arrays (punch-columns.ts, device-columns.ts, etc.)
- Each column: `{ id, header, type, accessor, sortable, width }`

### Phase 7: Wire Everything
- Update PunchQueryPage to use new `DataTableContainer`
- Update DeviceListPage to use new table
- Update AuditLogPage
- Remove old DataTableV2

### Phase 8: Tests
- Guards unit tests
- Sort/filter hook tests
- Cell click handler tests
- Integration test: table renders → click cell → side panel opens right entity

---

## 5. File Count Estimate

| Layer | Files |
|---|---|
| Types + Guards | 8 |
| Field Displays | 8 |
| Field Inputs | 8 |
| Field Hooks | 6 |
| Contexts | 5 |
| States (atoms + selectors) | 10 |
| Hooks | 8 |
| Table Components | 7 |
| Column Definitions | 6 |
| Side Panel (detail views + nav) | 8 |
| Tests | 6 |
| **Total** | **~80 files** |

---

## 6. Key Differences from Pulse (Simplifications)

| Pulse | Alsabah |
|---|---|
| 30+ field types | 6 field types (text, device_sn, user_pin, timestamp, status, direction) |
| dnd-kit column reordering | Static column order |
| Virtualized scrolling (49 files) | Simple table (no virtualization needed for <1000 rows) |
| GraphQL query generation | REST API calls |
| Metadata-driven columns from DB schema | Hand-written column definitions per entity |
| Object metadata management | Fixed entity types (Device, Punch, User, APIKey, Audit) |
| Kanban/board views | Table only |
| Advanced filter logic trees (AND/OR) | Simple filter bar |
| 349 + 420 = 769 files | ~80 files |
