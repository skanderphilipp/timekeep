import { createContext, useContext, useRef, useCallback, useState, type ReactNode, type MutableRefObject } from "react";
import type { EntityType } from "@/types/entities";

/**
 * Context value available to every component inside a RecordDetailRenderer.
 *
 * Pattern: ported from Twenty's LayoutRenderingContext.
 * Simplified to just entityType + entityId — no metadata-driven layouts.
 *
 * Deriving isNewRecord (Twenty pattern):
 *   We derive it from `entityId === ""` — no separate "mode" concept.
 *   When `entityId` is empty, the renderer shows all fields as editable
 *   inputs with a batch-save button.
 */
export type RecordDetailContextValue = {
  /** Which entity type is being rendered (employee, department, device, etc.). */
  entityType: EntityType;
  /** The ID of the specific record (empty string = new record). */
  entityId: string;
  /**
   * Whether this renderer is inside the side panel.
   *
   * Used by {@link useRecordNavigation} to choose between side panel
   * stack navigation and full-page route navigation. NOT used for
   * visual branching — styling differences are handled by CSS.
   */
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

// ── Create Mode Context ────────────────────────────────────────────────────

/**
 * Context for the create flow — accumulated field data that gets
 * sent to `createFn` when the user clicks "Create".
 *
 * Only available when `entityId` is empty (new record).
 */
export type CreateContextValue = {
  /** Accumulated field data (mutable ref for performance). */
  accumulatedData: MutableRefObject<Record<string, unknown>>;
  /** Call when a field is edited in create mode. */
  accumulateField: (field: string, value: unknown) => void;
};

const CreateCtx = createContext<CreateContextValue | null>(null);

/**
 * Provider that wraps the create flow. Only rendered when `isNewRecord`.
 */
export function CreateProvider({ children }: { children: ReactNode }) {
  const accumulatedData = useRef<Record<string, unknown>>({});
  const [, forceUpdate] = useState(0);

  const accumulateField = useCallback((field: string, value: unknown) => {
    accumulatedData.current[field] = value;
    forceUpdate((n) => n + 1);
  }, []);

  // NOTE: Deliberately NOT memoized — we MUST create a new object reference
  // on every render so that React's context value comparison (Object.is)
  // detects the change and re-renders all consumers (RecordDetailFields,
  // RecordDetailActions). The forceUpdate in accumulateField triggers
  // CreateProvider to re-render, which changes this object reference,
  // which triggers consumers to re-render with the latest accumulated data.
  const value = { accumulatedData, accumulateField };

  return (
    <CreateCtx.Provider value={value}>
      {children}
    </CreateCtx.Provider>
  );
}

/**
 * Read the create context. Returns null when not in create mode.
 */
export function useCreateContext(): CreateContextValue | null {
  return useContext(CreateCtx);
}
