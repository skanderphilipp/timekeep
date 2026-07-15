import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-cross-module-imports";

/**
 * Prevents spaghetti dependencies between domain modules.
 *
 * Modules under `modules/{domain}/` MUST NOT import from other
 * domain modules. They MAY import from:
 *   - modules/shared/ (cross-cutting composites)
 *   - components/ui/ (primitives + widgets)
 *   - components/layout/ (layout shell)
 *   - infrastructure/ (shared infrastructure)
 *   - lib/ (utilities, API client, constants)
 *   - hooks/ (shared hooks)
 *   - types/ (shared types)
 *
 * This keeps domain modules self-contained and prevents circular
 * or spaghetti dependencies as the app grows.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the domain name from a module path. Returns null for non-module files. */
const extractModuleDomain = (filepath: string): string | null => {
  const match = filepath.match(/modules\/([^/]+)\//);
  if (!match) return null;
  return match[1];
};

/** Allowed import sources — everything except other domain modules. */
const isCrossDomainImport = (importSource: string, sourceDomain: string): string | null => {
  // Only check imports from modules/
  const targetMatch = importSource.match(/^@\/modules\/([^/]+)/);
  if (!targetMatch) return null;

  const targetDomain = targetMatch[1];

  // shared is allowed (it's the cross-cutting composites module)
  if (targetDomain === "shared") return null;

  // Same domain is allowed (self-reference)
  if (targetDomain === sourceDomain) return null;

  // Different domain — violation!
  return targetDomain;
};

const isModuleFile = (filename: string): boolean =>
  /(?:^|\/)modules\//.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent domain modules from importing other domain modules. Only shared cross-cutting imports are allowed between modules.",
    },
    messages: {
      crossModuleImport:
        'Module "{{ sourceDomain }}" imports from "{{ targetDomain }}" — cross-module imports are forbidden. Extract shared logic into modules/shared/ or lib/ instead.',
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

    if (!isModuleFile(filename)) return {};
    if (skipTestFiles && isTestOrStory(filename)) return {};

    const sourceDomain = extractModuleDomain(filename);
    if (!sourceDomain) return {};

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;

        const targetDomain = isCrossDomainImport(source, sourceDomain);
        if (!targetDomain) return;

        context.report({
          node,
          messageId: "crossModuleImport",
          data: { sourceDomain, targetDomain },
        });
      },
    };
  },
});
