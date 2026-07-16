import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "require-data-slot";

/**
 * Requires `data-slot` on the root JSX element returned by components.
 *
 * This is a **DX convention** (not a functional requirement):
 * - Makes component boundaries visible in DevTools
 * - Provides stable selectors for e2e tests
 * - No accessibility, SEO, or runtime impact
 *
 * Only checks the outermost JSX element of each return statement —
 * child elements with CSS Module classes already have scoped identifiers.
 */

const STYLED_ELEMENTS = new Set([
  "div", "span", "p",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "section", "article", "header", "footer", "nav", "main", "aside",
  "button", "a",
  "li", "ul", "ol", "dl", "dt", "dd",
  "table", "thead", "tbody", "tr", "td", "th",
  "label", "form", "fieldset", "input", "textarea", "select",
]);

const hasDataSlot = (attributes: any[]): boolean =>
  attributes.some(
    (attr) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === "data-slot",
  );

const hasClassName = (attributes: any[]): boolean =>
  attributes.some(
    (attr) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === "className",
  );

const hasStyle = (attributes: any[]): boolean =>
  attributes.some(
    (attr) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === "style",
  );

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

/**
 * Collect root JSX elements from a return statement's argument.
 */
const collectRootElements = (node: any, out: any[]): void => {
  if (!node) return;

  if (node.type === "JSXElement") {
    out.push(node);
    return;
  }

  if (node.type === "JSXFragment") {
    for (const child of node.children || []) {
      if (child.type === "JSXElement") out.push(child);
      else if (child.type === "JSXExpressionContainer") {
        collectRootElements(child.expression, out);
      }
    }
    return;
  }

  if (node.type === "ConditionalExpression") {
    collectRootElements(node.consequent, out);
    collectRootElements(node.alternate, out);
    return;
  }

  if (node.type === "LogicalExpression") {
    collectRootElements(node.right, out);
    return;
  }
};

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require data-slot attribute on component root elements for DevTools identification and e2e test stability.",
    },
    messages: {
      missingDataSlot:
        'Component root element is missing data-slot attribute. Add data-slot="element-name".',
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (isTestOrStory(filename)) return {};

    return {
      ReturnStatement: (node: any) => {
        const arg = node.argument;
        if (!arg) return;

        const roots: any[] = [];
        collectRootElements(arg, roots);

        for (const root of roots) {
          const openingEl = root.openingElement;
          if (!openingEl) continue;

          const tagName =
            openingEl.name?.type === "JSXIdentifier" ? openingEl.name.name : null;
          if (!tagName || !STYLED_ELEMENTS.has(tagName)) continue;

          const attrs = openingEl.attributes || [];
          if ((hasClassName(attrs) || hasStyle(attrs)) && !hasDataSlot(attrs)) {
            context.report({
              node: openingEl,
              messageId: "missingDataSlot",
            });
          }
        }
      },
    };
  },
});
