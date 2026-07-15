import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "jotai-no-raw-atom";

/**
 * Prevents direct usage of atom() and atomWithStorage() outside of:
 * 1. The Jotai factory layer (src/infrastructure/state/jotai/utils/)
 * 2. Test files (*.test.ts, *.test.tsx, __tests__/)
 *
 * Developers MUST use createState(), createSelector(), or createFamilyState()
 * from @/infrastructure/state/jotai instead of raw Jotai primitives.
 *
 * Exception: Write-only action atoms (e.g., logoutAtom, toggleThemeAtom)
 * are allowed in states/ directories because they compose other State objects.
 */

const isFactoryFile = (filepath: string): boolean =>
  filepath.includes("/state/jotai/utils/");

const isTestFile = (filepath: string): boolean =>
  /\.(test|spec)\.tsx?$/.test(filepath) ||
  filepath.includes("/__tests__/") ||
  filepath.includes("/testing/");

const isStatesDirectory = (filepath: string): boolean =>
  filepath.includes("/states/");

const isAllowedAtomFile = (filepath: string): boolean =>
  isStatesDirectory(filepath) ||
  filepath.includes("/infrastructure/state/atoms/");

const RAW_ATOM_IMPORTS = new Set(["atom", "atomWithStorage"]);

const isRawAtomImport = (importName: string): boolean =>
  RAW_ATOM_IMPORTS.has(importName);

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent direct usage of atom() / atomWithStorage(). Use createState(), createSelector(), or createFamilyState() instead.",
    },
    messages: {
      rawAtomImport:
        "Direct import of '{{ importName }}' from jotai is not allowed. " +
        "Use createState(), createSelector(), or createFamilyState() " +
        "from @/infrastructure/state/jotai instead.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (isFactoryFile(filename) || isTestFile(filename)) return {};

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (source !== "jotai" && source !== "jotai/utils") return;

        for (const spec of node.specifiers ?? []) {
          const importName =
            spec.imported?.name ?? spec.local?.name ?? "";

          if (!isRawAtomImport(importName)) continue;

          if (importName === "atom" && isAllowedAtomFile(filename)) continue;

          context.report({
            node,
            messageId: "rawAtomImport",
            data: { importName },
          });
        }
      },
    };
  },
});
