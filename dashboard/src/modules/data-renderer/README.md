# Data Renderer

A **framework module** (not a domain module) that provides a generic data table
rendering engine. It replaces manual column-by-column rendering with a
type-safe, declarative system based on field definitions and guard-dispatched
field displays.

## Why It's Not a Domain Module

Domain modules (`apikeys/`, `devices/`, `users/`, etc.) own pages, hooks, and
components specific to a single business entity. The data renderer is different:

- It has **no `pages/` directory** — it renders *inside* other modules via
  components like `DataTableContainer`.
- It operates on **generic data types** (`EntityType`, `FieldType`, `FieldDefinition`)
  rather than a specific domain entity.
- Its consumers are **column definition factories** (e.g., `createPunchColumns`),
  not route configurations.

## Why the Non-Standard Structure

Standard modules follow a flat pattern (`components/`, `hooks/`, `pages/`,
`states/`). The data renderer intentionally breaks this pattern because it is a
cross-cutting rendering engine. Its subdirectories map to the **pipeline stages**
of rendering a table cell.

## Subdirectory Map

| Directory | Purpose |
|-----------|---------|
| `types.ts` | Core discriminated union types: `FieldMetadata`, `FieldDefinition`, `ColumnDefinition`, `SortEntry`, `FilterEntry`, `PaginationState`, `RowSelectionState`. All 7 field types (`text`, `device_sn`, `user_pin`, `timestamp`, `status`, `direction`, `verify_method`). |
| `guards/` | Type-narrowing predicate functions (`isFieldText`, `isFieldDeviceSn`, etc.). Enable exhaustive type-safe dispatch from `FieldType` → specific field display component. |
| `field-displays/` | One component per field type. Each receives a `FieldDefinition` with narrowed `metadata` and renders the appropriate UI (status badges, timestamps, device links, etc.). The `FieldDisplay` entry point dispatches via guards. |
| `column-definitions/` | Factory functions that produce `ColumnDefinition[]` for each entity table (`createPunchColumns`, `createDeviceColumns`, `createUserColumns`, `createApiKeyColumns`, `createAuditColumns`). These are the consumer-facing API. |
| `components/` | Rendering components wired into the context tree: `DataTableContainer`, `DataTableRow`, `DataTableCell`, `DataTableFooter`. |
| `contexts/` | React context providers for the table hierarchy: `DataTableContext`, `DataTableRowContext`, `DataTableCellContext`, `FieldContext`. |
| `states/` | Jotai atoms and selectors for per-table sort, filter, row selection, column visibility, and loading state. Uses `family` atoms keyed by table instance ID. |
| `hooks/` | Data-fetching and UI behavior hooks: `useTableSort`, `useTableFilter`, `useTableRowSelection`, `useColumnDefinitions`, `useCellClickHandler`. |

## Rendering Pipeline

```
User imports createPunchColumns()
    → returns ColumnDefinition[]
    → DataTableContainer receives columns + rows
        → Each row → DataTableRow
            → Each cell → DataTableCell
                → FieldContext provides FieldDefinition
                → FieldDisplay dispatches via guards
                    → Specific FieldDisplay renders (e.g., StatusFieldDisplay)
```

## Exports (barrel at `index.ts`)

The barrel exports everything a consumer needs. Import from a single module:

```ts
import { FieldDisplay, createPunchColumns, useTableSort } from "@/modules/data-renderer";
```
