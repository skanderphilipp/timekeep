import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
    "@storybook/addon-links",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(baseConfig) {
    return mergeConfig(baseConfig, {
      resolve: {
        alias: {
                  "@": path.resolve(__dirname, "../src"),
                  "@shared": path.resolve(__dirname, "../../shared"),
                  "@assets": path.resolve(__dirname, "../src/components/reaktly-ui/assets"),
                },
      },
      css: {
        modules: { localsConvention: "camelCaseOnly" },
      },
    });
  },
};

export default config;
