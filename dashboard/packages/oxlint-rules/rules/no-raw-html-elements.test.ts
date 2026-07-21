/**
 * Tests for the no-raw-html-elements rule.
 *
 * This rule should catch:
 * 1. Raw HTML elements (<div>, <span>, <p>, etc.) in module files
 * 2. Tier 1 atom imports in pages (Banner, Button, Text, etc.)
 * 3. Tier 1 atom imports in module components (warnings)
 * 4. 🆕 Raw elements in hooks' JSX (render callbacks in useMemo)
 */

import { describe, it, expect } from "vitest";
import { rule } from "./no-raw-html-elements";
import {
  createMockContext,
  jsxElement,
  importDeclaration,
} from "../test-utils";

function runRule(filename: string, options: unknown[] = []) {
  const ctx = createMockContext(filename, options);
  const visitor = rule.create(ctx as any);
  return { ctx, visitor };
}

// ═══════════════════════════════════════════════════════════════════════════
// Raw HTML elements in module files
// ═══════════════════════════════════════════════════════════════════════════

describe("no-raw-html-elements — raw elements in modules", () => {
  it("flags raw <div> in module component", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("div", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("rawElementInModule");
    expect((ctx.reports[0].data as any).element).toBe("div");
  });

  it("flags raw <span> in module component", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("span", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("rawElementInModule");
    expect((ctx.reports[0].data as any).element).toBe("span");
  });

  it("flags raw <p> in module component", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("p", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("rawElementInModule");
  });

  it("🔴 BUG: flags raw <span> in module hooks (render callback JSX)", () => {
    // This is the bug from use-employee-list-page.tsx:
    // <span data-slot="enrollment-badge" className="status-badge status-badge--warning">
    const { ctx, visitor } = runRule("src/modules/employees/hooks/use-employee-list-page.tsx");
    const el = jsxElement("span", []);
    visitor.JSXElement?.(el);
    // The file matches isModuleFile → inModule is true
    // Currently: the JSXElement handler may not fire for hooks
    // Expected: 1 report
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("rawElementInModule");
  });

  it("flags raw <div> in module pages", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const el = jsxElement("div", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("rawElementInPage");
  });

  it("allows <section> (semantic HTML layout element)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("section", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows <nav> (semantic HTML layout element)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("nav", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows uppercase components (JSX components)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const el = jsxElement("EmployeeList", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });

  it("skips files in components/ui/", () => {
    const { ctx, visitor } = runRule("src/components/ui/button/button.tsx");
    const el = jsxElement("div", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });

  it("skips files in modules/shared/components/ (Tier 3 composites)", () => {
    const { ctx, visitor } = runRule("src/modules/shared/components/foo.tsx");
    const el = jsxElement("div", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });

  it("skips files in components/layout/ (Tier 4)", () => {
    const { ctx, visitor } = runRule("src/components/layout/page-shell.tsx");
    const el = jsxElement("div", []);
    visitor.JSXElement?.(el);
    expect(ctx.reports).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tier 1 atom imports in pages
// ═══════════════════════════════════════════════════════════════════════════

describe("no-raw-html-elements — tiered imports in pages", () => {
  it("flags Tier 1 atom import (Button) in page", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Button" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("atomImport");
  });

  it("flags Tier 1 atom import (Banner) in page", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Banner" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("atomImport");
  });

  it("allows Section import in page (whitelisted Tier 1 molecule)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Section" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows Grid import in page (whitelisted Tier 1 molecule)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Grid" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows EmptyState import in page (whitelisted)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "EmptyState" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows Spinner import in page (whitelisted)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Spinner" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });

  it("allows Tier 2 widget (DataTable) in page", () => {
    const { ctx, visitor } = runRule("src/modules/employees/pages/employee-list-page.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "DataTable" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tier 1 atom imports in module components (warnings)
// ═══════════════════════════════════════════════════════════════════════════

describe("no-raw-html-elements — tier warnings in module components", () => {
  it("warns about Tier 1 atom import (Button) in module component", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Button" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("tier1AtomInModuleComponent");
  });

  it("warns about Tier 1 atom import (Badge) in module component", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "Badge" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].messageId).toBe("tier1AtomInModuleComponent");
  });

  it("allows Tier 2 widget in module component (no warning)", () => {
    const { ctx, visitor } = runRule("src/modules/employees/components/foo.tsx");
    const node = importDeclaration("@/components/ui", [
      { imported: "FilterBar" },
    ]);
    visitor.ImportDeclaration?.(node);
    expect(ctx.reports).toHaveLength(0);
  });
});
