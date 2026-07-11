import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],

  // TODO(ENTERPRISE): Scoped story globs for faster startup.
  //
  // When the story count grows large (>200), load only the scope you're
  // working on by setting the STORYBOOK_SCOPE env var:
  //
  //   STORYBOOK_SCOPE=ui        pnpm storybook   # UI primitives only
  //   STORYBOOK_SCOPE=modules   pnpm storybook   # Domain modules only
  //   STORYBOOK_SCOPE=pages     pnpm storybook   # Page compositions
  //
  // Implementation:
  //   const scope = process.env.STORYBOOK_SCOPE;
  //   stories: scope === 'ui'
  //     ? ['../src/components/ui/**/*.stories.@(ts|tsx)']
  //     : scope === 'modules'
  //       ? ['../src/modules/**/*.stories.@(ts|tsx)']
  //       : ['../src/**/*.stories.@(ts|tsx)'],
  //
  // Pattern adapted from Twenty's twenty-front/.storybook/main.ts.

  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-links",
    // Enables :hover, :active, :focus pseudo-classes in stories via
    //   parameters: { pseudo: { hover: '.hover', focus: '.focus' } }
    "storybook-addon-pseudo-states",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(baseConfig) {
    const { mergeConfig } = await import("vite");
    const { lingui } = await import("@lingui/vite-plugin");

    return mergeConfig(baseConfig, {
      plugins: [lingui()],
      resolve: {
        alias: {
          "@": resolve(__dirname, "../src"),
          "@shared": resolve(__dirname, "../../shared"),
          // Replace the compile-time Lingui macro with the runtime mock.
          // The real macros (msg, t) are normally compiled away by the SWC
          // plugin at build time. In Storybook's Vite dev server, the SWC
          // plugin conflicts with @storybook/react-vite's built-in Babel
          // React plugin (double React Refresh injection). The mock returns
          // a MessageDescriptor shape that the i18n runtime (already loaded
          // in preview.tsx via i18n.load + i18n.activate) can resolve.
          // Replace the compile-time Lingui macro with the runtime mock.
          "@lingui/core/macro": resolve(__dirname, "lingui-macro-mock.ts"),
        },
      },
      css: {
        modules: { localsConvention: "camelCaseOnly" },
      },
    });
  },
};

export default config;
