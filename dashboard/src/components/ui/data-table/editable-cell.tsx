import { useState, useCallback, type ReactNode } from "react";
import { clsx } from "clsx";
import { IconPencil } from "@tabler/icons-react";
import {
  buildCellId,
  useIsEditingCell,
  useEnterEditMode,
  useExitEditMode,
  useCellNavigator,
} from "@/infrastructure/state";
import { isNonTextWritingKey } from "@/components/ui/field-input";

import styles from "./editable-cell.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type EditableCellEditProps<TValue = unknown> = {
  instanceId: string;
  value: TValue;
  onChange: (newValue: TValue) => void;
  onEnter: (finalValue: TValue) => void;
  onEscape: (finalValue: TValue) => void;
  onTab: (finalValue: TValue) => void;
  onShiftTab: (finalValue: TValue) => void;
  onClickOutside: (event: MouseEvent, finalValue: TValue) => void;
  autoFocus: boolean;
};

export type EditableCellProps<TValue = unknown> = {
  rowId: string;
  columnId: string;
  value: TValue;
  renderDisplay: (value: TValue) => ReactNode;
  renderEdit: (props: EditableCellEditProps<TValue>) => ReactNode;
  onPersist: (rowId: string, columnId: string, value: TValue) => void;
  editableColumns?: string[];
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * EditableCell — toggles between display and edit mode for a single table cell.
 *
 * Styling via SCSS module (no inline styles).
 * Features: hover background with border-radius, animated pencil icon,
 * empty state placeholder, "just start typing" keyboard support.
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

  const [draft, setDraft] = useState<TValue>(value);
  const [isHovered, setIsHovered] = useState(false);

  const isEmpty =
    value === null || value === undefined || value === "";

  // ── Persist + exit ──────────────────────────────────────────────────

  const persist = useCallback(
    (newValue: TValue) => {
      onPersist(rowId, columnId, newValue);
    },
    [onPersist, rowId, columnId],
  );

  const handleEnter = useCallback(
    (finalValue: TValue) => { persist(finalValue); exitEdit(cellId); },
    [persist, exitEdit, cellId],
  );
  const handleEscape = useCallback(
    (finalValue: TValue) => { persist(finalValue); exitEdit(cellId); },
    [persist, exitEdit, cellId],
  );
  const handleTab = useCallback(
    (finalValue: TValue) => { persist(finalValue); moveToNextCell(cellId); },
    [persist, moveToNextCell, cellId],
  );
  const handleShiftTab = useCallback(
    (finalValue: TValue) => { persist(finalValue); moveToPrevCell(cellId); },
    [persist, moveToPrevCell, cellId],
  );
  const handleClickOutside = useCallback(
    (_event: MouseEvent, finalValue: TValue) => { persist(finalValue); exitEdit(cellId); },
    [persist, exitEdit, cellId],
  );

  // ── "Just start typing" ─────────────────────────────────────────────

  const handleDisplayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isNonTextWritingKey(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setDraft(value);
        enterEdit(cellId);
      }
    },
    [value, enterEdit, cellId],
  );

  // ── Hover ───────────────────────────────────────────────────────────

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // ── Click to edit (outside any inner clickable elements) ────────────

  const handleCellClick = useCallback(() => {
    setDraft(value);
    enterEdit(cellId);
  }, [value, enterEdit, cellId]);

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
      className={clsx(styles.cell, isHovered && styles.cellHovered)}
      onClick={handleCellClick}
      onDoubleClick={handleCellClick}
      onKeyDown={handleDisplayKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${columnId}`}
    >
      <span className={styles.content}>
        {isEmpty ? (
          <span className={styles.empty}>Empty</span>
        ) : (
          renderDisplay(value)
        )}
      </span>

      {/* Hover edit button — explicit onClick for reliability */}
      <button
        type="button"
        className={clsx(styles.editButton, isHovered && styles.editButtonVisible)}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          enterEdit(cellId);
        }}
        aria-label={`Edit ${columnId}`}
      >
        <IconPencil size={14} />
      </button>
    </div>
  );
}
