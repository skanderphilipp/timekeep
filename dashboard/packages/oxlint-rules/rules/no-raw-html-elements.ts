import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-raw-html-elements";

/**
 * Enforces architectural layering: only components under `components/ui/` may
 * use raw HTML elements. Pages and module components must compose from UI
 * primitives or named sub-components.
 *
 * ── Tier System (see .notes/architecture/component-hierarchy.md) ──
 *
 *   Tier 1 — Primitives (atoms + simple molecules)
 *            ❌ NEVER import in pages
 *            ⚠️  Warn in module components (prefer composites)
 *   Tier 2 — Widgets (complex molecules)
 *            ✅ Allowed everywhere
 *   Tier 3 — Composites (@/modules/shared/components/)
 *            ✅ Allowed everywhere
 *   Tier 4 — Layout Shell (@/components/layout/)
 *            ✅ Allowed everywhere
 *
 * ── Page enforcement (modules/* /pages/) ──
 *   Pages may import from @/components/ui:
 *     Section, Grid — layout primitives
 *     EmptyState, Spinner, Skeleton — feedback states
 *   Everything else from @/components/ui is FORBIDDEN.
 *   (PageLayout, PageBody, PageBar, PageHeader come from @/components/layout)
 *
 * ── Module component enforcement (modules/* /components/) ──
 *   Module components may import Tier 2 widgets freely.
 *   Tier 1 atom imports (Button, Text, Badge, etc.) produce a WARNING —
 *   prefer composing through Tier 3 composites or module-specific wrappers.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Raw HTML elements that must never appear outside components/ui/. */
const FORBIDDEN_ELEMENTS: Record<string, string> = {
  // Structural
  div: "a UI layout primitive (Section, Card, Grid) from components/ui/",
  span: "Text component from components/ui/",
  // Typography
  h1: 'Heading level="h1" from components/ui/',
  h2: 'Heading level="h2" from components/ui/',
  h3: 'Heading level="h3" from components/ui/',
  h4: 'Heading level="h4" from components/ui/',
  h5: 'Heading level="h5" from components/ui/',
  h6: 'Heading level="h6" from components/ui/',
  p: 'Text variant="body" from components/ui/',
  hr: "Separator from components/ui/",
  // Form
  label: "FormField from components/ui/",
  button: "Button or IconButton from components/ui/",
  input: "Input or FilterInput from components/ui/",
  select: "Select from components/ui/",
  textarea: "TextArea from components/ui/",
};

/** Semantic HTML5 elements allowed as layout primitives everywhere. */
const ALLOWED_SEMANTIC_ELEMENTS = new Set([
  "section",
  "nav",
  "main",
  "article",
  "aside",
  "header",
  "footer",
]);

/**
 * Tier 1 — Primitives: atoms that MUST NOT be imported directly by pages.
 * These belong in components/ui/ and should only be composed through
 * Tier 3 composites or Tier 2 widgets.
 */
const TIER1_ATOMS = new Set([
  // Typography
  "Text",
  "Heading",
  // Data display
  "Badge",
  "Avatar",
  "StatusDot",
  "Dot",
  "Banner",
  "Separator",
  "MenuSeparator",
  // Form primitives
  "Input",
  "TextArea",
  "Checkbox",
  "Switch",
  // Actions
  "Button",
  "IconButton",
  // Feedback
  "Tooltip",
  "VisuallyHidden",
  "ProgressBar",
  "CircularProgressBar",
  "Spinner",
  "Skeleton",
  "SkeletonLines",
]);

/**
 * Tier 1 — Primitives: simple molecules. Pages should NOT import these
 * directly, but module components often need them for composition.
 */
const TIER1_MOLECULES = new Set([
  "ActionGroup",
  "AvatarGroup",
  "Breadcrumb",
  "ClickableListItem",
  "ConfirmDialog",
  "DetailGrid",
  "DetailItem",
  "EmptyState",
  "Grid",
  "InlineHeader",
  "Info",
  "LinkChip",
  "ListItem",
  "ListLoading",
  "MenuItem",
  "MetadataGrid",
  "OverflowingTextWithTooltip",
  "Section",
  "Tag",
  "Tabs",
  "Tab",
  "TabPanel",
  "ToggleGroup",
  "Toggle",
  "TintedIconTile",
]);

