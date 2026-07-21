import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Vitest 4 replaced `vitest.workspace.ts` with `test.projects`.
export default defineConfig({
  test: {
    projects: [
      // ── Unit / hook tests (jsdom) ─────────────────────────────────────
      {
        extends: "./vite.config.ts",
        test: {
          name: "unit",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          css: { modules: { classNameStrategy: "non-scoped" } },
          exclude: ["e2e/**", "node_modules/**", "dist/**", "**/*.stories.*", "**/*.browser.test.*", "**/*.browser.spec.*"],
        },
      },

      // ── Browser integration tests (Playwright) ───────────────────────
      {
        extends: "./vite.config.ts",
        test: {
          name: "browser",
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: ["./vitest.setup.browser.ts"],
          include: ["src/**/*.browser.test.@(ts|tsx)", "src/**/*.browser.spec.@(ts|tsx)"],
          exclude: ["e2e/**", "node_modules/**", "dist/**"],
          css: { modules: { classNameStrategy: "non-scoped" } },
          testTimeout: FIVE_MINUTES_MS,
          retry: 2,
        },
      },

      // ── Story (browser) tests ────────────────────────────────────────
      {
        extends: "./vite.config.ts",
        plugins: [
          storybookTest({
            configDir: resolve(__dirname, ".storybook"),
            storybookScript: "pnpm storybook --no-open --port 6008",
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: ["./.storybook/vitest.setup.ts"],
          include: ["src/**/*.stories.@(ts|tsx)"],
          testTimeout: FIVE_MINUTES_MS,
          retry: 2,
          // Storybook stories don't use vitest globals (expect, fn etc. come
          // from @storybook/test, not vitest).
          globals: false,
        },
      },
    ],
  },
});
