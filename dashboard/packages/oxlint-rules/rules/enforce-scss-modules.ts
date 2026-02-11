import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'enforce-scss-modules';

/**
 * Enforces SCSS Modules as the sole styling approach:
 *
 * 1. No raw CSS imports in .tsx files (non-module .css/.scss)
 * 2. No Tailwind/utility className strings
 * 3. No inline style={{ }} objects for structural styling
 * 4. data-slot attribute on every styled component root
 *
 * Exemptions:
 * - .module.scss and .module.css imports are allowed
 * - className that resolves to a CSS Modules styles import (Identifier/MemberExpression)
 * - style={{ }} using CSS custom properties for dynamic values
 * - className usage in .module.scss files themselves
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Utility class prefixes that signal Tailwind/windicss-style class strings. */
const UTILITY_PATTERNS = [
  /^(?:flex|grid|block|inline|hidden|relative|absolute|fixed|sticky)$/,
  /^(?:inset|top|right|bottom|left|z)-\d+$/,
  /^(?:m[trblxy]?|p[trblxy]?|gap[xy]?|space[xy]?)-\d/,
  /^(?:w|h|min-w|min-h|max-w|max-h)-(?:full|screen|dvh|svh|\d)/,
  /^(?:text|bg|border|ring|outline|shadow|fill|stroke)-\w/,
  /^(?:rounded|data-|sm:|md:|lg:|xl:|2xl:|focus:|hover:|active:|disabled:)/,
  /^(?:overflow|truncate|whitespace|break|align|justify|items|content|self)/,
  /^(?:animate|transition|duration|ease|delay|transform|scale|rotate|translate)/,
];

/** HTML elements that should carry data-slot when styled. */
const STYLED_ELEMENTS = new Set([
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'main',
  'aside',
  'button',
  'a',
  'li',
  'ul',
  'ol',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'label',
  'form',
  'fieldset',
  'input',
  'textarea',
  'select',
]);

/**
 * Forbidden CSS imports — raw CSS/SCSS files that are NOT CSS Modules.
 * .module.scss and .module.css are ALLOWED.
 */
const FORBIDDEN_CSS_IMPORTS = /(?<!\.module)\.(css|scss)$/;

/** Allowed CSS Module import patterns. */
const ALLOWED_MODULE_IMPORTS = /\.module\.(css|scss)$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const looksLikeTailwind = (classString: string): boolean => {
  const tokens = classString.trim().split(/\s+/);
  // A single class or empty string isn't Tailwind
  if (
    tokens.length <= 1 &&
    !UTILITY_PATTERNS.some((p) => p.test(tokens[0] ?? ''))
  ) {
    return false;
  }
  // Check if multiple tokens look like utility classes
  const utilityCount = tokens.filter((t) =>
    UTILITY_PATTERNS.some((p) => p.test(t)),
  ).length;
  return utilityCount >= 2;
};

const _isStylesImport = (node: any): boolean => {
  // Identifier: `className={myStyle}`
  if (node.type === 'Identifier') return true;
  // MemberExpression: `className={styles.container}`
  if (node.type === 'MemberExpression') return true;
  // CallExpression: `className={clsx(styles.foo, styles.bar)}`
  if (node.type === 'CallExpression') return true;
  // LogicalExpression / ConditionalExpression for conditional styles
  if (
    node.type === 'LogicalExpression' ||
    node.type === 'ConditionalExpression'
  ) {
    return _isStylesImport(node.consequent) || _isStylesImport(node.alternate);
  }
  // Array of style imports: `className={[styles.base, styles.variant]}`
  if (node.type === 'ArrayExpression') {
    return node.elements.every((el: any) => !el || _isStylesImport(el));
  }
  // Template literal: could be `cn()` wrapper
  if (node.type === 'TemplateLiteral') {
    return false; // Template strings are suspect
  }
  return false;
};

const isCssModuleFile = (filename: string): boolean =>
  ALLOWED_MODULE_IMPORTS.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const hasDataSlot = (attributes: any[]): boolean => {
  return attributes.some(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name?.type === 'JSXIdentifier' &&
      attr.name.name === 'data-slot',
  );
};

const hasClassName = (attributes: any[]): boolean => {
  return attributes.some(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name?.type === 'JSXIdentifier' &&
      attr.name.name === 'className',
  );
};

