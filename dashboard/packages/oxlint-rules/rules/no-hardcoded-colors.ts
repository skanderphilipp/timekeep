import { defineRule } from '@oxlint/plugins';

export const RULE_NAME = 'no-hardcoded-colors';

export const rule = defineRule({
  meta: {
    docs: {
      description:
        'Do not use hardcoded RGBA or Hex colors. Please use a design token from the theme.',
    },
    messages: {
      hardcodedColor:
        'Hardcoded color {{ color }} found. Please use a design token (e.g. var(--ao-color-red9)) instead.',
    },
    type: 'suggestion',
    schema: [],
    fixable: 'code',
  },
  create: (context) => {
    const testHardcodedColor = (literal: any) => {
      const colorRegex = /(?:rgba?\()|(?:#[0-9a-fA-F]{3,8})\b/i;
      if (literal.type === 'Literal' && typeof literal.value === 'string') {
        if (colorRegex.test(literal.value))
          context.report({
            node: literal,
            messageId: 'hardcodedColor',
            data: { color: literal.value },
          });
      } else if (literal.type === 'TemplateLiteral') {
        for (const quasi of literal.quasis) {
          if (colorRegex.test(quasi.value.raw))
            context.report({
              node: literal,
              messageId: 'hardcodedColor',
              data: { color: quasi.value.raw },
            });
        }
      }
    };
    return {
      Literal: (literal: any) => testHardcodedColor(literal),
      TemplateLiteral: (templateLiteral: any) =>
        testHardcodedColor(templateLiteral),
    };
  },
});