/**
 * ══════════════════════════════════════════════════════════════════════
 * TIER 2 — Widgets: pages, module components, and hooks MAY import these.
 * ══════════════════════════════════════════════════════════════════════
 *
 * These components are complex enough to stand on their own. They handle
 * their own state, loading, error, and empty conditions internally.
 */
const TIER2_WIDGETS = new Set([
  "AnimatedButton",
  "AnimatedPlaceholder",
  "Combobox",
  "DataTable",
  "TextCell",
  "TimestampCell",
  "DurationCell",
  "StatusCell",
  "DatePicker",
  "Dialog",
  "Dropdown",
  "useDropdownContext",
  "DropdownSearch",
  "ErrorBoundary",
  "FilterBar",
  "FilterChips",
  "FilterDateRange",
  "FilterDropdown",
  "Form",
  "FormField",
  "FormActions",
  "FormSection",
  "FormFieldInput",
  "FieldInputContainer",
  "SchemaForm",
  "InfiniteScrollSentinel",
  "MultiSelect",
  "Pagination",
  "SearchInput",
  "Select",
  "StatCard",
  "TableOptionsDropdown",
  // Charts
  "Chart",
  "BarChart",
  "LineChart",
  "PieChart",
  "CalendarChart",
  "RadarChart",
  "HeatmapChart",
  "StreamChart",
  "BumpChart",
  "ScatterPlotChart",
  "buildNivoTheme",
  "toSRGB",
  "useChartTheme",
  "chartTooltipStyle",
  // Specialized inputs
  "IpInput",
  "isValidIpv4",
  "PortInput",
  "clampPort",
  "IpPortInput",
  "parseIpPort",
  "ExpiryPicker",
]);

/**
 * Tier 4 — Layout shell (imported from @/components/layout, not @/components/ui).
 * These are always allowed everywhere.
 */
const LAYOUT_COMPONENTS = new Set([
  "PageLayout",
  "PageBody",
  "PageBar",
  "PageHeader",
]);

/**
 * For pages: ONLY these Tier 1 molecules are allowed from @/components/ui.
 * Everything else from Tier 1 is forbidden at the page level.
 */
