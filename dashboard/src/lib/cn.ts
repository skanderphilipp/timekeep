import { clsx, type ClassValue } from "clsx";

/** Merge class names with clsx. Shorthand used across all components. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
