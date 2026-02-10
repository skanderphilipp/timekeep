import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["./oxlint-plugin.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "./dist/oxlint-plugin.mjs",
  external: ["@oxlint/plugins"],
});

console.log("✅ Built @bentech/oxlint-rules → dist/oxlint-plugin.mjs");