const hasStyle = (attributes: any[]): boolean => {
  return attributes.some(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name?.type === 'JSXIdentifier' &&
      attr.name.name === 'style',
  );
};

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce SCSS Modules as the sole styling approach — no raw CSS imports, no Tailwind className strings, no inline style objects, data-slot on styled elements.',
    },
    messages: {
      noCssImport:
        'Do not import raw CSS/SCSS files in .tsx. Use SCSS Modules (.module.scss) files instead.',
      noTailwindClass:
        'Tailwind-style className string detected. Use SCSS Modules classes from a co-located .module.scss file.',
      noInlineStyle:
        'Avoid inline style={{ }} objects for structural styling. Use SCSS Modules classes, or CSS custom properties for truly dynamic values.',
      missingDataSlot:
        'Styled element is missing data-slot attribute. Add data-slot="element-name" to the root element.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          /** Skip checks in test/story files (default true). */
          skipTestFiles: { type: 'boolean' },
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

        if (
          FORBIDDEN_CSS_IMPORTS.test(source) &&
          !ALLOWED_MODULE_IMPORTS.test(source)
        ) {
          context.report({
            node,
            messageId: 'noCssImport',
          });
        }
      },

      // --- Check 2: className with Tailwind strings ---
      JSXAttribute: (node: any) => {
        if (node.name?.name !== 'className') return;
        if (!node.value) return;

        const value = node.value;

        // Expression container: className={...}
        if (value.type === 'JSXExpressionContainer') {
          const expr = value.expression;

          // String literal inside expression: className={"flex gap-2"}
          if (
            expr.type === 'Literal' &&
            typeof expr.value === 'string' &&
            looksLikeTailwind(expr.value)
          ) {
            context.report({
              node,
              messageId: 'noTailwindClass',
            });
            return;
          }

          // Template literal: className={`...`}
          if (
            expr.type === 'TemplateLiteral' &&
            expr.quasis.some((q: any) => looksLikeTailwind(q.value.raw))
          ) {
            context.report({
              node,
              messageId: 'noTailwindClass',
            });
            return;
          }

          // CallExpression like cn(...): check first string argument
          if (expr.type === 'CallExpression' && expr.arguments?.length > 0) {
            const firstArg = expr.arguments[0];
            if (
              firstArg.type === 'Literal' &&
              typeof firstArg.value === 'string' &&
              looksLikeTailwind(firstArg.value)
            ) {
              context.report({
                node,
                messageId: 'noTailwindClass',
              });
            }
          }
        }

        // Direct string literal: className="flex gap-2"
        if (
          value.type === 'Literal' &&
          typeof value.value === 'string' &&
          looksLikeTailwind(value.value)
        ) {
          context.report({
            node,
            messageId: 'noTailwindClass',
          });
        }
      },

      // --- Check 3: style={{ }} with only hardcoded literal values ---
      "JSXAttribute[name.name='style']": (node: any) => {
        if (!node.value || node.value.type !== 'JSXExpressionContainer') return;
        const expr = node.value.expression;

        // style={obj} where obj is an ObjectExpression
        if (expr.type === 'ObjectExpression') {
          // Exempt if any property value references a prop/state/expression:
          //   style={{ opacity: active ? 1 : 0 }}          ← ternary → exempt
          //   style={{ transition: \`opacity \${duration}ms\` }} ← template → exempt
          //   style={{ width: someVar }}                   ← identifier → exempt
          //   style={{ width: "1em", height: "1em" }}      ← all literals → FLAG
          const allHardcoded = expr.properties.every((prop: any) => {
            if (!prop.value) return true;
            if (prop.value.type === 'ConditionalExpression') return false;
            if (prop.value.type === 'Identifier') return false;
            if (
              prop.value.type === 'TemplateLiteral' &&
              prop.value.expressions?.length > 0
            )
              return false;
            if (prop.value.type === 'BinaryExpression') return false;
            if (prop.value.type === 'CallExpression') return false;
            return true;
          });

          if (allHardcoded) {
            context.report({
              node,
              messageId: 'noInlineStyle',
            });
          }
        }
      },

      // --- Check 4: data-slot on styled elements ---
      JSXElement: (node: any) => {
        const openingEl = node.openingElement;
        if (!openingEl) return;

        const tagName =
          openingEl.name?.type === 'JSXIdentifier' ? openingEl.name.name : null;
        if (!tagName || !STYLED_ELEMENTS.has(tagName)) return;

        const attrs = openingEl.attributes || [];

        // Only flag if element has className but no data-slot
        if (hasClassName(attrs) && !hasDataSlot(attrs)) {
          context.report({
            node: openingEl,
            messageId: 'missingDataSlot',
          });
        }

        // Also flag if element has style but no data-slot
        if (hasStyle(attrs) && !hasDataSlot(attrs)) {
          context.report({
            node: openingEl,
            messageId: 'missingDataSlot',
          });
        }
      },
    };
  },
});
