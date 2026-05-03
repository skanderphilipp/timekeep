import { useFieldContext } from "../contexts/field-context";

import { TextFieldDisplay } from "./text-field-display";
import { DeviceSnFieldDisplay } from "./device-sn-field-display";
import { UserPinFieldDisplay } from "./user-pin-field-display";
import { TimestampFieldDisplay } from "./timestamp-field-display";
import { StatusFieldDisplay } from "./status-field-display";
import { DirectionFieldDisplay } from "./direction-field-display";
import { VerifyMethodFieldDisplay } from "./verify-method-field-display";
import type {
  TimestampFieldMetadata,
  StatusFieldMetadata,
  DirectionFieldMetadata,
  VerifyMethodFieldMetadata,
} from "../types";

/**
 * FieldDisplay — central dispatcher for cell rendering.
 *
 * Uses type guards (ported pulse pattern) for rendering dispatch
 * and targeted type assertions for metadata access where TypeScript's
 * discriminated union narrowing through generic FieldDefinition<T>
 * encounters limitations.
 *
 * Rendering priority:
 * 1. type guards + dedicated display components
 * 2. default: plain text
 */
export function FieldDisplay() {
  const { fieldDefinition, value } = useFieldContext();

  const type = fieldDefinition.type;

  // Device serial number → clickable chip → device detail
  if (type === "device_sn") {
    return <DeviceSnFieldDisplay value={String(value ?? "")} />;
  }

  // User PIN → clickable chip → user detail
  if (type === "user_pin") {
    return <UserPinFieldDisplay value={String(value ?? "")} />;
  }

  // Timestamp → formatted date/time
  if (type === "timestamp") {
    const meta = fieldDefinition.metadata as TimestampFieldMetadata;
    return (
      <TimestampFieldDisplay
        value={Number(value ?? 0)}
        metadata={meta}
      />
    );
  }

  // Status → colored Tag
  if (type === "status") {
    const meta = fieldDefinition.metadata as StatusFieldMetadata;
    return (
      <StatusFieldDisplay
        value={String(value ?? "")}
        labels={meta.labels}
        colors={meta.colors}
      />
    );
  }

  // Direction → IN/OUT Tag
  if (type === "direction") {
    const meta = fieldDefinition.metadata as DirectionFieldMetadata;
    return (
      <DirectionFieldDisplay
        value={String(value ?? "")}
        labels={meta.labels}
      />
    );
  }

  // Verify method → colored Tag (fingerprint, face, card, password, palm)
  if (type === "verify_method") {
    const meta = fieldDefinition.metadata as VerifyMethodFieldMetadata;
    return (
      <VerifyMethodFieldDisplay
        value={String(value ?? "")}
        labels={meta.labels}
        colors={meta.colors}
      />
    );
  }

  // Default: plain text
  return <TextFieldDisplay value={value} />;
}
