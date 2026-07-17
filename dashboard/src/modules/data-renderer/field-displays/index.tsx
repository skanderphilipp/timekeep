import { useFieldContext } from "../contexts/field-context";
import { TextFieldDisplay } from "./text-field-display";
import { TimestampFieldDisplay } from "./timestamp-field-display";
import { EnumFieldDisplay } from "./enum-field-display";
import { ReferenceFieldDisplay } from "./reference-field-display";
import { ArrayFieldDisplay } from "./array-field-display";
import { BooleanDisplay } from "@/components/ui/display";
import type {
  TimestampFieldMetadata,
  StatusFieldMetadata,
  EnumFieldMetadata,
  ReferenceFieldMetadata,
  ArrayFieldMetadata,
} from "../types";

/**
 * FieldDisplay — central dispatcher for read-only cell rendering.
 *
 * Routes to the correct display component based on the generic
 * `fieldDefinition.type`. No domain-specific field types exist —
 * all FK/reference navigation uses `ReferenceFieldDisplay` with
 * entity metadata from the column definition.
 */
export function FieldDisplay() {
  const { fieldDefinition, value, entityId } = useFieldContext();

  const type = fieldDefinition.type;

  // ── Text ────────────────────────────────────────────────────────────

  if (type === "text" || type === "number") {
    return <TextFieldDisplay value={value} />;
  }

  // ── Timestamp ───────────────────────────────────────────────────────

  if (type === "timestamp") {
    const meta = fieldDefinition.metadata as TimestampFieldMetadata;
    return <TimestampFieldDisplay value={Number(value ?? 0)} metadata={meta} />;
  }

  // ── Status (colored tag with labels/colors) ─────────────────────────

  if (type === "status") {
    const meta = fieldDefinition.metadata as StatusFieldMetadata;
    return (
      <EnumFieldDisplay
        value={String(value ?? "")}
        labels={meta.labels}
        colors={meta.colors}
      />
    );
  }

  // ── Enum (colored tag with labels/colors, no navigation) ────────────

  if (type === "enum") {
    const meta = fieldDefinition.metadata as EnumFieldMetadata;
    return (
      <EnumFieldDisplay
        value={String(value ?? "")}
        labels={meta.labels}
        colors={meta.colors}
      />
    );
  }

  // ── Reference (clickable FK chip → navigates to entity) ─────────────

  if (type === "reference") {
    const meta = fieldDefinition.metadata as ReferenceFieldMetadata;
    return (
      <ReferenceFieldDisplay
        value={String(value ?? "")}
        entityId={entityId ?? String(value ?? "")}
        referenceEntity={meta.referenceEntity}
      />
    );
  }

  // ── Array (tag chips for string[] or boolean[]) ────────────────────

  if (type === "array") {
    const meta = fieldDefinition.metadata as ArrayFieldMetadata;
    return <ArrayFieldDisplay value={value} metadata={meta} />;
  }

  // ── Boolean (toggle, active/inactive) ──────────────────────────────

  if (type === "boolean") {
    return <BooleanDisplay value={Boolean(value)} />;
  }

  // ── Default fallback ────────────────────────────────────────────────

  return <TextFieldDisplay value={value} />;
}
