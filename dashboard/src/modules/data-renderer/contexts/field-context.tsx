import { createContext, useContext } from "react";
import type { FieldDefinition, FieldMetadata } from "../types";

/**
 * View mode for field rendering.
 * - "display" — read-only field rendered via FieldDisplay
 * - "edit"   — inline-edit field rendered via FieldEdit
 */
export type FieldViewMode = "display" | "edit";

/**
 * Field context — scoped to rendering a single field value.
 *
 * Used by `FieldDisplay` and `FieldEdit` components to access
 * the field definition, value, and interaction callbacks.
 *
 * For `reference` fields, the navigation target entity is on the
 * `ReferenceFieldMetadata.referenceEntity`, NOT in this context.
 */
export type FieldContextValue = {
  /** The field definition (type + metadata). */
  fieldDefinition: FieldDefinition<FieldMetadata>;
  /** The display value for this field from the record. */
  value: unknown;
  /** The current view mode: display or edit. */
  viewMode: FieldViewMode;
  /**
   * For reference fields: the resolved entity ID to navigate to.
   * Set by `createCellRenderer` from `ReferenceFieldMetadata.referenceIdField`.
   */
  entityId?: string;
  /**
   * Custom navigation handler for reference/FK fields.
   * When provided, `ReferenceFieldDisplay` delegates navigation to this
   * callback instead of always using `useOpenDetailPanel` (side panel).
   *
   * This allows the record-detail module to route navigation correctly:
   *   - Main panel → full-page navigation
   *   - Side panel → nested side-panel navigation
   *
   * Pattern: Twenty's `LayoutRenderingContext` — the field display doesn't
   * know where it's rendered; the provider tells it how to navigate.
   */
  onNavigateToEntity?: (entityType: string, entityId: string, label?: string) => void;
  /**
   * When true, the options for a reference/select field are still being fetched.
   *
   * Used by `SelectFieldEdit` to show a loading indicator instead of an empty
   * dropdown. Set by the record-detail renderer when preloaded options
   * (e.g., department list for employee editing) haven't resolved yet.
   *
   * Pattern: Twenty's `recordFieldInputLayoutDirectionLoadingComponentState`
   * atom — the edit component is self-aware of option-loading state so it can
   * render a guard instead of an empty Combobox.
   */
  isLoadingOptions?: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) {
    throw new Error("useFieldContext must be used within a FieldContextProvider");
  }
  return ctx;
}

export { FieldContext };
