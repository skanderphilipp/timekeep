import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineWorkspace } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default defineWorkspace([
  // ── Unit / hook tests (jsdom) ─────────────────────────────────────
  {
    extends: "./vite.config.ts",
    test: {
      name: "unit",
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      css: { modules: { classNameStrategy: "non-scoped" } },
      exclude: [
        "e2e/**",
        "node_modules/**",
        "dist/**",
        "**/*.stories.*",
      ],
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
]);
