import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-deep-ui-imports";

/**
 * Prevents deep imports from individual component directories.
 *
 * All imports from the UI library MUST go through the barrel file:
 *
 *   ✅ import { Button, Card } from "@/components/ui";
 *   ❌ import { Button } from "@/components/ui/button";
 *   ❌ import { Badge } from "@/components/ui/badge";
 *
 * Exemptions (these have their own barrel for a reason):
 *   - @/components/layout (separate Tier 4 barrel)
 *   - @/components/ui/chart (sub-barrel for chart types)
 *
 * Deep imports break the barrel contract and make refactoring brittle —
 * moving a component's file location breaks every deep import, while
 * barrel imports are unaffected.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Paths that match individual component directories under components/ui/. */
const DEEP_UI_IMPORT_PATTERN = /^@\/components\/ui\/(?!chart\/)[a-z][a-z0-9-]*\/?/;

/** Allowed sub-barrels — these are intentional. */
const ALLOWED_SUB_BARRELS = new Set([
  "@/components/ui/chart",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isUiComponentFile = (filename: string): boolean =>
  /(?:^|\/)components\/ui\//.test(filename);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent deep imports from individual UI component directories. All UI imports must go through the barrel file (@/components/ui).",
    },
    messages: {
      deepImport:
        'Deep import "{{ source }}" is forbidden. Import from the barrel instead: import { {{ name }} } from "@/components/ui".',
      deepImportChart:
        'Import chart sub-components from the chart barrel: import { {{ name }} } from "@/components/ui/chart".',
    },
    schema: [
      {
        type: "object",
        properties: {
          skipTestFiles: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create: (context) => {
    const options = (context.options as [{ skipTestFiles?: boolean }])?.[0];
    const skipTestFiles = options?.skipTestFiles ?? true;
    const filename = context.filename as string;

    // UI components themselves can use deep imports (within the library)
    if (isUiComponentFile(filename)) return {};
    if (skipTestFiles && isTestOrStory(filename)) return {};

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;

        // Check if it's a deep UI import
        if (!DEEP_UI_IMPORT_PATTERN.test(source)) return;
        if (ALLOWED_SUB_BARRELS.has(source)) return;

        // Get the first named import for the error message
        const firstName = node.specifiers?.[0]?.imported?.name
          || node.specifiers?.[0]?.local?.name
          || "Component";

        context.report({
          node,
          messageId: source.startsWith("@/components/ui/chart/") ? "deepImportChart" : "deepImport",
          data: { source, name: firstName },
        });
      },
    };
  },
});
