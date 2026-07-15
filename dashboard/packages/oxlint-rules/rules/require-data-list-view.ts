import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "require-data-list-view";

/**
 * Prevents domain modules from importing DataTable directly from the UI barrel.
 *
 * Module list pages MUST use DataListView from @/modules/data-renderer instead.
 * DataListView provides the standardized TopBar, DataBoundary, search, filter,
 * view-picker, and empty-state pipeline that every list page needs.
 *
 *   ✅ import { DataListView } from "@/modules/data-renderer";
 *   ❌ import { DataTable } from "@/components/ui";
 *
 * Legitimate exceptions (detail-view sub-tables, specialized views):
 * Add an inline disable comment with a justification:
 *
 *   // oxlint-disable-next-line bentech/require-data-list-view -- detail sub-table, not a list page
 *   import { DataTable } from "@/components/ui";
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Source path that matches the UI barrel import. */
const UI_BARREL = "@/components/ui";

/** DataTable is the forbidden symbol. */
const FORBIDDEN_IMPORT = "DataTable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isDataRendererFile = (filename: string): boolean =>
  /(?:^|\/)modules\/data-renderer\//.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isModuleFile = (filename: string): boolean =>
  /(?:^|\/)modules\//.test(filename);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Domain modules must use DataListView from @/modules/data-renderer for list pages, not the bare DataTable from @/components/ui.',
    },
    messages: {
      bareDataTable:
        '"{{ name }}" is imported from the UI barrel but this module should use DataListView from @/modules/data-renderer instead. DataListView provides the standardized TopBar, DataBoundary, search, filter, view-picker, and empty-state pipeline. If this is a legitimate exception (e.g., a detail-view sub-table), add a disable comment with justification: // oxlint-disable-next-line bentech/require-data-list-view -- reason',
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    // Only check domain modules (skip data-renderer itself, tests, stories)
    if (!isModuleFile(filename)) return {};
    if (isDataRendererFile(filename)) return {};
    if (isTestOrStory(filename)) return {};

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;

        // Only care about imports from the UI barrel
        if (source !== UI_BARREL) return;

        // Check each specifier for DataTable
        for (const spec of node.specifiers ?? []) {
          const importedName = spec.imported?.name ?? spec.local?.name;
          if (importedName === FORBIDDEN_IMPORT) {
            context.report({
              node: spec,
              messageId: "bareDataTable",
              data: { name: FORBIDDEN_IMPORT },
            });
          }
        }
      },
    };
  },
});
