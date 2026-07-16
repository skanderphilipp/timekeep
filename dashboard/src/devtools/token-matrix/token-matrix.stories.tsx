import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, type CSSProperties } from "react";

import {
  COLOR_GROUPS,
  SPACING_TOKENS,
  RADIUS_TOKENS,
  FONT_SIZE_TOKENS,
  FONT_WEIGHT_TOKENS,
  FONT_FAMILY_TOKENS,
  SHADOW_TOKENS,
} from "./token-groups";
import { useTokenValues, filterMap } from "./token-utils";
import { SectionHeading, SectionDescription, ColorGroupBlock } from "./token-sections";
import { SpacingScale, BorderRadiusScale } from "./token-scales";
import { FontSizeScale, FontWeightScale, FontFamilyScale } from "./token-typography";
import {
  ShadowScale,
  BorderPreview,
  FontColorPreview,
  BORDER_TOKENS,
  FONT_COLOR_TOKENS,
} from "./token-surfaces";

const PAGE_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ao-spacing-8)",
  margin: "0 auto",
  maxWidth: 960,
  padding: "var(--ao-spacing-6)",
};

const SECTION_STYLE: CSSProperties = {
  backgroundColor: "var(--ao-background-primary)",
  border: "1px solid var(--ao-border-color-light)",
  borderRadius: "var(--ao-radius-lg)",
  padding: "var(--ao-spacing-5)",
};

/** All token names used anywhere on the page, deduplicated for a single read. */
const ALL_TOKEN_NAMES = [
  ...COLOR_GROUPS.flatMap((g) => g.tokens),
  ...SPACING_TOKENS,
  ...RADIUS_TOKENS,
  ...FONT_SIZE_TOKENS,
  ...FONT_WEIGHT_TOKENS,
  ...FONT_FAMILY_TOKENS,
  ...SHADOW_TOKENS,
  ...BORDER_TOKENS,
  ...FONT_COLOR_TOKENS,
];

function TokenMatrixPage() {
  // Single read of all CSS custom properties — one MutationObserver for theme switching.
  const values = useTokenValues(ALL_TOKEN_NAMES);

  // Subsets for individual sections (derived from the same map).
  const spacingValues = useMemo(() => filterMap(values, SPACING_TOKENS), [values]);
  const radiusValues = useMemo(() => filterMap(values, RADIUS_TOKENS), [values]);
  const fontSizeValues = useMemo(() => filterMap(values, FONT_SIZE_TOKENS), [values]);
  const fontWeightValues = useMemo(() => filterMap(values, FONT_WEIGHT_TOKENS), [values]);
  const fontFamilyValues = useMemo(() => filterMap(values, FONT_FAMILY_TOKENS), [values]);
  const shadowValues = useMemo(() => filterMap(values, SHADOW_TOKENS), [values]);
  const borderValues = useMemo(() => filterMap(values, BORDER_TOKENS), [values]);
  const fontColorValues = useMemo(() => filterMap(values, FONT_COLOR_TOKENS), [values]);

  return (
    <div style={PAGE_STYLE}>
      {/* Header */}
      <div>
        <h1
          style={{
            color: "var(--ao-font-color-primary)",
            fontSize: "var(--ao-font-size-2xl)",
            fontWeight: "var(--ao-font-weight-semibold)",
            margin: "0 0 var(--ao-spacing-1) 0",
          }}
        >
          Design Tokens
        </h1>
        <p
          style={{
            color: "var(--ao-font-color-secondary)",
            fontSize: "var(--ao-font-size-sm)",
            margin: 0,
          }}
        >
          Every{" "}
          <code
            style={{ fontFamily: "var(--ao-font-family-mono)", fontSize: "var(--ao-font-size-xs)" }}
          >
            --ao-*
          </code>{" "}
          CSS custom property used in the design system. Switch between Light and Dark in the
          toolbar to see theme variants.
        </p>
      </div>

      {/* ── Colors ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Color Palette</SectionHeading>
        <SectionDescription>
          Semantic color tokens derived from Radix Colors. Each scale has steps from 1 (lightest
          background) to 11 (most vivid foreground).
        </SectionDescription>
        {COLOR_GROUPS.map((group) => (
          <ColorGroupBlock key={group.label} group={group} values={values} />
        ))}
      </div>

      {/* ── Font Colors ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Font Colors</SectionHeading>
        <SectionDescription>
          Text color tokens applied via the <code>Text</code> component color prop.
        </SectionDescription>
        <FontColorPreview values={fontColorValues} />
      </div>

      {/* ── Spacing Scale ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Spacing Scale</SectionHeading>
        <SectionDescription>
          The 4px base grid. Values from 0 → 128px covering every layout need. The bar width is
          proportional to the pixel value.
        </SectionDescription>
        <SpacingScale values={spacingValues} />
      </div>

      {/* ── Border Radius ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Border Radius</SectionHeading>
        <SectionDescription>
          Corner rounding tokens from sharp (2px) to fully circular (100%).
        </SectionDescription>
        <BorderRadiusScale values={radiusValues} />
      </div>

      {/* ── Borders ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Border Colors</SectionHeading>
        <SectionDescription>
          Border strength tokens: light (subtle dividers), medium (card outlines), strong (focused
          rings).
        </SectionDescription>
        <BorderPreview values={borderValues} />
      </div>

      {/* ── Typography ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Typography</SectionHeading>

        <h3
          style={{
            color: "var(--ao-font-color-primary)",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            margin: "0 0 var(--ao-spacing-3) 0",
          }}
        >
          Font Sizes
        </h3>
        <SectionDescription>
          From xxs (10px) to 3xl (30px). Each size shown with a representative sentence.
        </SectionDescription>
        <FontSizeScale values={fontSizeValues} />

        <div style={{ height: "var(--ao-spacing-5)" }} />

        <h3
          style={{
            color: "var(--ao-font-color-primary)",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            margin: "0 0 var(--ao-spacing-3) 0",
          }}
        >
          Font Weights
        </h3>
        <SectionDescription>Regular (400), Medium (500), Semibold (600).</SectionDescription>
        <FontWeightScale values={fontWeightValues} />

        <div style={{ height: "var(--ao-spacing-5)" }} />

        <h3
          style={{
            color: "var(--ao-font-color-primary)",
            fontSize: "var(--ao-font-size-md)",
            fontWeight: "var(--ao-font-weight-semibold)",
            margin: "0 0 var(--ao-spacing-3) 0",
          }}
        >
          Font Families
        </h3>
        <SectionDescription>Inter (UI) and JetBrains Mono (code/data).</SectionDescription>
        <FontFamilyScale values={fontFamilyValues} />
      </div>

      {/* ── Shadows ── */}
      <div style={SECTION_STYLE}>
        <SectionHeading>Shadows</SectionHeading>
        <SectionDescription>Box shadow tokens for elevation (sm, md).</SectionDescription>
        <ShadowScale values={shadowValues} />
      </div>
    </div>
  );
}

const meta: Meta<typeof TokenMatrixPage> = {
  title: "Tokens / Design Tokens",
  component: TokenMatrixPage,
  tags: ["autodocs", "level:widget"],
  parameters: {
    controls: { disable: true },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TokenMatrixPage>;

/** Complete design token reference — every --ao-* CSS custom property visualized. */
export const AllTokens: Story = {
  name: "Design Tokens",
  render: () => <TokenMatrixPage />,
};
