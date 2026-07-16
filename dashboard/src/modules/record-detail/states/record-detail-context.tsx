import { createContext, useContext, type ReactNode } from "react";
import type { EntityType } from "@/types/entities";

/**
 * Context value available to every component inside a RecordDetailRenderer.
 *
 * Pattern: ported from Twenty's LayoutRenderingContext
 *   twenty-front/src/modules/ui/layout/contexts/LayoutRenderingContext.tsx
 *
 * Twenty's version has `targetRecordIdentifier`, `layoutType`, and `isInSidePanel`.
 * We simplify to entityType + entityId + isInSidePanel since we don't have
 * metadata-driven page layouts.
 *
 * Deriving isNewRecord (Twenty pattern):
 *   Twenty uses `isNewRecord: boolean` to auto-focus the title field.
 *   We derive it from `entityId === ""` — no separate "mode" concept.
 *   When `entityId` is empty, the renderer shows all fields as editable
 *   inputs with a batch-save button (required because our REST backend
 *   uses full POST, not per-field GraphQL mutations like Twenty).
 */
export type RecordDetailContextValue = {
  /** Which entity type is being rendered (employee, department, device, etc.). */
  entityType: EntityType;
  /** The ID of the specific record (empty string = new record). */
  entityId: string;
  /** Whether this renderer is inside the side panel (true) or main page (false). */
  isInSidePanel: boolean;
};

const RecordDetailCtx = createContext<RecordDetailContextValue | null>(null);

/**
 * Provider that wraps the entire detail view tree.
 * Must be placed above any component that calls {@link useRecordDetailContext}.
 */
export function RecordDetailProvider({
  value,
  children,
}: {
  value: RecordDetailContextValue;
  children: ReactNode;
}) {
  return (
    <RecordDetailCtx.Provider value={value}>{children}</RecordDetailCtx.Provider>
  );
}

/**
 * Read the current detail view context.
 *
 * @throws If called outside a `<RecordDetailProvider>`.
 */
export function useRecordDetailContext(): RecordDetailContextValue {
  const ctx = useContext(RecordDetailCtx);
  if (!ctx) {
    throw new Error(
      "useRecordDetailContext must be used within a <RecordDetailProvider>. " +
        "Wrap your component tree with <RecordDetailRenderer> or " +
        "<RecordDetailProvider> directly.",
    );
  }
  return ctx;
}
