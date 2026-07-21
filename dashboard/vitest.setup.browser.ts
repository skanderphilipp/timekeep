/**
 * Browser-mode setup for integration tests.
 *
 * Runs in the real browser (Playwright Chromium) — NOT jsdom.
 * Polyfills (ResizeObserver, localStorage, web streams) are unnecessary here
 * because the actual browser provides them natively.
 */

import "@testing-library/jest-dom/vitest";

import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ── i18n (must be bootstrapped before any component renders) ────────────

i18n.load("en", enMessages);
i18n.activate("en");

// ── DOM cleanup ─────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  localStorage.clear();
});
