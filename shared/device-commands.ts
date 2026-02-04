/**
 * Device commands — operations that can be enqueued on biometric scanners.
 *
 * Mirrors command strings in `crates/timekeep-api/src/request.rs`:
 * - `EnqueueCommandRequest.command` (SCREAMING_SNAKE_CASE)
 * - `BatchActionRequest.action` (snake_case, same operations)
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical device command value strings (wire format is SCREAMING_SNAKE_CASE). */
export type DeviceCommandValue = "REBOOT" | "CLEAR_ATTENDANCE" | "ENABLE" | "DISABLE";

/** A device command definition. */
export type DeviceCommand = {
  /** Wire value sent to the API. */
  value: DeviceCommandValue;
  /** Human-readable label for dropdowns. */
  label: string;
  /** Brief description of what the command does. */
  description: string;
  /** Whether this command is potentially destructive. */
  isDestructive: boolean;
};

/**
 * All supported device commands.
 */
export const DEVICE_COMMANDS = [
  {
    value: "REBOOT",
    label: "Reboot",
    description: "Restart the device remotely.",
    isDestructive: false,
  },
  {
    value: "CLEAR_ATTENDANCE",
    label: "Clear Attendance",
    description: "Delete all attendance records from the device. Data already synced to the server is preserved.",
    isDestructive: true,
  },
  {
    value: "ENABLE",
    label: "Enable",
    description: "Re-enable a disabled device (resume polling).",
    isDestructive: false,
  },
  {
    value: "DISABLE",
    label: "Disable",
    description: "Temporarily disable the device (pause polling).",
    isDestructive: false,
  },
] as const satisfies readonly DeviceCommand[];

/** Command value → definition lookup. */
export const DEVICE_COMMAND_MAP = new Map<DeviceCommandValue, DeviceCommand>(
  DEVICE_COMMANDS.map((c) => [c.value, c]),
);

/** Get a command definition by its value string. */
export function getDeviceCommand(value: string): DeviceCommand | undefined {
  return DEVICE_COMMAND_MAP.get(value as DeviceCommandValue);
}

/** Destructive command values (for confirmation dialogs). */
export const DESTRUCTIVE_COMMANDS = new Set(
  DEVICE_COMMANDS.filter((c) => c.isDestructive).map((c) => c.value),
);
