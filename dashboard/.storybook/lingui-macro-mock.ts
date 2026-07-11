/**
 * Storybook stand-in for @lingui/core/macro.
 *
 * The real `msg` / `t` macros are compiled away at build time by the SWC
 * plugin. In Storybook's Vite dev server, the plugin we use for the main
 * build conflicts with the Babel-based React plugin that @storybook/react-vite
 * ships (double React Refresh → "redeclaration of const RefreshRuntime").
 *
 * Instead of wrestling with plugin replacement, we alias the macro module
 * to this mock. The i18n catalog is already loaded in .storybook/preview.tsx,
 * so `_()` lookups work against the real messages.
 *
 * Pattern borrowed from Twenty's test suite:
 * packages/twenty-website/test/lingui-macro-mock.ts
 */
import type { MessageDescriptor } from "@lingui/core";

/**
 * Stand-in for the `msg` tagged-template macro.
 * Returns a MessageDescriptor whose `id` is the template literal's source text.
 *
 * @example
 *   msg`Soon`  →  { id: "Soon" }
 */
export function msg(strings: TemplateStringsArray, ...expressions: unknown[]): MessageDescriptor {
  return {
    id: String.raw({ raw: strings as unknown as readonly string[] }, ...expressions),
  };
}

/**
 * Stand-in for the `t` macro (if used). Same shape as `msg`.
 */
export function t(strings: TemplateStringsArray, ...expressions: unknown[]): MessageDescriptor {
  return {
    id: String.raw({ raw: strings as unknown as readonly string[] }, ...expressions),
  };
}
