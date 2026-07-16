import { useState, useCallback, useRef, type ReactNode, type RefObject } from "react";
import { IconPencil } from "@tabler/icons-react";
import {
  useIsEditingCell,
  useEnterEditMode,
  useExitEditMode,
} from "@/infrastructure/state";
import { useRegisterFieldEvents } from "@/components/ui/field-input";
import type { EditableCellEditProps } from "@/components/ui/data-table";

import styles from "./inline-field-edit.module.scss";

// ── Types ────────────────────────────────────────────────────────────────────

export type InlineFieldEditProps<TValue = unknown> = {
  /**
   * Unique identifier for this field instance.
   * Convention: `{entity}-{recordId}-{fieldName}` to avoid collisions.
   *
   * @example `employee-abc123-name`
   */
  fieldId: string;
  /** Current value from the record. */
  value: TValue;
  /**
   * Called when the user commits a value (Enter, Escape, Tab, ClickOutside).
   * Should trigger a mutation (TanStack Query or direct API).
   */
  onPersist: (value: TValue) => void;
  /**
   * Renders the read-only display view.
   * Receives the current value + a click handler + a ref to attach.
   *
   * The `displayRef` MUST be attached to the outermost display element
   * for click-outside detection to work during edit mode.
   */
  renderDisplay: (state: {
    value: TValue;
    onClick: () => void;
    displayRef: RefObject<HTMLDivElement | null>;
  }) => ReactNode;
  /**
   * Renders the editable input view.
   * Receives pre-wired event handlers — forward to a `Field*Input` component.
   *
   * If omitted, the field is read-only (no edit mode, no hover button).
   */
  renderEdit?: (props: EditableCellEditProps<TValue>) => ReactNode;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEmptyValue(value: unknown): boolean {
  return value === "" || value === null || value === undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * InlineFieldEdit — click-to-edit wrapper for detail view fields.
 *
 * Lighter than {@link EditableCell} — no table-cell coordination, no Tab
 * navigation between fields. Works on any display component (Heading, Badge,
 * Text, MetadataGrid item).
 *
 * Reuses the same Jotai `editingCellIdAtom` focus system and the same
 * `useRegisterFieldEvents` keyboard handling as table inline editing.
 *
 * **Phase 5 — Hover edit button:**
 * On hover, a subtle highlight appears behind the content and a pencil icon
 * fades in to the right. Clicking either the content or the pencil enters
 * edit mode. This matches Twenty's `RecordInlineCellDisplayMode` pattern:
 *   twenty-front/src/modules/object-record/record-inline-cell/components/RecordInlineCellDisplayMode.tsx
 */
export function InlineFieldEdit<TValue = unknown>({
  fieldId,
  value,
  onPersist,
  renderDisplay,
  renderEdit,
}: InlineFieldEditProps<TValue>) {
  const isEditing = useIsEditingCell(fieldId);
  const enterEditFn = useEnterEditMode();
  const exitEditFn = useExitEditMode();

  // Wrapper ref — used for click-outside detection during edit mode.
  // This ensures clicks on the edit button don't trigger click-outside.
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Display ref — passed to consumers for backward compatibility.
  // Consumers can still attach it, but click-outside now uses wrapperRef.
  const displayRef = useRef<HTMLDivElement | null>(null);

  // Hover state for the highlight + edit button reveal
  const [isHovered, setIsHovered] = useState(false);

  // Draft value — starts from the record value, updated on every keystroke
  const [draft, setDraft] = useState<TValue>(value);

  // ── Derived state ────────────────────────────────────────────────────

  const isEmpty = isEmptyValue(value);
  const canEdit = renderEdit !== undefined;

  // ── Persist + exit callbacks ────────────────────────────────────────

  const persist = useCallback(
    (newValue: TValue) => {
      onPersist(newValue);
    },
    [onPersist],
  );

  const exitEdit = useCallback(() => {
    exitEditFn(fieldId);
  }, [exitEditFn, fieldId]);

  const handleEnter = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      exitEdit();
    },
    [persist, exitEdit],
  );

  const handleEscape = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      exitEdit();
    },
    [persist, exitEdit],
  );

  const handleTab = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      exitEdit();
    },
    [persist, exitEdit],
  );

  const handleShiftTab = useCallback(
    (finalValue: TValue) => {
      persist(finalValue);
      exitEdit();
    },
    [persist, exitEdit],
  );

  const handleClickOutside = useCallback(
    (_event: MouseEvent, finalValue: TValue) => {
      persist(finalValue);
      exitEdit();
    },
    [persist, exitEdit],
  );

  // ── Keyboard + click-outside (always registered, enabled only in edit mode)
  // Uses wrapperRef so clicks on the edit button don't trigger click-outside.
  useRegisterFieldEvents<TValue>({
    inputRef: wrapperRef,
    inputValue: draft,
    onEnter: handleEnter,
    onEscape: handleEscape,
    onTab: handleTab,
    onShiftTab: handleShiftTab,
    onClickOutside: (e, v) => handleClickOutside(e, v),
    enabled: isEditing,
  });

  // ── Enter edit mode ─────────────────────────────────────────────────

  const enterEdit = useCallback(() => {
    setDraft(value);
    enterEditFn(fieldId);
  }, [value, enterEditFn, fieldId]);

  // ── Hover handlers ──────────────────────────────────────────────────

  const handleMouseEnter = useCallback(() => {
    if (!isEditing && canEdit) {
      setIsHovered(true);
    }
  }, [isEditing, canEdit]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // ── Render: Edit mode ───────────────────────────────────────────────

  if (isEditing) {
    if (!renderEdit) return null;

    const editProps: EditableCellEditProps<TValue> = {
      instanceId: fieldId,
      value: draft,
      onChange: setDraft,
      onEnter: handleEnter,
      onEscape: handleEscape,
      onTab: handleTab,
      onShiftTab: handleShiftTab,
      onClickOutside: handleClickOutside,
      autoFocus: true,
    };

    return <div ref={wrapperRef}>{renderEdit(editProps)}</div>;
  }

  // ── Render: Display mode ────────────────────────────────────────────

  const showEditButton = canEdit && isHovered && !isEmpty;

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      data-editable={canEdit || undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.content} onClick={canEdit ? enterEdit : undefined}>
        {renderDisplay({
          value,
          onClick: enterEdit,
          displayRef,
        })}
      </span>

      {showEditButton && (
        <span className={styles.editButton}>
          <button
            type="button"
            className={styles.editButtonInner}
            onClick={enterEdit}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </button>
        </span>
      )}
    </div>
  );
}
