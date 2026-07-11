// ── Design Token Drift Linter ────────────────────────────────────────────
// Guarantees zero drift between the token generator and everything in src/:
//
//   1. generated-tokens.css must match the output of tokens/build.ts exactly
//      (no stale generated file, no manual edits).
//   2. Every `--ao-*` reference in src/ (.scss/.ts/.tsx) must exist in the
//      generated token set — no phantom tokens that silently resolve to
//      nothing at runtime.
//   3. The `--ao-` namespace is reserved for generated tokens: defining an
//      `--ao-*` custom property anywhere in src/ is an error. Runtime vars
//      set from JS use `--tk-*`; component-local vars use no prefix.
//
// Run: pnpm lint:tokens   (part of `pnpm check`)

/* oxlint-disable no-console, bentech/no-bare-console -- CLI script; console is the output channel */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { generateThemeCSS } from "../src/styles/tokens/build.ts";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const GENERATED = join(SRC, "styles", "generated-tokens.css");

const errors: string[] = [];

// ── 1. Generated file in sync ─────────────────────────────────────────────

const expected = generateThemeCSS();
const actual = readFileSync(GENERATED, "utf8");
// Whitespace-insensitive comparison — formatters may reflow the generated file.
const normalize = (css: string) => css.replace(/\s+/g, " ").trim();
if (normalize(expected) !== normalize(actual)) {
  errors.push(
    `${relative(ROOT, GENERATED)} is out of sync with tokens/build.ts — run \`pnpm generate-tokens\``,
  );
}

// ── 2 & 3. Scan source files ──────────────────────────────────────────────

const definedTokens = new Set(
  [...expected.matchAll(/^\s*(--ao-[a-zA-Z0-9_-]+):/gm)].map((m) => m[1]),
);

const TOKEN_REF = /--ao-[a-zA-Z0-9_-]+/g;
// A definition is `--ao-x: value` in CSS, or setProperty("--ao-x", ...) in TS.
const CSS_DEFINITION = /^\s*(--ao-[a-zA-Z0-9_-]+)\s*:/;
const JS_DEFINITION = /setProperty\(\s*["'`](--ao-[a-zA-Z0-9_-]+)/;

// The generator itself builds token names from fragments — skip it.
const GENERATOR_DIR = join(SRC, "styles", "tokens");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(scss|ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.scss.ts"))
    .map((e) => join(e.parentPath, e.name))
    .filter((path) => !path.startsWith(GENERATOR_DIR));
}

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    const loc = `${rel}:${i + 1}`;

    // Explicit opt-out for scale-prefix strings that build names dynamically.
    if (line.includes("token-lint-ignore")) return;

    for (const match of line.matchAll(TOKEN_REF)) {
      const next = line.slice((match.index ?? 0) + match[0].length);
      // Skip dynamic constructions (`--ao-chart-${i}`) and prose wildcards (`--ao-*`).
      if (next.startsWith("${") || next.startsWith("*")) continue;
      if (!definedTokens.has(match[0])) {
        errors.push(`${loc} references unknown token \`${match[0]}\``);
      }
    }

    const definition = file.endsWith(".scss")
      ? CSS_DEFINITION.exec(line)
      : JS_DEFINITION.exec(line);
    if (definition) {
      errors.push(
        `${loc} defines \`${definition[1]}\` — the --ao- namespace is reserved for tokens/build.ts (use --tk-* for runtime vars)`,
      );
    }
  });
}

// ── Report ────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`✖ ${errors.length} token drift error(s):\n`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`✓ tokens in sync — ${definedTokens.size} tokens, zero drift`);
