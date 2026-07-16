/**
 * TODO(ENTERPRISE): Resolve these PDF colors from the design token system.
 *
 * Phase: Polish
 * Impact: PDF colors may drift from the app's theme over time.
 * Fix: Use the same token resolution as useChartTheme(), falling back to
 *       these hex values when no document context is available (SSR).
 *
 * Rationale: jsPDF uses RGB tuples, not CSS custom properties, so we can't
 * directly reference `var(--ao-*)` tokens. These constants mirror the current
 * Radix-based accent scale.
 */

export const BRAND_COLOR: [number, number, number] = [74, 144, 217]; // #4A90D9
export const BRAND_DARK: [number, number, number] = [30, 58, 95];
export const DARK_COLOR: [number, number, number] = [30, 41, 59]; // #1E293B
export const LIGHT_GRAY: [number, number, number] = [100, 116, 139]; // #64748B
export const BORDER_COLOR: [number, number, number] = [203, 213, 225]; // #CBD5E1
export const CARD_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC
export const WHITE: [number, number, number] = [255, 255, 255];
export const AMBER: [number, number, number] = [245, 158, 11];
export const RED: [number, number, number] = [239, 68, 68];

export const MARGIN = 22;
export const CONTENT_WIDTH = 253; // landscape A4 (297mm) minus 2 × MARGIN
