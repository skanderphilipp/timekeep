import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "require-story-level-tag";

/**
 * Every Storybook story MUST include a level tag in its meta:
 *
 *   "level:primitive"  — Tier 1 atoms + molecules
 *   "level:widget"     — Tier 2 widgets
 *   "level:composite"  — Tier 3 cross-cutting composites
 *   "level:layout"     — Tier 4 app shell
 *   "level:page"       — Tier 5 domain pages
 *
 * This ensures Storybook's sidebar can group components by tier
 * and developers can immediately see what level a component belongs to.
 *
 * Exemptions:
 *   - Pages (modules/{domain}/pages/) use "level:page"
 *   - Non-component stories (hooks, utilities) are skipped
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_TAGS = new Set([
  "level:primitive",
  "level:widget",
  "level:composite",
  "level:layout",
  "level:page",
]);

const isStoryFile = (filename: string): boolean =>
  /\.stories\.tsx?$/.test(filename);

const isPageFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/pages\//.test(filename);

const isSharedComposite = (filename: string): boolean =>
  /(?:^|\/)modules\/shared\/components\//.test(filename);

const isUiComponent = (filename: string): boolean =>
  /(?:^|\/)components\/ui\//.test(filename);

const isLayoutComponent = (filename: string): boolean =>
  /(?:^|\/)components\/layout\//.test(filename);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require every Storybook story to include a level:* tag in its meta for tier-based sidebar grouping.",
    },
    messages: {
      missingLevelTag:
        "Story is missing a level tag. Add one of: level:primitive, level:widget, level:composite, level:layout, level:page to the meta tags array.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (!isStoryFile(filename)) return {};

    let hasLevelTag = false;

    return {
      // Detect `tags: ["level:primitive", ...]` in the meta object
      Property: (node: any) => {
        if (hasLevelTag) return;

        // Looking for `tags: [...]`
        if (
          node.key?.type === "Identifier" &&
          node.key.name === "tags" &&
          node.value?.type === "ArrayExpression"
        ) {
          for (const el of node.value.elements || []) {
            if (el?.type === "Literal" && typeof el.value === "string" && LEVEL_TAGS.has(el.value)) {
              hasLevelTag = true;
              return;
            }
          }
        }
      },

      "Program:exit": () => {
        if (!hasLevelTag) {
          context.report({
            node: (context as any).sourceCode?.ast ?? {},
            messageId: "missingLevelTag",
          });
        }
      },
    };
  },
});
