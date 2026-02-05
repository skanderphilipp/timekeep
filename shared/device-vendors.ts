/**
 * Device vendors / manufacturers.
 *
 * Mirrors `DeviceVendor` enum in `crates/timekeep-core/src/model/device.rs`.
 * Serialized as snake_case in API responses.
 *
 * First 4 are known vendors. `Other` is a catch-all with a custom name string
 * (lowercased in the `key()` method).
 *
 * Framework-agnostic: no React, no Lingui, no runtime imports.
 */

/** Known vendor value strings (excluding dynamic `Other` names). */
export type DeviceVendorValue = "zkteco" | "suprema" | "anviz" | "hikvision";

/** A device vendor definition. */
export type DeviceVendor = {
  /** Wire key (snake_case, matches Rust `key()` output). */
  value: DeviceVendorValue;
  /** Human-readable display name (matches Rust `display_name()`). */
  label: string;
};

/**
 * Known device vendors.
 * `Other` variants are dynamic (user-supplied name) and not listed here.
 */
export const DEVICE_VENDORS = [
  { value: "zkteco",   label: "ZKTeco" },
  { value: "suprema",  label: "Suprema" },
  { value: "anviz",    label: "Anviz" },
  { value: "hikvision",label: "Hikvision" },
] as const satisfies readonly DeviceVendor[];

/** Vendor value → definition lookup (known vendors only). */
export const DEVICE_VENDOR_MAP = new Map<DeviceVendorValue, DeviceVendor>(
  DEVICE_VENDORS.map((v) => [v.value, v]),
);

/** Get a known vendor definition by its key string. Returns undefined for `Other` or unknown. */
export function getDeviceVendor(value: string): DeviceVendor | undefined {
  return DEVICE_VENDOR_MAP.get(value as DeviceVendorValue);
}

/** Default vendor when none is specified (matches Rust `Device::new` default). */
export const DEFAULT_DEVICE_VENDOR: DeviceVendorValue = "zkteco";
