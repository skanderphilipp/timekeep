/**
 * Reusable a11y parameter presets for Storybook stories.
 *
 * Usage:
 *   parameters: { a11y: A11Y_DEFER_COLOR_CONTRAST }
 *
 * Adapted from Twenty's a11yParameters.ts.
 */

/**
 * Defers color-contrast checks for stories where tokens are applied
 * but the rendered colors are controlled by the parent theme context
 * (e.g., catalog grids, dark-mode-only stories).
 */
export const A11Y_DEFER_COLOR_CONTRAST = {
  config: {
    rules: [{ id: "color-contrast", enabled: false }],
  },
} as const;
