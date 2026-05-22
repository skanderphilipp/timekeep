import { lingui } from "@lingui/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import sassDts from "vite-plugin-sass-dts";
import svgr from "vite-plugin-svgr";
import postcssRtl from "postcss-rtlcss";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  return {
    plugins: [
      react({ plugins: [["@lingui/swc-plugin", {}]] }),
      lingui(),
      svgr(),
      sassDts({ enabledMode: ["development"] }),
      checker({ typescript: true, overlay: false }),
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
      outDir: "dist", sourcemap: isDev,
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
          globals: true, environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          css: { modules: { classNameStrategy: "non-scoped" } },
          exclude: ["e2e/**", "node_modules/**", "dist/**"],
        },
  };
});
