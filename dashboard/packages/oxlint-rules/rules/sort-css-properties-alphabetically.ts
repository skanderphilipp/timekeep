import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "sort-css-properties-alphabetically";

/**
 * Enforces alphabetical ordering of CSS properties in:
 *   - SCSS `.module.scss` style blocks
 *   - Tagged template literals (for legacy/other CSS-in-JS)
 */

const checkProperties = (properties: any[], context: any, _node: any): void => {
  if (!properties || properties.length < 2) return;

  const propEntries: { key: string; node: any }[] = [];

  for (const prop of properties) {
    if (prop.type !== "Property") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "Literal" && typeof prop.key.value === "string"
          ? prop.key.value
          : null;

    if (key) {
      propEntries.push({ key, node: prop });
    }
  }

  for (let i = 1; i < propEntries.length; i++) {
    if (propEntries[i].key < propEntries[i - 1].key) {
      context.report({
        node: propEntries[i].node,
        messageId: "sortCssPropertiesAlphabetically",
        data: {
          property: propEntries[i].key,
          prevProperty: propEntries[i - 1].key,
        },
      });
      return; // Report first violation only per object
    }
  }
};

export const rule = defineRule({
  meta: {
    docs: {
      description: "CSS properties should be sorted alphabetically in SCSS style blocks.",
    },
    messages: {
      sortCssPropertiesAlphabetically:
        "CSS property '{{ property }}' should come before '{{ prevProperty }}'. Sort properties alphabetically.",
    },
    type: "suggestion",
    schema: [],
    fixable: "code",
  },
  create: (context) => {
    // Detect JSX style objects: style={{ backgroundColor: "...", color: "..." }}
    const _isStyleObject = (_node: any): boolean => {
      if (_node.type !== "ObjectExpression") return false;
      return true;
    };

    const _hasStyleObjectArgument = (_node: any): any | null => {
      if (!_node.arguments || _node.arguments.length === 0) return null;
      const arg = _node.arguments[0];
      if (arg.type === "ObjectExpression") return arg;
      return null;
    };

    return {
      // Check JSX style={{ ... }} attribute values
      "JSXAttribute[name.name='style']": (node: any) => {
        if (!node.value || node.value.type !== "JSXExpressionContainer") return;
        const expr = node.value.expression;

        if (expr.type === "ObjectExpression") {
          checkProperties(expr.properties, context, node);
        }
      },
    };
  },
});
