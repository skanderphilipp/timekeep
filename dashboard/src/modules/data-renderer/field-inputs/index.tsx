/**
 * FieldEdit dispatcher — routes to the correct Field*Input based on field type.
 *
 * Mirrors `FieldDisplay` (read-only dispatcher) for edit mode.
 * Components call `useFieldContext()` to read the field definition + metadata,
 * then dispatch to the appropriate `Field*Input` from `@/components/ui/field-input`.
 *
 * Supports the full `EditableCellEditProps` event handler suite where
 * applicable. For immediate-commit editors (select, boolean), the
 * `onEnter` callback is used to signal "persist + close".
 */

import { useMemo } from "react";
import { useFieldContext } from "../contexts/field-context";
import {
  FieldTextInput,
  FieldDateInput,
  FieldSelectInput,
} from "@/components/ui/field-input";
import type {
  StatusFieldMetadata,
  DirectionFieldMetadata,
  VerifyMethodFieldMetadata,
} from "../types";
import type { ComboboxOption } from "@/types/options";
import type { EditableCellEditProps } from "@/components/ui/data-table";

/** Default direction option labels. */
const DIRECTION_LABELS: Record<string, string> = {
  in: "IN",
  out: "OUT",
};

export function FieldEdit<TValue = unknown>(props: EditableCellEditProps<TValue>) {
  const { fieldDefinition } = useFieldContext();
  const type = fieldDefinition.type;

  // ── Text-based types (full event suite) ──────────────────────────────

  if (
    type === "text" ||
    type === "device_sn" ||
    type === "user_pin" ||
    type === "employee_name"
  ) {
    return (
      <FieldTextInput
        instanceId={props.instanceId}
        value={String(props.value ?? "")}
        onChange={(v) => props.onChange(v as TValue)}
        onEnter={(v) => props.onEnter(v as TValue)}
        onEscape={(v) => props.onEscape(v as TValue)}
        onTab={(v) => props.onTab(v as TValue)}
        onShiftTab={(v) => props.onShiftTab(v as TValue)}
        onClickOutside={(e, v) => props.onClickOutside(e, v as TValue)}
        autoFocus={props.autoFocus}
      />
    );
  }

  // ── Timestamp → DatePicker ───────────────────────────────────────────

  if (type === "timestamp") {
    return (
      <FieldDateInput
        instanceId={props.instanceId}
        value={String(props.value ?? "")}
        onChange={(v) => props.onChange(v as TValue)}
        onEnter={(v) => props.onEnter(v as TValue)}
        onEscape={(v) => props.onEscape(v as TValue)}
        onClickOutside={(e, v) => props.onClickOutside(e, v as TValue)}
      />
    );
  }

  // ── Status → Dropdown ────────────────────────────────────────────────

  if (type === "status") {
    return <StatusFieldEdit props={props} />;
  }

  // ── Direction → Dropdown ─────────────────────────────────────────────

  if (type === "direction") {
    return <DirectionFieldEdit props={props} />;
  }

  // ── Verify method → Dropdown ─────────────────────────────────────────

  if (type === "verify_method") {
    return <VerifyMethodFieldEdit props={props} />;
  }

  // ── Default fallback: plain text input ───────────────────────────────

  return (
    <FieldTextInput
      instanceId={props.instanceId}
      value={String(props.value ?? "")}
      onChange={(v) => props.onChange(v as TValue)}
      onEnter={(v) => props.onEnter(v as TValue)}
      onEscape={(v) => props.onEscape(v as TValue)}
      onTab={(v) => props.onTab(v as TValue)}
      onShiftTab={(v) => props.onShiftTab(v as TValue)}
      onClickOutside={(e, v) => props.onClickOutside(e, v as TValue)}
      autoFocus={props.autoFocus}
    />
  );
}

// ── Sub-dispatchers ──────────────────────────────────────────────────────────────

/**
 * Status field editor — maps metadata labels to a Combobox dropdown.
 * Selection immediately commits and exits edit mode.
 */
function StatusFieldEdit<TValue = unknown>({
  props,
}: {
  props: EditableCellEditProps<TValue>;
}) {
  const { fieldDefinition } = useFieldContext();
  const meta = fieldDefinition.metadata as StatusFieldMetadata;

  const options = useMemo<ComboboxOption[]>(() => {
    if (!meta.labels) return [];
    return Object.entries(meta.labels).map(([value, label]) => ({
      value,
      label,
    }));
  }, [meta.labels]);

  return (
    <FieldSelectInput
      instanceId={props.instanceId}
      value={String(props.value ?? "")}
      options={options}
      onOptionSelected={(selectedValue) => {
        // Immediate commit: selection = persist + close
        props.onEnter(selectedValue as TValue);
      }}
      onEscape={() => {
        // Close without persisting
        props.onEscape(null as TValue);
      }}
    />
  );
}

/**
 * Direction field editor — IN/OUT dropdown.
 * Selection immediately commits and exits edit mode.
 */
function DirectionFieldEdit<TValue = unknown>({
  props,
}: {
  props: EditableCellEditProps<TValue>;
}) {
  const { fieldDefinition } = useFieldContext();
  const meta = fieldDefinition.metadata as DirectionFieldMetadata;

  const options = useMemo<ComboboxOption[]>(() => {
    const labels = meta.labels ?? DIRECTION_LABELS;
    return Object.entries(labels).map(([value, label]) => ({
      value: value.toUpperCase(),
      label,
    }));
  }, [meta.labels]);

  return (
    <FieldSelectInput
      instanceId={props.instanceId}
      value={String(props.value ?? "")}
      options={options}
      onOptionSelected={(selectedValue) => {
        props.onEnter(selectedValue as TValue);
      }}
      onEscape={() => {
        props.onEscape(null as TValue);
      }}
    />
  );
}

/**
 * Verify method field editor — dropdown of biometric/card/password modes.
 * Selection immediately commits and exits edit mode.
 */
function VerifyMethodFieldEdit<TValue = unknown>({
  props,
}: {
  props: EditableCellEditProps<TValue>;
}) {
  const { fieldDefinition } = useFieldContext();
  const meta = fieldDefinition.metadata as VerifyMethodFieldMetadata;

  const options = useMemo<ComboboxOption[]>(() => {
    if (!meta.labels) return [];
    return Object.entries(meta.labels).map(([value, label]) => ({
      value,
      label,
    }));
  }, [meta.labels]);

  return (
    <FieldSelectInput
      instanceId={props.instanceId}
      value={String(props.value ?? "")}
      options={options}
      onOptionSelected={(selectedValue) => {
        props.onEnter(selectedValue as TValue);
      }}
      onEscape={() => {
        props.onEscape(null as TValue);
      }}
    />
  );
}
