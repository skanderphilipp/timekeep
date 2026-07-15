import { useState, useCallback, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import {
  buildCellId,
  useIsEditingCell,
  useEnterEditMode,
  useExitEditMode,
  useCellNavigator,
} from "@/infrastructure/state";
import { isNonTextWritingKey } from "@/components/ui/field-input";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Props passed to the `renderEdit` callback.
 *
 * All event handlers are pre-wired to persist, navigate, and exit edit mode.
 * The consumer forwards them directly to the appropriate `Field*Input` component.
 */
export type EditableCellEditProps<TValue = unknown> = {
  /** Stable ID for the FieldInput's `instanceId` prop. */
  instanceId: string;
  /** The current (possibly draft) value. */
  value: TValue;
  /** Called on every keystroke/change. Updates the draft state. */
  onChange: (newValue: TValue) => void;
  /** Enter pressed — persist + exit edit mode. */
  onEnter: (finalValue: TValue) => void;
  /** Escape pressed — exit edit mode without persisting. */
  onEscape: (finalValue: TValue) => void;
  /** Tab pressed — persist + move to next cell. */
  onTab: (finalValue: TValue) => void;
  /** Shift+Tab pressed — persist + move to previous cell. */
  onShiftTab: (finalValue: TValue) => void;
  /** Clicked outside the input — persist + exit edit mode. */
  onClickOutside: (event: MouseEvent, finalValue: TValue) => void;
  /** Whether the input should auto-focus on mount. Always true for inline editing. */
  autoFocus: boolean;
};

export type EditableCellProps<TValue = unknown> = {
  /** Stable row identifier (from `getRowKey`). */
  rowId: string;
  /** Column identifier — must match one of the keys in `editableColumns`. */
  columnId: string;
  /** The current value from the record. */
  value: TValue;
  /**
   * Renders the read-only display view.
   * Receives the current value — use a `*Display` component from `@/components/ui/display`.
   */
  renderDisplay: (value: TValue) => ReactNode;
  /**
   * Renders the editable input view.
   * Receives pre-wired event handlers — forward to a `Field*Input` component.
   *
   * @example
   * renderEdit={(props) => (
   *   <FieldTextInput
   *     instanceId={props.instanceId}
   *     value={props.value as string}
   *     onChange={props.onChange}
   *     onEnter={props.onEnter}
   *     onEscape={props.onEscape}
   *     onTab={props.onTab}
   *     onShiftTab={props.onShiftTab}
   *     onClickOutside={props.onClickOutside}
   *     autoFocus={props.autoFocus}
   *   />
   * )}
   */
  renderEdit: (props: EditableCellEditProps<TValue>) => ReactNode;
  /**
   * Called when the user commits a value (Enter, Tab, ClickOutside).
   * Should trigger an optimistic TanStack Query mutation.
   */
  onPersist: (rowId: string, columnId: string, value: TValue) => void;
  /**
   * Ordered list of column IDs that support inline editing.
   * Used for Tab/Shift+Tab navigation between cells.
   * When omitted, Tab/Shift+Tab behave like Enter (commit + exit without moving).
   */
  editableColumns?: string[];
};

// ── Styles (inline for cell-level consistency) ────────────────────────────────

const CELL_MIN_HEIGHT = 28;

const displayContainerStyle: React.CSSProperties = {
  cursor: "pointer",
  minHeight: CELL_MIN_HEIGHT,
  display: "flex",
  alignItems: "center",
  outline: "none",
  width: "100%",
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * EditableCell — toggles between display and edit mode for a single table cell.
 *
 * Wires the Phase 3 Jotai focus system to the Phase 2 FieldInput primitives.
 * Handles keyboard navigation (Tab/Shift+Tab) and "just start typing".
 *
 * Used inside `DataTableColumn.cell` render props to enable inline editing
 * without modifying the DataTable component itself.
 *
 * @example
 * ```tsx
 * const columns = [{
 *   id: "name",
 *   header: "Name",
 *   cell: (row) => (
 *     <EditableCell
 *       rowId={getRowKey(row)}
 *       columnId="name"
 *       value={row.name}
 *       renderDisplay={(v) => <TextDisplay text={v as string} />}
 *       renderEdit={(props) => <FieldTextInput instanceId={props.instanceId} ... />}
 *       onPersist={mutation.mutate}
 *       editableColumns={["name", "email"]}
 *     />
 *   ),
 * }];
 * ```
 */
export function EditableCell<TValue = unknown>({
  rowId,
  columnId,
  value,
  renderDisplay,
  renderEdit,
  onPersist,
  editableColumns,
}: EditableCellProps<TValue>) {
  const cellId = buildCellId(rowId, columnId);
  const isEditing = useIsEditingCell(cellId);
  const enterEdit = useEnterEditMode();
  const exitEdit = useExitEditMode();
  const { moveToNextCell, moveToPrevCell } = useCellNavigator(
    editableColumns ?? [],
  );

  // Draft value — starts from the record value, updated on every keystroke
  const [draft, setDraft] = useState<TValue>(value);

  // ── Persist + exit ──────────────────────────────────────────────────

  const persist = useCallback(
    (newValue: TValue) => {
      onPersist(rowId, columnId, newValue);
    },
    [onPersist, rowId, columnId],
  );

  const handleEnter = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      exitEdit(cellId);
    },
    [persist, exitEdit, cellId],
  );

  const handleEscape = useCallback(
    (_finalValue: TValue) => {
      exitEdit(cellId);
    },
    [exitEdit, cellId],
  );

  const handleTab = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      moveToNextCell(cellId);
    },
    [persist, moveToNextCell, cellId],
  );

  const handleShiftTab = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      moveToPrevCell(cellId);
    },
    [persist, moveToPrevCell, cellId],
  );

  const handleClickOutside = useCallback(
    (_event: MouseEvent, finalValue: TValue) => {
      persist(finalValue);
      exitEdit(cellId);
    },
    [persist, exitEdit, cellId],
  );

  // ── "Just start typing" handler ─────────────────────────────────────

  const handleDisplayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isNonTextWritingKey(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Reset draft to original value so the typed character
        // replaces the cell content (Twenty's exact behavior).
        setDraft(value);
        enterEdit(cellId);
      }
    },
    [value, enterEdit, cellId],
  );

  // ── Hover style handlers ────────────────────────────────────────────

  const handleMouseEnter = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.background =
      "var(--ao-background-transparent-light)";
  }, []);

  const handleMouseLeave = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  if (isEditing) {
    const editProps: EditableCellEditProps<TValue> = {
      instanceId: cellId,
      value: draft,
      onChange: setDraft,
      onEnter: handleEnter,
      onEscape: handleEscape,
      onTab: handleTab,
      onShiftTab: handleShiftTab,
      onClickOutside: handleClickOutside,
      autoFocus: true,
    };

    return <>{renderEdit(editProps)}</>;
  }

  return (
    <div
      style={displayContainerStyle}
      onClick={() => {
        setDraft(value);
        enterEdit(cellId);
      }}
      onDoubleClick={() => {
        setDraft(value);
        enterEdit(cellId);
      }}
      onKeyDown={handleDisplayKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${columnId}`}
    >
      {renderDisplay(value)}
    </div>
  );
}
