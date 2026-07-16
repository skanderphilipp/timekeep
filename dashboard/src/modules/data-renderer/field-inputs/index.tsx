/**
 * FieldEdit dispatcher — routes to the correct Field*Input based on field type.
 *
 * Mirrors `FieldDisplay` (read-only dispatcher) for edit mode.
 * Generic — no domain-specific type branches.
 *
 * Supports the full `EditableCellEditProps` event handler suite where
 * applicable. For immediate-commit editors (select), the
 * `onEnter` callback is used to signal "persist + close".
 */

import { useMemo } from "react";
import { useFieldContext } from "../contexts/field-context";
import {
  FieldTextInput,
  FieldDateInput,
  FieldSelectInput,
  FieldNumberInput,
  FieldTimeInput,
  FieldWeekdayToggle,
} from "@/components/ui/field-input";
import type {
  StatusFieldMetadata,
  EnumFieldMetadata,
  ReferenceFieldMetadata,
  ArrayFieldMetadata,
  TextFieldMetadata,
} from "../types";
import type { ComboboxOption } from "@/types/options";
import { Spinner, Text } from "@/components/ui";
import type { EditableCellEditProps } from "@/components/ui/data-table";

export function FieldEdit<TValue = unknown>(props: EditableCellEditProps<TValue>) {
  const { fieldDefinition, isLoadingOptions } = useFieldContext();
  const type = fieldDefinition.type;

  // ── Number ──────────────────────────────────────────────────────────

  if (type === "number") {
    return (
      <FieldNumberInput
        instanceId={props.instanceId}
        value={Number(props.value ?? 0)}
        onChange={(v) => props.onChange(Number(v) as TValue)}
        onEnter={(v) => props.onEnter(v as TValue)}
        onEscape={(v) => props.onEscape(v as TValue)}
        onTab={(v) => props.onTab(v as TValue)}
        onShiftTab={(v) => props.onShiftTab(v as TValue)}
        onClickOutside={(e, v) => props.onClickOutside(e, v as TValue)}
        autoFocus={props.autoFocus}
      />
    );
  }

  // ── Text (plain or time) ────────────────────────────────────────────

  if (type === "text") {
    const meta = fieldDefinition.metadata as TextFieldMetadata;
    if (meta.inputType === "time") {
      return (
        <FieldTimeInput
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

  // ── Timestamp (date picker) ──────────────────────────────────────────

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

  // ── Status / Enum (select dropdown) ──────────────────────────────────

  if (type === "status") {
    const meta = fieldDefinition.metadata as StatusFieldMetadata;
    return <EnumSelectEdit<TValue> props={props} labels={meta.labels} />;
  }

  if (type === "enum") {
    const meta = fieldDefinition.metadata as EnumFieldMetadata;
    return <EnumSelectEdit<TValue> props={props} labels={meta.labels} />;
  }

  // ── Reference (select dropdown — options from metadata) ──────────────

  if (type === "reference") {
    const meta = fieldDefinition.metadata as ReferenceFieldMetadata;
    return <SelectFieldEdit<TValue> props={props} options={meta.options ?? []} isLoadingOptions={isLoadingOptions} />;
  }

  // ── Array (weekday toggle when positionLabels exist) ─────────────────

  if (type === "array") {
    const meta = fieldDefinition.metadata as ArrayFieldMetadata;
    if (meta.positionLabels && meta.positionLabels.length > 0) {
      const days = Array.isArray(props.value) ? (props.value as boolean[]) : [];
      return (
        <FieldWeekdayToggle
          instanceId={props.instanceId}
          value={days.length === 7 ? days : Array(7).fill(false)}
          dayLabels={meta.positionLabels}
          onChange={(v) => props.onChange(v as TValue)}
          onEnter={(v) => props.onEnter(v as TValue)}
          onEscape={(v) => props.onEscape(v as TValue)}
          onClickOutside={(e, v) => props.onClickOutside(e, v as TValue)}
        />
      );
    }
    // Fallback for non-weekday arrays: plain text input
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

// ── Shared sub-components ────────────────────────────────────────────────────

function EnumSelectEdit<TValue = unknown>({
  props,
  labels,
}: {
  props: EditableCellEditProps<TValue>;
  labels?: Record<string, string>;
}) {
  const options = useMemo<ComboboxOption[]>(() => {
    if (!labels) return [];
    return Object.entries(labels).map(([value, label]) => ({
      value,
      label,
    }));
  }, [labels]);

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

function SelectFieldEdit<TValue = unknown>({
  props,
  options,
  isLoadingOptions,
}: {
  props: EditableCellEditProps<TValue>;
  options: ComboboxOption[];
  isLoadingOptions?: boolean;
}) {
  if (options.length === 0 && isLoadingOptions) {
    return (
      <div style={{ padding: "var(--ao-spacing-2)", display: "flex", alignItems: "center", gap: "var(--ao-spacing-2)" }}>
        <Spinner size="sm" />
        <Text variant="body" color="secondary">Loading options...</Text>
      </div>
    );
  }
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
