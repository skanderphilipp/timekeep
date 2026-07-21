import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "enforce-scss-modules";

/**
 * Enforces SCSS Modules as the sole styling approach:
 *
 * 1. No raw CSS imports in .tsx files (non-module .css/.scss)
 * 2. No raw className strings — ANY raw string is forbidden. Only SCSS Module
 *    references (styles.xxx, clsx(styles.x, ...)) are allowed.
 * 3. No inline style={{ }} objects for structural styling
 *
 * For data-slot enforcement (DevTools convention, not a styling concern),
 * see the separate `require-data-slot` rule.
 *
 * Exemptions:
 * - .module.scss and .module.css imports are allowed
 * - className that resolves to a CSS Modules styles import (Identifier/MemberExpression)
 * - style={{ }} using dynamic values (identifiers, conditionals, template literals with expressions)
 * - className usage in .module.scss files themselves
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALLOWED_MODULE_IMPORTS = /\.module\.(css|scss)$/;

/**
 * Forbidden CSS imports — raw CSS/SCSS files that are NOT CSS Modules.
 * .module.scss and .module.css are ALLOWED.
 */
const FORBIDDEN_CSS_IMPORTS = /(?<!\.module)\.(css|scss)$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a className expression references SCSS Module imports.
 *
 * Allowed patterns:
 *   className={styles.foo}           → MemberExpression
 *   className={clsx(styles.x, ...)}  → CallExpression
 *   className={variable}             → Identifier (we can't know, so allow)
 *   className={condition ? styles.a : styles.b} → ConditionalExpression
 *   className={[styles.base, cond && styles.alt]} → ArrayExpression
 *
 * Forbidden patterns (raw strings):
 *   className="foo"                  → Literal string
 *   className={"foo bar"}            → Literal string in expression
 *   className={`foo ${bar}`}         → Template literal
 */
const _isStylesImport = (node: any): boolean => {
  // Identifier: `className={someVar}` — allow (could be from props)
  if (node.type === "Identifier") return true;
  // MemberExpression: `className={styles.container}`
  if (node.type === "MemberExpression") return true;
  // CallExpression: `className={clsx(styles.foo, styles.bar)}`
  if (node.type === "CallExpression") return true;
  // LogicalExpression / ConditionalExpression for conditional styles
  if (node.type === "LogicalExpression" || node.type === "ConditionalExpression") {
    return _isStylesImport(node.consequent) || _isStylesImport(node.alternate);
  }
  // Array of style imports: `className={[styles.base, styles.variant]}`
  if (node.type === "ArrayExpression") {
    return node.elements.every((el: any) => !el || _isStylesImport(el));
  }
  // Template literal: `className={`${styles.foo} extra`}` → VIOLATION
  if (node.type === "TemplateLiteral") {
    return false;
  }
  // Literal string → VIOLATION
  if (node.type === "Literal") {
    return false;
  }
  return false;
};

const isCssModuleFile = (filename: string): boolean => ALLOWED_MODULE_IMPORTS.test(filename);

const isTestOrStory = (filename: string): boolean => /\.(test|spec|stories)\.tsx?$/.test(filename);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce SCSS Modules as the sole styling approach — no raw CSS imports, no raw className strings, no inline style objects.",
    },
    messages: {
      noCssImport:
        "Do not import raw CSS/SCSS files in .tsx. Use SCSS Modules (.module.scss) files instead.",
      noRawClassName:
        "Raw className string detected. Use SCSS Modules classes from a co-located .module.scss file (e.g. className={styles.myClass}).",
      noInlineStyle:
        "Avoid inline style={{ }} objects for structural styling. Use SCSS Modules classes, or CSS custom properties for truly dynamic values.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Skip checks in test/story files (default true). */
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

    // Skip .module.scss files themselves
    if (isCssModuleFile(filename)) return {};
    // Skip test/story files
    if (skipTestFiles && isTestOrStory(filename)) return {};

    return {
      // --- Check 1: Forbidden raw CSS/SCSS imports (allow .module.scss) ---
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;

        if (FORBIDDEN_CSS_IMPORTS.test(source) && !ALLOWED_MODULE_IMPORTS.test(source)) {
          context.report({
            node,
            messageId: "noCssImport",
          });
        }
      },

      // --- Check 2: className with ANY raw string (not just Tailwind) ---
      JSXAttribute: (node: any) => {
        if (node.name?.name !== "className") return;
        if (!node.value) return;

        const value = node.value;

        // Expression container: className={...}
        if (value.type === "JSXExpressionContainer") {
          const expr = value.expression;
          if (!expr) return;

          // If it resolves to a styles import → ALLOWED
          if (_isStylesImport(expr)) return;

          // String literal inside expression: className={"foo bar"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            context.report({ node, messageId: "noRawClassName" });
            return;
          }

          // Template literal: className={`foo ${bar}`}
          if (expr.type === "TemplateLiteral") {
            context.report({ node, messageId: "noRawClassName" });
            return;
          }

          // CallExpression: className={cn("raw-class", ...)}
          // Only report if it contains raw string arguments
          if (expr.type === "CallExpression" && expr.arguments?.length > 0) {
            const hasRawString = expr.arguments.some(
              (arg: any) =>
                (arg.type === "Literal" && typeof arg.value === "string") ||
                arg.type === "TemplateLiteral",
            );
            if (hasRawString) {
              context.report({ node, messageId: "noRawClassName" });
            }
          }
        }

        // Direct string literal: className="foo bar"
        if (
          value.type === "Literal" &&
          typeof value.value === "string"
        ) {
          context.report({ node, messageId: "noRawClassName" });
        }
      },

      // --- Check 3: style={{ }} with only hardcoded literal values ---
      "JSXAttribute[name.name='style']": (node: any) => {
        if (!node.value || node.value.type !== "JSXExpressionContainer") return;
        const expr = node.value.expression;

        // style={obj} where obj is an ObjectExpression
        if (expr.type === "ObjectExpression") {
          // Exempt if any property value references a prop/state/expression:
          //   style={{ opacity: active ? 1 : 0 }}          ← ternary → exempt
          //   style={{ transition: `opacity ${duration}ms` }} ← template → exempt
          //   style={{ width: someVar }}                   ← identifier → exempt
          //   style={{ width: "1em", height: "1em" }}      ← all literals → FLAG
          const allHardcoded = expr.properties.every((prop: any) => {
            if (!prop.value) return true;
            if (prop.value.type === "ConditionalExpression") return false;
            if (prop.value.type === "Identifier") return false;
            if (prop.value.type === "TemplateLiteral" && prop.value.expressions?.length > 0)
              return false;
            if (prop.value.type === "BinaryExpression") return false;
            if (prop.value.type === "CallExpression") return false;
            return true;
          });

          if (allHardcoded) {
            context.report({
              node,
              messageId: "noInlineStyle",
            });
          }
        }
      },

    };
  },
});
