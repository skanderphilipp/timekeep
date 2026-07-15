import { lingui } from "@lingui/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import sassDts from "vite-plugin-sass-dts";
import svgr from "vite-plugin-svgr";
import postcssRtl from "postcss-rtlcss";
import { codeInspectorPlugin } from "code-inspector-plugin";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  return {
    plugins: [
      ...(isDev ? [codeInspectorPlugin({ bundler: "vite", editor: "zed" })] : []),
      react({ plugins: [["@lingui/swc-plugin", {}]] }),
      lingui(),
      svgr(),
      sassDts({ enabledMode: ["development"] }),
      checker({ typescript: true, overlay: false }),
      // Strip MSW service worker from production builds.
      // It is a dev-only tool; shipping it to prod is wasteful.
      {
        name: "strip-msw-worker",
        apply: "build",
        closeBundle() {
          const mswPath = path.resolve(__dirname, "dist/mockServiceWorker.js");
          if (fs.existsSync(mswPath)) {
            fs.unlinkSync(mswPath);
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "../shared"),
        "@assets": path.resolve(__dirname, "./src/components/reaktly-ui/assets"),
      },
    },
    css: {
      modules: { localsConvention: "camelCaseOnly" },
      postcss: {
        plugins: [postcssRtl()],
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://localhost:3000", changeOrigin: true },
        "/events": { target: "http://localhost:3000", changeOrigin: true },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: isDev,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: ["@base-ui/react"],
            query: ["@tanstack/react-query"],
            i18n: ["@lingui/core", "@lingui/react"],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      css: { modules: { classNameStrategy: "non-scoped" } },
      exclude: ["e2e/**", "node_modules/**", "dist/**"],
    },
  };
});
