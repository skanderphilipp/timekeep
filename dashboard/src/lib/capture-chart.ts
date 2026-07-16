/**
 * Capture a DOM element (typically a Nivo chart container) as a PNG data URL
 * for embedding in jsPDF reports. Uses html2canvas for reliable CSS/SVG rendering.
 */
import html2canvas from "html2canvas";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /** Output scale multiplier. Default 2 (retina). */
  scale?: number;
  /**
   * TODO(ENTERPRISE): Resolve from design tokens instead of hardcoding.
   *
   * Phase: Polish
   * Impact: Chart backgrounds are always white regardless of theme.
   * Fix: Read the document body background color via getComputedStyle.
   */
  backgroundColor?: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Capture a DOM element as a PNG data URL.
 *
 * Uses html2canvas for pixel-perfect rendering of SVG charts, CSS-styled
 * elements, and responsive layouts. Handles Nivo's responsive chart wrappers
 * correctly — no manual SVG serialization needed.
 *
 * @param container — the element to capture (e.g., `[data-pdf-chart]`)
 * @param options — capture configuration
 * @returns `data:image/png;base64,...` URL for `doc.addImage()`
 */
export async function captureChart(
  container: HTMLElement,
  options: CaptureOptions = {},
): Promise<string> {
  // oxlint-disable-next-line bentech/no-hardcoded-colors -- PDF canvas bg, no CSS token context
  const { scale = 2, backgroundColor = "#ffffff" } = options;

  const canvas = await html2canvas(container, {
    scale,
    backgroundColor,
    useCORS: true,
    logging: false,
    allowTaint: false,
  });

  return canvas.toDataURL("image/png");
}
