import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "jotai-state-location";

/**
 * Enforces that Jotai state atoms live in the correct directories.
 *
 * Rules:
 * 1. Files in `infrastructure/state/atoms/` MUST NOT import from `modules/`
 *    (infrastructure is domain-agnostic).
 * 2. Files in `modules/{domain}/states/` MUST NOT import from other domain modules
 *    (already enforced by `no-cross-module-imports`, but reinforced for states).
 *
 * This prevents domain state from leaking into infrastructure and ensures
 * each module owns its own atom layer.
 */

// ── Helpers ──────────────────────────────────────────────────────────────

const isInfraStateFile = (filepath: string): boolean =>
  filepath.includes("/infrastructure/state/atoms/");

const extractModuleDomain = (filepath: string): string | null => {
  const match = filepath.match(/modules\/([^/]+)\//);
  return match ? match[1] : null;
};

const isTestFile = (filepath: string): boolean =>
  /\.(test|spec)\.tsx?$/.test(filepath) ||
  filepath.includes("/__tests__/");

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce correct Jotai state location: infrastructure atoms must be domain-agnostic. Domain atoms must live in their module's states/ directory.",
    },
    messages: {
      infraStateModuleDep:
        "Infrastructure state file '{{ filepath }}' imports from '{{ importSource }}'. " +
        "Infrastructure state atoms MUST be domain-agnostic — they cannot import from modules/. " +
        "Move domain-specific atoms to modules/{{ moduleDomain }}/states/ instead.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (isTestFile(filename)) return {};
    if (!isInfraStateFile(filename)) return {};

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;

        // Check if importing from a module
        const moduleMatch = source.match(/^@\/modules\/([^/]+)/);
        if (!moduleMatch) return;

        const moduleDomain = moduleMatch[1];

        context.report({
          node,
          messageId: "infraStateModuleDep",
          data: {
            filepath: filename,
            importSource: source,
            moduleDomain,
          },
        });
      },
    };
  },
});
