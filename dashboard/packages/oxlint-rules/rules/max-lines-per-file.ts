import { defineRule } from "@oxlint/plugins";
import * as fs from "node:fs";

export const RULE_NAME = "max-lines-per-file";

/**
 * Enforces file size limits to keep components focused and pages thin.
 *
 * Limits (from project AGENTS.md):
 *   - TSX files: 250 lines
 *   - Page files: 80 lines
 *   - SCSS files: 150 lines
 *   - Hook files: 150 lines
 *   - Utility files: 200 lines
 *
 * Pages must be thin composites — if a page exceeds 80 lines,
 * it's doing too much and logic should be extracted into hooks
 * and sub-components.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_LINES_TSX = 250;
const MAX_LINES_PAGE = 80;
const MAX_LINES_SCSS = 150;
const MAX_LINES_HOOK = 150;
const MAX_LINES_UTIL = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isPageFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/pages\/[^/]+\.tsx$/.test(filename);

const isHookFile = (filename: string): boolean =>
  /use-[a-z].*\.tsx?$/.test(filename);

const isScssFile = (filename: string): boolean =>
  /\.(scss|css)$/.test(filename) && !/\.d\./.test(filename);

const isTsxFile = (filename: string): boolean =>
  /\.tsx$/.test(filename);

const countLines = (filepath: string): number => {
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
};

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce file size limits: TSX ≤250, pages ≤80, SCSS ≤150, hooks ≤150, utils ≤200 lines.",
    },
    messages: {
      tsxTooLong:
        "TSX file is {{ lines }} lines (max {{ max }}). Split into smaller components or extract logic into hooks.",
      pageTooLong:
        "Page is {{ lines }} lines (max {{ max }}). Pages must be thin composites — extract logic into hooks and sub-components.",
      scssTooLong:
        "SCSS file is {{ lines }} lines (max {{ max }}). Split into partials or extract shared mixins.",
      hookTooLong:
        "Hook is {{ lines }} lines (max {{ max }}). Split into smaller focused hooks.",
      utilTooLong:
        "Utility file is {{ lines }} lines (max {{ max }}). Split into focused modules.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    // Skip test/story files
    if (isTestOrStory(filename)) return {};

    return {
      Program: (node: any) => {
        const lines = countLines(filename);
        if (lines === 0) return;

        if (isPageFile(filename)) {
          if (lines > MAX_LINES_PAGE) {
            context.report({
              node,
              messageId: "pageTooLong",
              data: { lines, max: MAX_LINES_PAGE },
            });
          }
          return;
        }

        if (isScssFile(filename)) {
          if (lines > MAX_LINES_SCSS) {
            context.report({
              node,
              messageId: "scssTooLong",
              data: { lines, max: MAX_LINES_SCSS },
            });
          }
          return;
        }

        if (isHookFile(filename)) {
          if (lines > MAX_LINES_HOOK) {
            context.report({
              node,
              messageId: "hookTooLong",
              data: { lines, max: MAX_LINES_HOOK },
            });
          }
          return;
        }

        if (isTsxFile(filename)) {
          if (lines > MAX_LINES_TSX) {
            context.report({
              node,
              messageId: "tsxTooLong",
              data: { lines, max: MAX_LINES_TSX },
            });
          }
        } else {
          // Non-TSX util/config files
          if (lines > MAX_LINES_UTIL) {
            context.report({
              node,
              messageId: "utilTooLong",
              data: { lines, max: MAX_LINES_UTIL },
            });
          }
        }
      },
    };
  },
});
