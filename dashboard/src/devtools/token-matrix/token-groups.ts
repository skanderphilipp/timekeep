// ── Token definitions ─────────────────────────────────────────────────────
// The stable `--ao-*` token names from generated-tokens.css. Values are
// read at runtime via getComputedStyle() so they stay in sync with the
// active theme (light / dark) selected in the Storybook toolbar.
// `pnpm lint:tokens` fails if any name here stops existing.

export type TokenGroup = {
  label: string;
  description?: string;
  tokens: string[];
};

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function scale(prefix: string): string[] {
  return STEPS.map((step) => `${prefix}${step}`);
}

export const COLOR_GROUPS: TokenGroup[] = [
  {
    label: "Background",
    description: "Surface colors for page, cards, and layered containers.",
    tokens: [
      "--ao-background-primary",
      "--ao-background-secondary",
      "--ao-background-tertiary",
      "--ao-background-page",
    ],
  },
  {
    label: "Font Color",
    description: "Text colors from primary (headings) to disabled (placeholder).",
    tokens: [
      "--ao-font-color-primary",
      "--ao-font-color-secondary",
      "--ao-font-color-tertiary",
      "--ao-font-color-disabled",
      "--ao-font-color-inverted",
    ],
  },
  {
    label: "Border",
    description: "Border colors for dividers and outlines.",
    tokens: ["--ao-border-color-light", "--ao-border-color-medium", "--ao-border-color-strong"],
  },
  {
    label: "Interaction",
    description: "Focus ring and modal overlay.",
    tokens: ["--ao-focus-ring", "--ao-overlay"],
  },
  {
    label: "Status: Success / Warning / Danger / Info",
    description:
      "Semantic aliases — bg (3), bg-hover (4), border (7), solid (9), solid-hover (10), text (11).",
    tokens: ["success", "warning", "danger", "info"].flatMap((s) =>
      ["bg", "bg-hover", "border", "solid", "solid-hover", "text"].map(
        (r) => `--ao-status-${s}-${r}`,
      ),
    ),
  },
  {
    label: "Chart Palette",
    description:
      "sRGB-only tokens for chart libraries (d3-parseable). Categorical order 1-6 plus semantic roles.",
    tokens: [
      ...STEPS.slice(0, 6).map((i) => `--ao-chart-${i}`),
      "--ao-chart-primary",
      "--ao-chart-positive",
      "--ao-chart-negative",
      "--ao-chart-warning",
      "--ao-chart-info",
      "--ao-chart-neutral",
    ],
  },
  {
    label: "Gray Scale",
    description:
      "Full 12-step Radix gray. 1-2 backgrounds · 3-5 components · 6-8 borders · 9-10 solid · 11-12 text.",
    tokens: scale("--ao-color-gray"), // token-lint-ignore -- scale prefix, steps appended
  },
  {
    label: "Accent (Cyan)",
    description: "Primary brand accent, full 12-step scale.",
    tokens: scale("--ao-accent-accent"), // token-lint-ignore -- scale prefix, steps appended
  },
  {
    label: "Red (Danger / Error)",
    description: "Destructive actions, error states, offline device status.",
    tokens: scale("--ao-color-red"), // token-lint-ignore -- scale prefix, steps appended
  },
  {
    label: "Green (Success)",
    description: "Success states, online device status, confirmation badges.",
    tokens: scale("--ao-color-green"), // token-lint-ignore -- scale prefix, steps appended
  },
  {
    label: "Amber (Warning)",
    description: "Warnings, pending states, late attendance indicators.",
    tokens: scale("--ao-color-amber"), // token-lint-ignore -- scale prefix, steps appended
  },
  {
    label: "Blue (Info)",
    description: "Informational states and links.",
    tokens: scale("--ao-color-blue"), // token-lint-ignore -- scale prefix, steps appended
  },
];

export const SPACING_TOKENS: string[] = [
  "--ao-spacing-0",
  "--ao-spacing-0_5",
  "--ao-spacing-1",
  "--ao-spacing-1_5",
  "--ao-spacing-2",
  "--ao-spacing-3",
  "--ao-spacing-4",
  "--ao-spacing-5",
  "--ao-spacing-6",
  "--ao-spacing-7",
  "--ao-spacing-8",
  "--ao-spacing-9",
  "--ao-spacing-10",
  "--ao-spacing-11",
  "--ao-spacing-12",
  "--ao-spacing-13",
  "--ao-spacing-14",
  "--ao-spacing-15",
  "--ao-spacing-16",
  "--ao-spacing-20",
  "--ao-spacing-24",
  "--ao-spacing-28",
  "--ao-spacing-32",
];

export const RADIUS_TOKENS: string[] = [
  "--ao-radius-xs",
  "--ao-radius-sm",
  "--ao-radius-md",
  "--ao-radius-lg",
  "--ao-radius-xl",
  "--ao-radius-pill",
  "--ao-radius-full",
];

export const FONT_SIZE_TOKENS: string[] = [
  "--ao-font-size-xxs",
  "--ao-font-size-xs",
  "--ao-font-size-sm",
  "--ao-font-size-md",
  "--ao-font-size-lg",
  "--ao-font-size-xl",
  "--ao-font-size-2xl",
  "--ao-font-size-3xl",
];

export const FONT_WEIGHT_TOKENS: string[] = [
  "--ao-font-weight-regular",
  "--ao-font-weight-medium",
  "--ao-font-weight-semibold",
  "--ao-font-weight-bold",
];

export const FONT_FAMILY_TOKENS: string[] = ["--ao-font-family", "--ao-font-family-mono"];

export const SHADOW_TOKENS: string[] = [
  "--ao-shadow-sm",
  "--ao-shadow-md",
  "--ao-shadow-lg",
  "--ao-shadow-page",
];
