import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'no-bare-console';

export const rule = defineRule({
  meta: {
    docs: {
      description:
        'Do not use console.log, console.warn, or console.error directly. Use the LoggerService (NestJS) or equivalent structured logger instead.',
    },
    messages: {
      bareConsoleLog:
        'Avoid {{ method }}. Use LoggerService (log/warn/error) for structured logging that respects log levels and environment configuration.',
    },
    type: 'suggestion' as const,
    schema: [],
  },
  create: (context) => {
    const disallowedMethods = new Set(['log', 'warn', 'error']);

    return {
      CallExpression: (node: any) => {
        const callee = node.callee;

        // Match: console.log(...), console.warn(...), console.error(...)
        if (
          callee?.type === 'MemberExpression' &&
          callee?.object?.type === 'Identifier' &&
          callee?.object?.name === 'console' &&
          callee?.property?.type === 'Identifier' &&
          disallowedMethods.has(callee?.property?.name)
        ) {
          context.report({
            node,
            messageId: 'bareConsoleLog',
            data: { method: `console.${callee.property.name}()` },
          });
        }
      },
    };
  },
});
