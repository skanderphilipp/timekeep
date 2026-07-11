/**
 * JS accessor map for all timekeep design tokens.
 *
 * Every `--ao-*` CSS custom property is mirrored here as a structured
 * JavaScript object. Values are `var(--ao-*)` references — they resolve
 * at runtime via `getComputedStyle()` when consumed through ThemeProvider.
 *
 * This enables programmatic access to theme values (e.g., for chart
 * libraries, canvas rendering, or conditional logic) without hardcoding
 * or duplicating token values.
 *
 * Kept in sync with `src/styles/tokens/build.ts` — when a new token is
 * added to the build pipeline, add its accessor here.
 */

export const themeCssVariables = {
  /** Base unit for the spacing scale. */
  spacingMultiplicator: "4",

  /** Spacing scale (spacing-0 through spacing-32 plus 0_5 and 1_5). */
  spacing: {
    "0": "var(--ao-spacing-0)",
    "0_5": "var(--ao-spacing-0_5)",
    "1": "var(--ao-spacing-1)",
    "1_5": "var(--ao-spacing-1_5)",
    "2": "var(--ao-spacing-2)",
    "3": "var(--ao-spacing-3)",
    "4": "var(--ao-spacing-4)",
    "5": "var(--ao-spacing-5)",
    "6": "var(--ao-spacing-6)",
    "7": "var(--ao-spacing-7)",
    "8": "var(--ao-spacing-8)",
    "9": "var(--ao-spacing-9)",
    "10": "var(--ao-spacing-10)",
    "11": "var(--ao-spacing-11)",
    "12": "var(--ao-spacing-12)",
    "13": "var(--ao-spacing-13)",
    "14": "var(--ao-spacing-14)",
    "15": "var(--ao-spacing-15)",
    "16": "var(--ao-spacing-16)",
    "17": "var(--ao-spacing-17)",
    "18": "var(--ao-spacing-18)",
    "19": "var(--ao-spacing-19)",
    "20": "var(--ao-spacing-20)",
    "21": "var(--ao-spacing-21)",
    "22": "var(--ao-spacing-22)",
    "23": "var(--ao-spacing-23)",
    "24": "var(--ao-spacing-24)",
    "25": "var(--ao-spacing-25)",
    "26": "var(--ao-spacing-26)",
    "27": "var(--ao-spacing-27)",
    "28": "var(--ao-spacing-28)",
    "29": "var(--ao-spacing-29)",
    "30": "var(--ao-spacing-30)",
    "31": "var(--ao-spacing-31)",
    "32": "var(--ao-spacing-32)",
  },

  /** Background color scale. */
  background: {
    primary: "var(--ao-background-primary)",
    secondary: "var(--ao-background-secondary)",
    tertiary: "var(--ao-background-tertiary)",
    page: "var(--ao-background-page)",
  },

  /** Font family and typography scale. */
  font: {
    family: "var(--ao-font-family)",
    familyMono: "var(--ao-font-family-mono)",
    size: {
      xxs: "var(--ao-font-size-xxs)",
      xs: "var(--ao-font-size-xs)",
      sm: "var(--ao-font-size-sm)",
      md: "var(--ao-font-size-md)",
      lg: "var(--ao-font-size-lg)",
      xl: "var(--ao-font-size-xl)",
      "2xl": "var(--ao-font-size-2xl)",
      "3xl": "var(--ao-font-size-3xl)",
    },
    weight: {
      regular: "var(--ao-font-weight-regular)",
      medium: "var(--ao-font-weight-medium)",
      semibold: "var(--ao-font-weight-semibold)",
    },
    color: {
      primary: "var(--ao-font-color-primary)",
      secondary: "var(--ao-font-color-secondary)",
      tertiary: "var(--ao-font-color-tertiary)",
      disabled: "var(--ao-font-color-disabled)",
    },
  },

  /** Border tokens. */
  border: {
    color: {
      light: "var(--ao-border-color-light)",
      medium: "var(--ao-border-color-medium)",
      strong: "var(--ao-border-color-strong)",
    },
    radius: {
      xs: "var(--ao-radius-xs)",
      sm: "var(--ao-radius-sm)",
      md: "var(--ao-radius-md)",
      lg: "var(--ao-radius-lg)",
      xl: "var(--ao-radius-xl)",
      pill: "var(--ao-radius-pill)",
      full: "var(--ao-radius-full)",
      rounded: "var(--ao-radius-full)",
    },
  },

  /** Accent color scale (Cyan/Teal). */
  accent: {
    accent1: "var(--ao-accent-accent1)",
    accent3: "var(--ao-accent-accent3)",
    accent5: "var(--ao-accent-accent5)",
    accent7: "var(--ao-accent-accent7)",
    accent9: "var(--ao-accent-accent9)",
    accent10: "var(--ao-accent-accent10)",
    accent11: "var(--ao-accent-accent11)",
  },

  /** Semantic status colors. */
  color: {
    red: {
      1: "var(--ao-color-red1)",
      3: "var(--ao-color-red3)",
      5: "var(--ao-color-red5)",
      9: "var(--ao-color-red9)",
      10: "var(--ao-color-red10)",
      11: "var(--ao-color-red11)",
    },
    green: {
      1: "var(--ao-color-green1)",
      3: "var(--ao-color-green3)",
      5: "var(--ao-color-green5)",
      9: "var(--ao-color-green9)",
      10: "var(--ao-color-green10)",
      11: "var(--ao-color-green11)",
    },
    amber: {
      1: "var(--ao-color-amber1)",
      3: "var(--ao-color-amber3)",
      5: "var(--ao-color-amber5)",
      9: "var(--ao-color-amber9)",
      10: "var(--ao-color-amber10)",
      11: "var(--ao-color-amber11)",
    },
    blue: {
      1: "var(--ao-color-blue1)",
      3: "var(--ao-color-blue3)",
      5: "var(--ao-color-blue5)",
      9: "var(--ao-color-blue9)",
      10: "var(--ao-color-blue10)",
      11: "var(--ao-color-blue11)",
    },
  },

  /** Box shadows. */
  shadow: {
    sm: "var(--ao-shadow-sm)",
    md: "var(--ao-shadow-md)",
    lg: "var(--ao-shadow-lg)",
  },

  /**
   * Chart palette. These tokens are emitted as sRGB hex only (never P3),
   * so their resolved values are always parseable by chart libraries
   * (nivo / d3-color). Use these — not the raw color scales — for any
   * color that a chart library manipulates in JavaScript.
   */
  chart: {
    categorical: {
      1: "var(--ao-chart-1)",
      2: "var(--ao-chart-2)",
      3: "var(--ao-chart-3)",
      4: "var(--ao-chart-4)",
      5: "var(--ao-chart-5)",
      6: "var(--ao-chart-6)",
    },
    primary: "var(--ao-chart-primary)",
    positive: "var(--ao-chart-positive)",
    negative: "var(--ao-chart-negative)",
    warning: "var(--ao-chart-warning)",
    info: "var(--ao-chart-info)",
    neutral: "var(--ao-chart-neutral)",
  },
} as const;
