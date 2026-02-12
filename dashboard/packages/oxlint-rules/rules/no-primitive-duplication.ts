import { defineRule } from '@oxlint/plugins';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const RULE_NAME = 'no-primitive-duplication';

// ── Known UI primitive fingerprints ──────────────────────────────────
//
// Each entry describes a visual pattern that belongs in components/ui/.
// If an infrastructure/ or modules/ .module.scss file matches one,
// the developer should use the existing UI component instead.

type PrimitivePattern = {
  /** Human-readable name of the UI component to use instead. */
  component: string;
  /** CSS properties that signal this is a badge/button/card/etc. */
  properties: RegExp[];
  /** Minimum number of properties that must match to trigger the rule. */
  minMatches: number;
  /** Suggestion text. */
  message: string;
};

const PRIMITIVES: PrimitivePattern[] = [
  {
    component: 'Badge',
    properties: [
      /display\s*:\s*inline-flex/,
      /border-radius\s*:/,
      /font-size\s*:\s*var\(.*xs\)/,
      /padding\s*:\s*[12]px\s/,
      /font-weight\s*:\s*var\(.*semibold\)/,
    ],
    minMatches: 3,
    message:
      'This looks like a Badge. Use <Badge variant="..." size="sm"> from @/components/ui/badge instead of custom styles.',
  },
  {
    component: 'Button',
    properties: [
      /cursor\s*:\s*pointer/,
      /border-radius\s*:/,
      /display\s*:\s*inline-flex/,
      /align-items\s*:\s*center/,
      /height\s*:\s*3[26]px/,
      /background\s*:\s*none/,
      /\bbackground-color\s*:\s*(?:transparent|var\(--ao-background)/,
    ],
    minMatches: 4,
    message:
      'This looks like a Button. Use <Button variant="ghost" size="sm"> from @/components/ui/button instead of custom styles.',
  },
  {
    component: 'Card',
    properties: [
      /border\s*:\s*1px\s+solid\s+var\(--ao-border/,
      /border-radius\s*:\s*var\(--ao-(?:border-)?radius/,
      /display\s*:\s*flex/,
      /flex-direction\s*:\s*column/,
      /padding\s*:\s*var\(--ao-spacing-[3456]\)/,
    ],
    minMatches: 3,
    message:
      'This looks like a Card. Use <Card><Card.Content> from @/components/ui/card instead of custom styles.',
  },
  {
    component: 'Tag',
    properties: [
      /display\s*:\s*inline-flex/,
      /align-items\s*:\s*center/,
      /border-radius\s*:/,
      /font-size\s*:\s*var\(.*xs\)/,
      /padding\s*:\s*[12]px\s+\d/,
    ],
    minMatches: 3,
    message:
      'This looks like a Tag. Use <Tag text="..." color="..." variant="solid"> from @/components/ui/tag instead of custom styles.',
  },
];

// ── Path checks ──────────────────────────────────────────────────────

/** Files in these directories are checked for primitive duplication. */
const CHECK_DIRS = ['src/infrastructure/', 'src/modules/'];

/** Files in these directories are exempt (UI library itself). */
const EXEMPT_DIRS = ['src/components/ui/'];

const isCheckedFile = (filepath: string): boolean =>
  CHECK_DIRS.some((dir) => filepath.startsWith(dir)) &&
  !EXEMPT_DIRS.some((dir) => filepath.startsWith(dir));

// ── Rule ─────────────────────────────────────────────────────────────

export const rule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Detects .module.scss files in infrastructure/ or modules/ that duplicate styles from components/ui/ primitives (Badge, Button, Card, Tag).',
    },
    messages: {
      primitiveDuplication:
        'This .module.scss duplicates the {{ component }} primitive from components/ui/. {{ message }}',
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    return {
      ImportDeclaration: (node: any) => {
        const source = node.source?.value as string | undefined;
        if (!source) return;
        if (!source.endsWith('.module.scss')) return;

        // Only check infrastructure/ and modules/
        if (!isCheckedFile(filename)) return;

        // Resolve the .module.scss file path
        const dir = path.dirname(filename);
        const scssPath = path.resolve(dir, source);

        if (!fs.existsSync(scssPath)) return;

        try {
          const content = fs.readFileSync(scssPath, 'utf-8');

          for (const prim of PRIMITIVES) {
            const matchCount = prim.properties.filter((re) =>
              re.test(content),
            ).length;

            if (matchCount >= prim.minMatches) {
              context.report({
                node,
                messageId: 'primitiveDuplication',
                data: { component: prim.component, message: prim.message },
              });
              return; // One violation per file is enough
            }
          }
        } catch {
          // File read error — skip (not a lint error)
        }
      },
    };
  },
});
