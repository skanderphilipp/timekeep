/**
 * Type guard utilities for narrowing unknown values.
 *
 * These are adapted from Reaktly's shared.ts guard functions and are useful
 * for filtering arrays, validating API responses, and narrowing union types.
 */

/** Returns true if the value is not null and not undefined. */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Returns true if the value is null or undefined. */
export function isUndefinedOrNull(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Returns true if the value is a boolean. */
export function isBoolean<U>(term: boolean | U): term is boolean {
  return typeof term === "boolean";
}

/** Returns true if the value is a number (not NaN). */
export function isNumber<U>(term: number | U): term is number {
  return typeof term === "number" && !Number.isNaN(term);
}

/** Returns true if the value is a string. */
export function isString<U>(term: string | U): term is string {
  return typeof term === "string";
}

/** Returns true if the value is a string with length > 0. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Returns true if the value is an array with length > 0. */
export function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}
