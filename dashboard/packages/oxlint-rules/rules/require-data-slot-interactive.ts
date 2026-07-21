import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "require-data-slot-interactive";

/**
 * Requires `data-slot` on interactive child elements in module files.
 *
 * Companion to `require-data-slot` (error, root elements). This rule checks
 * interactive children — custom components or native HTML elements with event
 * handlers — that are likely targeted in E2E tests.
 *
 * Only fires in module files (`modules/`). Design system files, infrastructure,
 * devtools, and test/story files are excluded.
 *
 * Minimal exemptions — only structural patterns that are never interactive:
 * - Icon sub-components (names starting with "Icon")
 * - Provider/context wrappers (names ending with "Provider")
 * - React built-ins (Fragment, Suspense)
 * - React Router navigation primitives (Link, NavLink, Navigate, Outlet)
 *
 * UI primitives (Button, Input, etc.) are NOT exempt — if they appear in the
 * report, it signals that the call site or the primitive itself needs attention.
 * Often the root cause is a `no-raw-html-elements` violation — raw HTML should
 * be replaced with UI primitives that self-apply data-slot.
 */

// ── Interactive elements ─────────────────────────────────────────────────────

const NATIVE_INTERACTIVE = new Set([
  "button", "input", "select", "textarea", "a",
]);

const EVENT_HANDLER_PROPS = new Set([
  "onClick", "onChange", "onSubmit", "onKeyDown", "onKeyUp",
  "onFocus", "onBlur", "onMouseDown", "onMouseUp", "onMouseEnter", "onMouseLeave",
  "onPointerDown", "onPointerUp", "onInput", "onSelect",
]);

const hasAttr = (attributes: any[], name: string): boolean =>
  attributes.some(
    (attr) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === name,
  );

const hasDataSlot = (attributes: any[]): boolean => hasAttr(attributes, "data-slot");
const hasDataSlotProp = (attributes: any[]): boolean => hasAttr(attributes, "dataSlot");

const hasEventHandler = (attributes: any[]): boolean =>
  attributes.some(
    (attr) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      EVENT_HANDLER_PROPS.has(attr.name.name),
  );

// ── Minimal exemptions ────────────────────────────────────────────────────────

/** Only structural patterns that are never interactive targets. */
const STRUCTURAL_EXEMPTIONS = new Set([
  // React built-ins
  "Fragment", "Suspense",
  // React Router
  "Link", "NavLink", "Navigate", "Outlet",
]);

const isExempt = (tagName: string): boolean => {
  if (STRUCTURAL_EXEMPTIONS.has(tagName)) return true;
  // Icon sub-components: IconSearch, IconChevronLeft, etc.
  if (tagName.startsWith("Icon")) return true;
  // Provider wrappers: QueryClientProvider, ThemeProvider, etc.
  if (tagName.endsWith("Provider")) return true;
  return false;
};

// ── File filters ─────────────────────────────────────────────────────────────

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isModuleFile = (filename: string): boolean =>
  /\/modules\//.test(filename);

// ── Helpers ──────────────────────────────────────────────────────────────────

const getTagName = (openingEl: any): string | null => {
  if (!openingEl?.name) return null;
  if (openingEl.name.type === "JSXIdentifier") return openingEl.name.name;
  if (openingEl.name.type === "JSXMemberExpression") {
    return openingEl.name.property?.name ?? null;
  }
  return null;
};

const isCustomComponent = (tagName: string): boolean => {
  const first = tagName[0];
  return first === first.toUpperCase() && first !== first.toLowerCase();
};

// ── Rule ─────────────────────────────────────────────────────────────────────

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require data-slot on interactive child elements in module files for E2E test stability. Cross-reference with no-raw-html-elements — raw HTML should be replaced with UI primitives.",
    },
    messages: {
      missingDataSlotInteractive:
        'Interactive element "{{name}}" is missing data-slot. If this is a raw HTML element, replace it with a UI primitive. Otherwise add data-slot="{{name}}-element".',
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (isTestOrStory(filename)) return {};
    if (!isModuleFile(filename)) return {};

    return {
      JSXElement: (node: any) => {
        const openingEl = node.openingElement;
        if (!openingEl) return;

        const tagName = getTagName(openingEl);
        if (!tagName) return;

        const attrs = openingEl.attributes || [];
        if (hasDataSlot(attrs) || hasDataSlotProp(attrs)) return;

        const isCustom = isCustomComponent(tagName);
        const isNativeInteractive = NATIVE_INTERACTIVE.has(tagName);
        const isInteractive = hasEventHandler(attrs);

        // Custom component with event handlers
        if (isCustom && !isExempt(tagName) && isInteractive) {
          context.report({
            node: openingEl,
            messageId: "missingDataSlotInteractive",
            data: { name: tagName },
          });
        }

        // Native interactive element with event handlers — likely a
        // no-raw-html-elements violation that should be fixed first.
        if (isNativeInteractive && isInteractive) {
          context.report({
            node: openingEl,
            messageId: "missingDataSlotInteractive",
            data: { name: tagName },
          });
        }
      },
    };
  },
});
