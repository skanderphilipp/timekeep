/**
 * CSS-injected annotation overlay for Playwright screenshots.
 *
 * Resolves Playwright locators (including `text=...`, `css=...`, etc.)
 * to element bounding boxes, then injects numbered DOM overlays at
 * those positions before taking a screenshot.
 *
 * Usage:
 *   await annotatedScreenshot(page, "shot.png", [
 *     { locator: page.getByText("Present"), number: 1 },
 *     { locator: page.locator('[data-slot="stat-card"]').first(), number: 2 },
 *   ]);
 */

import type { Page, Locator } from "playwright";

/** A single annotation target. */
export interface AnnotationTarget {
  /** Playwright locator for the element to highlight. */
  locator: Locator;
  /** Badge number (1–99). Displayed in a red circle. */
  number: number;
  /** Optional color override for this annotation's border + badge. */
  color?: string;
}

const DEFAULT_COLOR = "#e53e3e";
const ANNOTATION_CONTAINER_ID = "__docs_annotation_container__";

interface RectData {
  x: number;
  y: number;
  w: number;
  h: number;
  number: number;
  color: string;
}

/**
 * Resolves all annotation targets to their bounding boxes,
 * injects numbered DOM overlays, takes a screenshot, and cleans up.
 */
export async function annotatedScreenshot(
  page: Page,
  path: string,
  targets: AnnotationTarget[],
): Promise<void> {
  // ── Resolve locator positions in Playwright ──────────────────────
  const rects: RectData[] = [];
  for (const t of targets) {
    try {
      const box = await t.locator.first().boundingBox({ timeout: 2000 });
      if (box) {
        rects.push({
          x: box.x,
          y: box.y,
          w: box.width,
          h: box.height,
          number: t.number,
          color: t.color ?? DEFAULT_COLOR,
        });
      }
    } catch {
      // Element not found or not visible — skip this annotation
    }
  }

  // ── Inject DOM overlays at resolved positions ────────────────────
  if (rects.length > 0) {
    await page.evaluate(
      ({ rects: r, containerId }) => {
        const existing = document.getElementById(containerId);
        if (existing) existing.remove();

        const container = document.createElement("div");
        container.id = containerId;
        container.style.cssText =
          "position:fixed;inset:0;pointer-events:none;z-index:99999;";
        document.body.appendChild(container);

        for (const { x, y, w, h, number, color } of r) {
          // Border box
          const box = document.createElement("div");
          box.style.cssText = [
            `position:fixed;`,
            `left:${x - 4}px;top:${y - 4}px;`,
            `width:${w + 8}px;height:${h + 8}px;`,
            `border:2.5px solid ${color};border-radius:6px;`,
            `pointer-events:none;`,
            `box-shadow:0 0 0 4px ${color}22;`,
          ].join("");
          container.appendChild(box);

          // Numbered badge
          const badge = document.createElement("div");
          badge.textContent = String(number);
          badge.style.cssText = [
            `position:fixed;`,
            `left:${x - 14}px;top:${y - 14}px;`,
            `width:24px;height:24px;`,
            `background:${color};color:white;border-radius:50%;`,
            `display:flex;align-items:center;justify-content:center;`,
            `font:bold 13px -apple-system,BlinkMacSystemFont,sans-serif;`,
            `line-height:1;pointer-events:none;`,
            `box-shadow:0 1px 3px rgba(0,0,0,0.3);`,
          ].join("");
          container.appendChild(badge);
        }
      },
      { rects, containerId: ANNOTATION_CONTAINER_ID },
    );
  }

  // ── Take screenshot ──────────────────────────────────────────────
  await page.screenshot({ path, fullPage: false });

  // ── Clean up DOM overlays ────────────────────────────────────────
  await page.evaluate(
    ({ containerId }) => {
      const el = document.getElementById(containerId);
      if (el) el.remove();
    },
    { containerId: ANNOTATION_CONTAINER_ID },
  );
}
