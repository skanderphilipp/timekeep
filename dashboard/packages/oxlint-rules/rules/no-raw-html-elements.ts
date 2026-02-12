import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'no-raw-html-elements';

/**
 * Enforces architectural layering: only components under `components/ui/` may
 * use raw HTML elements. Pages and module components must compose from UI
 * primitives or named sub-components.
 *
 * ── Scope ──
 *   This rule applies to ALL non-UI, non-test files under `modules/`.
 *   - Pages:          modules/[domain]/pages/    - raw HTML + atom imports forbidden
 *   - Components:     modules/[domain]/components/ - raw HTML forbidden (atoms allowed)
 *   - Hooks/States:   modules/[domain]/hooks/ states/
 *
 * Allowed everywhere (semantic HTML5 layout):
 *   section, nav, main, article, aside, header, footer
 *
 * Forbidden raw elements (use UI primitive instead):
 *   div, span, h1-h6, p, hr, label, button, input, select, textarea
 *
 * Forbidden UI atom imports (pages only):
 *   Pages may only import layout/feedback primitives. Everything else must
 *   be composed into a module component first.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Raw HTML elements that must never appear outside components/ui/. */
const FORBIDDEN_ELEMENTS: Record<string, string> = {
  // Structural
  div: 'a UI layout primitive (Section, Card, Grid) from components/ui/',
  span: 'Text component from components/ui/',
  // Typography
  h1: 'Heading level="h1" from components/ui/',
  h2: 'Heading level="h2" from components/ui/',
  h3: 'Heading level="h3" from components/ui/',
  h4: 'Heading level="h4" from components/ui/',
  h5: 'Heading level="h5" from components/ui/',
  h6: 'Heading level="h6" from components/ui/',
  p: 'Text variant="body" from components/ui/',
  hr: 'Separator from components/ui/',
  // Form
  label: 'FormField from components/ui/',
  button: 'Button or IconButton from components/ui/',
  input: 'Input or FilterInput from components/ui/',
  select: 'Select from components/ui/',
  textarea: 'TextArea from components/ui/',
};

/** Semantic HTML5 elements allowed as layout primitives everywhere. */
const ALLOWED_SEMANTIC_ELEMENTS = new Set([
  'section',
  'nav',
  'main',
  'article',
  'aside',
  'header',
  'footer',
]);

/**
 * UI atom components that are NOT allowed in pages.
 * Pages should only compose molecules and layout primitives.
 */
const FORBIDDEN_UI_IMPORTS = new Set([
  // Typography
  'Heading',
  'Text',
  'Separator',
  // Form primitives
  'Form',
  'FormField',
  'FormActions',
  'FormSection',
  'Input',
  'Select',
  'Checkbox',
  'Toggle',
  'TextArea',
  'Button',
  'IconButton',
  // Data display
  'Badge',
  'Chip',
  'Avatar',
  'StatusDot',
  'Banner',
  'ProgressBar',
  'Tooltip',
  // Navigation
  'TabList',
  'Tab',
  'TabPanel',
  'Pagination',
  // Overlays
  'Dialog',
  'Dropdown',
  'DropdownContent',
  'DropdownSearch',
  // Charts (should be in molecules)
  'Chart',
  'BarChart',
  'LineChart',
  'PieChart',
  // Search/Filter
  'FilterBar',
  'FilterInput',
  'FilterSelect',
  'FilterDateRange',
  'SearchInput',
  'Combobox',
  'MultiSelect',
  // Table
  'DataTable',
  // Date
  'DatePicker',
  // Menu
  'MenuItem',
  'MenuItemNavigate',
  'MenuSeparator',
  // Misc
  'VisuallyHidden',
]);

/** UI imports that ARE allowed in pages (layout + feedback primitives). */
const ALLOWED_UI_IMPORTS = new Set([
  'PageLayout',
  'PageBody',
  'PageBar',
  'PageHeader',
  'Section',
  'Card',
  'CardGrid',
  'EmptyState',
  'Spinner',
  'Skeleton',
  'SkeletonLines',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isUiComponent = (filename: string): boolean =>
  /(?:^|\/)components\/ui\//.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

const isPageFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/pages\//.test(filename);

const isModuleFile = (filename: string): boolean =>
  /(?:^|\/)modules\//.test(filename);

const resolveImportSource = (node: any): string | null => {
  const source = node.source?.value;
  if (typeof source === 'string') return source;
  return null;
};

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const rule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Raw HTML elements (div, span, h1-h6, p, button, input, select, textarea) are forbidden outside components/ui/. Pages and module components must compose from UI primitives. Pages additionally cannot import UI atoms directly.',
    },
    messages: {
      rawElement:
        'Raw <{{ element }}> outside components/ui/. Replace with {{ replacement }}',
      rawElementInModule:
        'Raw <{{ element }}> in module component. Replace with {{ replacement }} If no UI primitive exists, create one in components/ui/ first.',
      atomImport:
        'Atom component "{{ name }}" imported in page from @/components/ui. Extract this into a module component under modules/*/components/ and compose that from the page. Only PageLayout, PageBody, PageBar, PageHeader, Section, Card, CardGrid, EmptyState, Spinner, and Skeleton are permitted at the page level.',
    },
    schema: [
      {
        type: 'object',
        properties: {
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

    // Skip the UI component library itself — that's where raw elements belong
    if (isUiComponent(filename)) return {};

    // Skip test/story files
    if (skipTestFiles && isTestOrStory(filename)) return {};

    // Only enforce in module files (pages + components + hooks + states)
    const inPage = isPageFile(filename);
    const inModule = isModuleFile(filename);

    if (!inPage && !inModule) return {};

    return {
      // --- Check 1: Forbidden UI atom imports from @/components/ui (pages only) ---
      ImportDeclaration: (node: any) => {
        if (!inPage) return;

        const source = resolveImportSource(node);
        if (!source || source !== '@/components/ui') return;

        for (const spec of node.specifiers || []) {
          const name =
            spec.imported?.name ||
            spec.imported?.value ||
            spec.local?.name;
          if (!name) continue;

          // Allow layout/feedback primitives
          if (ALLOWED_UI_IMPORTS.has(name)) continue;

          // Flag everything else from @/components/ui
          if (FORBIDDEN_UI_IMPORTS.has(name)) {
            context.report({
              node: spec,
              messageId: 'atomImport',
              data: { name },
            });
          }
        }
      },

      // --- Check 2: Raw HTML elements (all module files) ---
      JSXElement: (node: any) => {
        const openingEl = node.openingElement;
        if (!openingEl) return;

        const tagName =
          openingEl.name?.type === 'JSXIdentifier'
            ? openingEl.name.name
            : null;

        if (!tagName) return;

        // Allow semantic HTML5 layout elements
        if (ALLOWED_SEMANTIC_ELEMENTS.has(tagName)) return;

        // Allow web components (custom elements with hyphens)
        if (tagName.includes('-')) return;

        // Allow JSX component names (uppercase)
        if (tagName[0] === tagName[0].toUpperCase()) return;

        // Check if it's a forbidden raw element
        if (!(tagName in FORBIDDEN_ELEMENTS)) return;

        context.report({
          node: openingEl,
          messageId: inPage ? 'rawElement' : 'rawElementInModule',
          data: {
            element: tagName,
            replacement: FORBIDDEN_ELEMENTS[tagName],
          },
        });
      },
    };
  },
});
