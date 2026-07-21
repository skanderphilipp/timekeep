/**
 * Tests for the enforce-scss-modules rule.
 *
 * This rule should catch:
 * 1. Raw CSS/SCSS imports (non-module)
 * 2. Tailwind-style className strings
 * 3. Inline style={{ }} objects with hardcoded values
 * 4. 🆕 ANY raw string className (not just Tailwind) — BEM-style, semantic class names
 */

import { describe, it, expect } from "vitest";
import { rule } from "./enforce-scss-modules";
import {
  createMockContext,
  jsxStringLiteralAttribute,
  jsxExprContainerAttribute,
  styleObjectExpression,
  stringLiteral,
  importDeclaration,
  templateLiteral,
  memberExpression,
  callExpression,
} from "../test-utils";

// ── Helper: get visitor and invoke a specific handler ────────────────────

function runRule(filename: string, options: unknown[] = []) {
  const ctx = createMockContext(filename, options);
  const visitor = rule.create(ctx as any);
  return { ctx, visitor };
}

// ═══════════════════════════════════════════════════════════════════════════
// Check 1: Forbidden CSS imports
// ═══════════════════════════════════════════════════════════════════════════

describe("enforce-scss-modules — CSS imports", () => {
  it("allows .module.scss imports", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("./foo.module.scss", []);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });

  it("flags raw .scss imports (non-module)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("./foo.scss", []);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noCssImport");
  });

  it("flags raw .css imports", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("./foo.css", []);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noCssImport");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Check 2: Tailwind-style className strings (existing behavior)
// ═══════════════════════════════════════════════════════════════════════════

describe("enforce-scss-modules — Tailwind classNames", () => {
  it("flags direct Tailwind-style className string", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxStringLiteralAttribute("className", "flex gap-2 items-center");
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it("flags className={'flex gap-2'} expression", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxExprContainerAttribute("className", stringLiteral("flex gap-2"));
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it("allows className={styles.container} (SCSS Modules)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxExprContainerAttribute("className", memberExpression("styles", "container"));
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows className={clsx(styles.foo, styles.bar)}", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxExprContainerAttribute(
      "className",
      callExpression("clsx", [memberExpression("styles", "foo"), memberExpression("styles", "bar")]),
    );
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 Check 3: BEM-style / semantic classNames (CURRENTLY NOT CAUGHT)
// ═══════════════════════════════════════════════════════════════════════════

describe("enforce-scss-modules — BEM / semantic classNames", () => {
  it('🔴 BUG: flags raw className="status-empty" (BEM pattern)', () => {
    // This is the bug from employee-enrollment-list.tsx
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxStringLiteralAttribute("className", "status-empty");
    visitor.JSXAttribute?.(attr);
    // Currently: 0 reports (NOT caught)
    // Expected: 1 report with noTailwindClass
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it('🔴 BUG: flags raw className="status-badge status-badge--warning" (BEM pattern)', () => {
    // This is the bug from use-employee-list-page.tsx
    const { ctx, visitor } = runRule("src/modules/employees/hooks/use-employee-list-page.tsx");
    const attr = jsxExprContainerAttribute(
      "className",
      stringLiteral("status-badge status-badge--warning"),
    );
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it('flags raw className="enrollment-list" (semantic class)', () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxStringLiteralAttribute("className", "enrollment-list");
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it('flags raw className="enrollment-item" (semantic class)', () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxStringLiteralAttribute("className", "enrollment-item");
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });

  it("flags single non-utility className like 'active'", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const attr = jsxStringLiteralAttribute("className", "active");
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noRawClassName");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Check 4: Inline style objects
// ═══════════════════════════════════════════════════════════════════════════

describe("enforce-scss-modules — inline style objects", () => {
  // The rule uses "JSXAttribute[name.name='style']" selector syntax.
  // We invoke it via the visitor object key directly.
  it("flags inline style with all hardcoded literal values", () => {
    const { ctx, visitor } = runRule("src/modules/attendance/components/day-detail-panel.tsx");
    const styleObj = styleObjectExpression([
      { key: "display", value: stringLiteral("flex") },
      { key: "alignItems", value: stringLiteral("baseline") },
      { key: "gap", value: stringLiteral("var(--ao-spacing-2)") },
      { key: "marginBottom", value: stringLiteral("var(--ao-spacing-1)") },
    ]);

    // Build the full JSXAttribute: style={...}
    const attr = {
      type: "JSXAttribute",
      name: { type: "JSXIdentifier", name: "style" },
      value: {
        type: "JSXExpressionContainer",
        expression: styleObj,
      },
    };

    // Invoke via the selector key (how oxlint dispatches internally)
    const styleHandler = visitor["JSXAttribute[name.name='style']"];
    if (styleHandler) {
      styleHandler(attr);
    }
    // Also check generic JSXAttribute handler (which wouldn't catch style violations)
    visitor.JSXAttribute?.(attr);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("noInlineStyle");
  });

  it("allows inline style with dynamic values (identifier)", () => {
    const { ctx, visitor } = runRule("src/modules/attendance/components/day-detail-panel.tsx");
    const styleObj = styleObjectExpression([
      { key: "width", value: { type: "Identifier", name: "panelWidth" } },
    ]);
    const attr = {
      type: "JSXAttribute",
      name: { type: "JSXIdentifier", name: "style" },
      value: { type: "JSXExpressionContainer", expression: styleObj },
    };
    const styleHandler = visitor["JSXAttribute[name.name='style']"];
    if (styleHandler) styleHandler(attr);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows inline style with conditional expressions", () => {
    const { ctx, visitor } = runRule("src/modules/attendance/components/day-detail-panel.tsx");
    // style={{ opacity: active ? 1 : 0 }}
    const styleObj = styleObjectExpression([
      {
        key: "opacity",
        value: {
          type: "ConditionalExpression",
          test: { type: "Identifier", name: "active" },
          consequent: { type: "Literal", value: 1 },
          alternate: { type: "Literal", value: 0 },
        },
      },
    ]);
    const attrStyle = {
      type: "JSXAttribute",
      name: { type: "JSXIdentifier", name: "style" },
      value: { type: "JSXExpressionContainer", expression: styleObj },
    };
    const sh = visitor["JSXAttribute[name.name='style']"];
    if (sh) sh(attrStyle);
    expect(ctx.reports).toHaveLength(0);
  });
});
