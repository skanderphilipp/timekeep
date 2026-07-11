/**
 * Browser-mode setup for Storybook + Vitest integration tests.
 *
 * Runs in the browser before each story test. Handles:
 * - i18n bootstrap (matching .storybook/preview.tsx)
 * - Theme setup
 * - MSW mock service worker
 */

import { i18n } from "@lingui/core";
import { messages as enMessages } from "../src/locales/en";
import "../src/styles/generated-tokens.css";

// ── i18n ────────────────────────────────────────────────────────────
i18n.load("en", enMessages);
i18n.activate("en");
