/**
 * Verify modes — how a user was identified at the biometric scanner.
 *
 * These are **normalized domain values**, independent of any specific
 * device vendor or protocol. Protocol-level integer codes (ZKTeco,
 * Suprema, etc.) belong in the respective provider crate, not here.
 *
 * Mirrors `VerifyMode` enum in `crates/timekeep-core/src/model/punch.rs`.
 * Serialized as snake_case in API responses.
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Canonical verify mode value strings — vendor-agnostic. */
export type VerifyModeValue = "password" | "fingerprint" | "card" | "face" | "palm";

/** A verify mode definition. */
export type VerifyMode = {
  /** Wire value (snake_case). */
  value: VerifyModeValue;
  /** Human-readable display name. */
  label: string;
  /** Short display name for compact UI (badges, icons). */
  shortLabel: string;
};

/**
 * All supported verification modes (vendor-agnostic).
 *
 * Protocol-level integer codes live in the provider layer
 * (e.g., `crates/timekeep-zkteco` maps ZKTeco codes → these values).
 */
export const VERIFY_MODES = [
  { value: "password",    label: "Password",        shortLabel: "PW" },
  { value: "fingerprint", label: "Fingerprint",     shortLabel: "FP" },
  { value: "card",        label: "RF Card",         shortLabel: "Card" },
  { value: "face",        label: "Face Recognition",shortLabel: "Face" },
  { value: "palm",        label: "Palm Vein",       shortLabel: "Palm" },
] as const satisfies readonly VerifyMode[];

/** Verify mode value → definition lookup. */
export const VERIFY_MODE_MAP = new Map<VerifyModeValue, VerifyMode>(
  VERIFY_MODES.map((m) => [m.value, m]),
);

/** Get a verify mode definition by its normalized value string. */
export function getVerifyMode(value: string): VerifyMode | undefined {
  return VERIFY_MODE_MAP.get(value as VerifyModeValue);
}
