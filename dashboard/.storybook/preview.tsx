import type { Preview } from "@storybook/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ThemeProvider } from "../src/infrastructure/theme/theme-context";
import { messages as enMessages } from "../src/locales/en";
import { worker } from "../src/testing/mocks/browser";

import "../src/styles/generated-tokens.css";
import "../src/styles/global.scss";

// ── i18n bootstrap ─────────────────────────────────────────────────
i18n.load("en", enMessages);
i18n.activate("en");

// ── MSW bootstrap ──────────────────────────────────────────────────
//
// Start the Mock Service Worker before any story renders.
// This intercepts fetch/ky calls at the network level so pages
// and molecules can run their real data-fetching code.
//
// Atom stories don't use MSW (they're purely presentational).
// Page and molecule stories can override handlers per-story via
// `worker.use(...createHandlers({ ... }))` in their loaders.
//
// TODO(ENTERPRISE): Migrate to msw-storybook-addon for cleaner
// per-story handler loading (pattern used by Twenty).
if (typeof globalThis.process === "undefined") {
  // Only run in browser (Storybook), not in Node (Vitest uses msw/node).
  worker.start({ onUnhandledRequest: "bypass" });
}

// ── Font loading (for visual consistency in screenshots) ───────────
async function waitForFontsLoaded() {
  await document.fonts.ready;
}

// ── Preview configuration ──────────────────────────────────────────
const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true, // We use our own theme system, not Storybook backgrounds
    },
    // Treat accessibility violations as errors.
    // Individual stories can defer non-critical checks with:
    //   parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } }
    a11y: {
      test: "error",
    },
    // Group stories logically in the sidebar.
    options: {
      storySort: {
        order: ["UI", "Modules", "Pages"],
      },
    },
  },

  // Theme switcher in Storybook toolbar
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Color scheme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },

  // Wait for fonts before rendering (prevents layout shift in
  // visual regression screenshots).
  loaders: [waitForFontsLoaded],

  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as "light" | "dark";

      useEffect(() => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
      }, [theme]);

      return (
        <MemoryRouter>
          <JotaiProvider>
            <I18nProvider i18n={i18n}>
              <ThemeProvider>
                <Story />
              </ThemeProvider>
            </I18nProvider>
          </JotaiProvider>
        </MemoryRouter>
      );
    },
  ],
};

export default preview;
