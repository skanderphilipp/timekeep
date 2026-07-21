/**
 * Minimal test harness for oxlint rules.
 *
 * Oxlint rules receive nodes from the oxlint parser (ESTree-compatible AST).
 * This harness provides factory functions for the AST node shapes our rules
 * inspect, plus a spy-based mock context.
 */

import type { Context } from "@oxlint/plugins";

// ── Mock Context ──────────────────────────────────────────────────────────

export interface RuleReport {
  node: unknown;
  messageId: string;
  data?: Record<string, unknown>;
}

export function createMockContext(
  filename: string,
  options: unknown[] = [],
): Context & { reports: RuleReport[] } {
  const reports: RuleReport[] = [];

  const context = {
    filename,
    options,
    report(params: { node: unknown; messageId: string; data?: Record<string, unknown> }) {
      reports.push({
        node: params.node,
        messageId: params.messageId,
        data: params.data,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getSourceCode() {
      return { text: "" };
    },
  } as unknown as Context & { reports: RuleReport[] };

  // Attach reports for assertion
  (context as any).reports = reports;

  return context as Context & { reports: RuleReport[] };
}

// ── AST Node Factories ────────────────────────────────────────────────────

/**
 * Minimal JSXAttribute: `<div className="foo bar">`
 */
export function jsxStringLiteralAttribute(
  name: string,
  value: string,
): Record<string, unknown> {
  return {
    type: "JSXAttribute",
    name: { type: "JSXIdentifier", name },
    value: {
      type: "Literal",
      value,
    },
  };
}

/**
 * JSXAttribute with expression container: `<div className={"foo bar"}>`
 */
export function jsxExprContainerAttribute(
  name: string,
  expression: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "JSXAttribute",
    name: { type: "JSXIdentifier", name },
    value: {
      type: "JSXExpressionContainer",
      expression,
    },
  };
}

/**
 * Minimal JSXElement: `<div ...>`
 */
export function jsxElement(
  tagName: string,
  attributes: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: /^[A-Z]/.test(tagName)
        ? { type: "JSXIdentifier", name: tagName }
        : { type: "JSXIdentifier", name: tagName },
      attributes,
    },
  };
}

/**
 * Import declaration: `import { X } from "source"`
 */
export function importDeclaration(
  source: string,
  specifiers: Array<{ imported: string; local?: string }>,
): Record<string, unknown> {
  return {
    type: "ImportDeclaration",
    source: { type: "Literal", value: source },
    specifiers: specifiers.map((s) => ({
      type: "ImportSpecifier",
      imported: { type: "Identifier", name: s.imported },
      local: { type: "Identifier", name: s.local ?? s.imported },
    })),
  };
}

/**
 * Style object expression: `style={{ display: "flex", gap: "var(--ao-spacing-2)" }}`
 */
export function styleObjectExpression(
  properties: Array<{ key: string; value: Record<string, unknown> }>,
): Record<string, unknown> {
  return {
    type: "ObjectExpression",
    properties: properties.map((p) => ({
      type: "ObjectProperty",
      key: { type: "Identifier", name: p.key },
      value: p.value,
    })),
  };
}

/**
 * String literal node
 */
export function stringLiteral(value: string): Record<string, unknown> {
  return { type: "Literal", value };
}

/**
 * Template literal node: `` `foo ${expr} bar` ``
 */
export function templateLiteral(
  quasis: string[],
  expressions: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return {
    type: "TemplateLiteral",
    quasis: quasis.map((q) => ({
      type: "TemplateElement",
      value: { raw: q, cooked: q },
    })),
    expressions,
  };
}

/**
 * MemberExpression: `styles.foo`
 */
export function memberExpression(
  object: string,
  property: string,
): Record<string, unknown> {
  return {
    type: "MemberExpression",
    object: { type: "Identifier", name: object },
    property: { type: "Identifier", name: property },
  };
}

/**
 * CallExpression: `clsx(styles.foo, "bar")`
 */
export function callExpression(
  callee: string,
  args: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    type: "CallExpression",
    callee: { type: "Identifier", name: callee },
    arguments: args,
  };
}

/**
 * ConditionalExpression: `cond ? a : b`
 */
export function conditionalExpression(
  test: Record<string, unknown>,
  consequent: Record<string, unknown>,
  alternate: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "ConditionalExpression",
    test,
    consequent,
    alternate,
  };
}

/**
 * Identifier: `width`
 */
export function identifier(name: string): Record<string, unknown> {
  return { type: "Identifier", name };
}
