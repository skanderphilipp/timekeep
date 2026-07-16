# Data Renderer

A **framework module** (not a domain module) that provides a generic data table
rendering engine. It replaces manual column-by-column rendering with a
type-safe, declarative system based on generic field types and metadata-driven
display components.

## Architecture Principle

**Field types describe DATA SHAPE, not DOMAIN MEANING.**

The data-renderer knows about 6 generic field types:
- `text` — plain string display
- `number` — formatted number display
- `timestamp` — formatted date/time
- `status` — colored tag with option labels (no navigation)
- `enum` — colored tag with option labels (no navigation)
- `reference` — clickable chip that navigates to another entity

Domain-specific concepts like "device serial number", "employee name", or
"verify method" are NOT field types. They are `reference` or `enum` fields
with entity-specific metadata from `@/types/metadata.ts` (`REFERENCE_CONFIG`,
`PRESENTATION_OVERRIDES`).

When the backend schema is loaded, `mapSchemaFieldToFieldType` (in
`schema-mapper.ts`) resolves the field type. For reference fields,
`REFERENCE_CONFIG` supplies the navigation target entity.

## Why It's Not a Domain Module

Domain modules (`employees/`, `punches/`, `departments/`, etc.) own pages,
hooks, and components specific to a single business entity. The data renderer
is different:

- It has **no `pages/` directory** — it renders *inside* other modules via
  components like `DataTableContainer`.
- It operates on **generic field types** (`FieldType`, `FieldMetadata`,
  `FieldDefinition`) rather than domain-specific entity types.
- Its consumers are **domain modules** that provide column configurations
  and metadata, not route configurations.

## Why the Non-Standard Structure

Standard modules follow a flat pattern (`components/`, `hooks/`, `pages/`,
`states/`). The data renderer intentionally breaks this pattern because it is a
cross-cutting rendering engine. Its subdirectories map to the **pipeline stages**
of rendering a table cell.

## Subdirectory Map

| Directory | Purpose |
|-----------|---------|
| `types.ts` | Core discriminated union types: `FieldMetadata`, `FieldDefinition`, `ColumnDefinition`, `SortEntry`, `FilterEntry`, `PaginationState`, `RowSelectionState`. Six generic field types (`text`, `number`, `timestamp`, `status`, `enum`, `reference`). |
| `guards/` | Type-narrowing predicate functions (`isFieldText`, `isFieldNumber`, `isFieldTimestamp`, `isFieldStatus`, `isFieldEnum`, `isFieldReference`). Enable exhaustive type-safe dispatch from `FieldType` → specific field display component. |
| `field-displays/` | One component per generic field type. `FieldDisplay` (entry point) dispatches via guards. `ReferenceFieldDisplay` handles ALL FK/reference fields generically — the navigation target comes from `ReferenceFieldMetadata.referenceEntity`. `EnumFieldDisplay` handles `status` and `enum` fields with colored tags. |
| `column-definitions/` | Legacy factory functions that produce `ColumnDefinition[]` for each entity table. Deprecated in favor of `useSchemaColumns()` (schema-driven). Kept for storybook/test backward compat. |
| `components/` | Rendering components wired into the context tree: `DataTableContainer`, `DataTableRow`, `DataTableCell`, `DataTableFooter`, `DataListView`. |
| `contexts/` | React context providers for the table hierarchy: `DataTableContext`, `DataTableRowContext`, `DataTableCellContext`, `FieldContext`. |
| `states/` | Jotai atoms and selectors for per-table sort, filter, row selection, column visibility, and loading state. Uses `family` atoms keyed by table instance ID. |
| `hooks/` | Data-fetching and UI behavior hooks: `useTableSort`, `useTableFilter`, `useTableRowSelection`, `useColumnDefinitions`, `useCellClickHandler`, `useSchemaColumns`, `useFilterFields`. |

## Rendering Pipeline

```
Domain module provides columns + metadata
    → ColumnDefinition[] with generic types + metadata
    → DataTableContainer receives columns + rows
        → Each row → DataTableRow
            → Each cell → createCellRenderer
                → FieldContext provides FieldDefinition + value
                → FieldDisplay dispatches via guards
                    → Generic FieldDisplay renders (e.g., EnumFieldDisplay, ReferenceFieldDisplay)
```

## Adding a New FK/Reference Field

1. Add an entry to `REFERENCE_CONFIG` in `@/types/metadata.ts`:
   ```ts
   punch: {
     new_field: {
       referenceEntity: "someEntity",
       referenceIdField: "new_field_id",
       displayField: "new_field_label",
     },
   },
   ```
2. Add a `displayType: "reference"` entry to `PRESENTATION_OVERRIDES`:
   ```ts
   punch: {
     new_field: { width: "150px", displayType: "reference" },
   },
   ```
3. Done — the infrastructure picks it up automatically. No new components, no new types.

## Exports (barrel at `index.ts`)

The barrel exports everything a consumer needs. Import from a single module:

```ts
import { FieldDisplay, useSchemaColumns, DataListView } from "@/modules/data-renderer";
```
