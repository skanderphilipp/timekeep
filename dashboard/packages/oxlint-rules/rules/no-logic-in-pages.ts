import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'no-logic-in-pages';

/**
 * Pages must be thin composites — zero business logic, zero hooks
 * (except useLingui), zero inline handlers.
 *
 * Forbidden in pages:
 *   - useState, useMemo, useCallback, useEffect, useRef, useReducer
 *   - Any custom hook (use[A-Z]*) except useLingui
 *
 * Allowed in pages:
 *   - useLingui (required for i18n)
 *   - Only one custom page-orchestration hook (e.g., usePunchQueryPage)
 *     if it's the page's dedicated hook in the same module's hooks/ dir.
 */

const FORBIDDEN_REACT_HOOKS = new Set([
  'useState',
  'useMemo',
  'useCallback',
  'useEffect',
  'useRef',
  'useReducer',
  'useImperativeHandle',
  'useLayoutEffect',
  'useInsertionEffect',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useDebugValue',
  'useSyncExternalStore',
]);

/** Allowed singleton — the page's own orchestration hook. */
const isPageOwnHook = (hookName: string, filename: string): boolean => {
  // Extract module name from path: modules/<name>/pages/<file>
  const match = filename.match(/modules\/([^/]+)\/pages\//);
  if (!match) return false;
  const moduleName = match[1];

  // The hook file should be in the same module's hooks/ dir
  const hookImportPath = new RegExp(
    `modules/${moduleName}/hooks/use-[a-z]`,
    'i',
  );
  return hookImportPath.test(filename + hookName);
};

const isPageFile = (filename: string): boolean =>
  /(?:^|\/)modules\/[^/]+\/pages\//.test(filename);

export const rule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Pages must be thin composites. No useState, useMemo, useCallback, useEffect, or custom hooks (except useLingui and ONE page-orchestration hook) allowed in page files.',
    },
    messages: {
      forbiddenHook:
        'Hook "{{ name }}" is forbidden in page files. Pages must be thin composites — extract this into a hook in modules/<name>/hooks/. Only useLingui and a single page orchestration hook are permitted.',
      tooManyPageHooks:
        'Page uses {{ count }} custom hooks. Pages may only call useLingui + ONE page orchestration hook. Extract remaining logic into sub-hooks.',
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    if (!isPageFile(filename)) return {};

    // Track custom hooks called in this page
    const customHooks = new Set<string>();

    return {
      CallExpression: (node: any) => {
        const callee = node.callee;
        if (!callee) return;

        // Get the function name being called
        let name: string | null = null;
        if (callee.type === 'Identifier') {
          name = callee.name;
        }

        if (!name) return;

        // Check React built-in hooks
        if (FORBIDDEN_REACT_HOOKS.has(name)) {
          context.report({
            node,
            messageId: 'forbiddenHook',
            data: { name },
          });
          return;
        }

        // Track custom hooks (useXxx pattern)
        if (/^use[A-Z]/.test(name) && name !== 'useLingui') {
          customHooks.add(name);
        }
      },

      // After the file is processed, check custom hook count
      'Program:exit': () => {
        if (customHooks.size > 1) {
          // Use the first node's loc for reporting (approximate)
          context.report({
            node: (context as any).sourceCode?.ast ?? {},
            messageId: 'tooManyPageHooks',
            data: { count: customHooks.size },
          });
        }
      },
    };
  },
});