const PAGE_ALLOWED_TIER1 = new Set([
  "Section",
  "Grid",
  "EmptyState",
  "Spinner",
  "Skeleton",
  "SkeletonLines",
  // PageBar action buttons — used for refresh, add, filter toggles
  "IconButton",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isUiComponentFile = (filename: string): boolean =>
  /(?:^|\/)components\/ui\//.test(filename);

/** Tier 3 composites — these ARE allowed to use Tier 1 primitives. */
const isSharedComposite = (filename: string): boolean =>
  /(?:^|\/)modules\/shared\/components\//.test(filename);

/** Tier 4 layout shell — these ARE allowed to use Tier 1 primitives. */
const isLayoutComponent = (filename: string): boolean =>
  /(?:^|\/)components\/layout\//.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isPageFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/pages\//.test(filename);

const isModuleComponentFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/components\//.test(filename);

const isModuleFile = (filename: string): boolean =>
  /(?:^|\/)modules\//.test(filename);

const resolveImportSource = (node: any): string | null => {
  const source = node.source?.value;
  if (typeof source === "string") return source;
  return null;
};

/**
 * Classify a named import from @/components/ui into its tier.
 * Returns null if the import is from a different barrel or unknown.
 */
const classifyImport = (name: string): "tier1-atom" | "tier1-molecule" | "tier2-widget" | "layout" | null => {
  if (TIER1_ATOMS.has(name)) return "tier1-atom";
  if (TIER1_MOLECULES.has(name)) return "tier1-molecule";
  if (TIER2_WIDGETS.has(name)) return "tier2-widget";
  if (LAYOUT_COMPONENTS.has(name)) return "layout";
  return null;
};

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforces component hierarchy: raw HTML elements forbidden outside components/ui/. Pages may only import Section/Grid/EmptyState/Spinner/Skeleton from @/components/ui. Module components may import Tier 2 widgets but get warnings for Tier 1 atom imports.",
    },
    messages: {
      rawElementInPage:
        "Raw <{{ element }}> in page. Replace with {{ replacement }}",
      rawElementInModule:
        "Raw <{{ element }}> in module component. Replace with {{ replacement }}. If no UI primitive exists, create one in components/ui/ first.",
      atomImport:
        'Tier 1 atom "{{ name }}" imported in page from @/components/ui. Pages must only import Section, Grid, EmptyState, Spinner, Skeleton. Extract this into a module component under modules/*/components/ and compose from the page.',
      moleculeImport:
        'Tier 1 molecule "{{ name }}" imported in page from @/components/ui. Pages must only import Section, Grid, EmptyState, Spinner, Skeleton. Extract this into a module component.',
      tier1AtomInModuleComponent:
        'Tier 1 atom "{{ name }}" imported in module component from @/components/ui. Prefer composing through Tier 3 composites (@/modules/shared/components/) or Tier 2 widgets instead of raw primitives.',
    },
    schema: [
      {
        type: "object",
        properties: {
          skipTestFiles: { type: "boolean" },
          warnTier1InModuleComponents: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create: (context) => {
    const options = (context.options as [{ skipTestFiles?: boolean; warnTier1InModuleComponents?: boolean }])?.[0];
    const skipTestFiles = options?.skipTestFiles ?? true;
    const warnTier1InModuleComponents = options?.warnTier1InModuleComponents ?? true;
    const filename = context.filename as string;

    // Skip the UI component library itself — that's where raw elements belong
    if (isUiComponentFile(filename)) return {};

    // Skip Tier 3 composites — they compose primitives by design
    if (isSharedComposite(filename)) return {};

    // Skip Tier 4 layout shell
    if (isLayoutComponent(filename)) return {};

    // Skip test/story files
    if (skipTestFiles && isTestOrStory(filename)) return {};

    // Only enforce in module files
    const inPage = isPageFile(filename);
    const inModuleComponent = isModuleComponentFile(filename);
    const inModule = isModuleFile(filename);

    if (!inPage && !inModule) return {};

    return {
      // --- Check 1: UI imports from @/components/ui ---
      ImportDeclaration: (node: any) => {
        const source = resolveImportSource(node);
        if (!source) return;

        // Only check @/components/ui imports
        if (source !== "@/components/ui") return;

        for (const spec of node.specifiers || []) {
          const name = spec.imported?.name || spec.imported?.value || spec.local?.name;
          if (!name) continue;

          const tier = classifyImport(name);
          if (!tier) continue; // Unknown — skip

          if (inPage) {
            // Pages: only allow Tier 2 widgets + specific Tier 1 primitives
            if (tier === "tier2-widget" || tier === "layout") continue;
            if (PAGE_ALLOWED_TIER1.has(name)) continue;

            context.report({
              node: spec,
              messageId: tier === "tier1-atom" ? "atomImport" : "moleculeImport",
              data: { name },
            });
          } else if (inModuleComponent && warnTier1InModuleComponents) {
            // Module components: warn about Tier 1 atom imports
            if (tier === "tier1-atom") {
              context.report({
                node: spec,
                messageId: "tier1AtomInModuleComponent",
                data: { name },
              });
            }
          }
        }
      },

      // --- Check 2: Raw HTML elements (all module files) ---
      JSXElement: (node: any) => {
        const openingEl = node.openingElement;
        if (!openingEl) return;

        const tagName = openingEl.name?.type === "JSXIdentifier" ? openingEl.name.name : null;

        if (!tagName) return;

        // Allow semantic HTML5 layout elements
        if (ALLOWED_SEMANTIC_ELEMENTS.has(tagName)) return;

        // Allow web components (custom elements with hyphens)
        if (tagName.includes("-")) return;

        // Allow JSX component names (uppercase)
        if (tagName[0] === tagName[0].toUpperCase()) return;

        // Check if it's a forbidden raw element
        if (!(tagName in FORBIDDEN_ELEMENTS)) return;

        context.report({
          node: openingEl,
          messageId: inPage ? "rawElementInPage" : "rawElementInModule",
          data: {
            element: tagName,
            replacement: FORBIDDEN_ELEMENTS[tagName],
          },
        });
      },
    };
  },
});
