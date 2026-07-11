import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-state-useref";

export const rule = defineRule({
  meta: {
    docs: {
      description: "Don't use useRef for state management",
    },
    messages: {
      noStateUseRef:
        "Don't use useRef for state management. Use useState instead — useRef does not trigger re-renders and should only be used for DOM references or mutable values that don't affect rendering.",
    },
    type: "suggestion",
    schema: [],
  },
  create: (context) => {
    return {
      CallExpression: (node: any) => {
        if (node.callee?.type !== "Identifier" || node.callee.name !== "useRef") return;

        const typeParam = node.typeArguments?.params[0];

        if (
          !typeParam ||
          typeParam.type !== "TSTypeReference" ||
          typeParam.typeName?.type !== "Identifier" ||
          !typeParam.typeName.name.match(/^(HTML.*Element|Element)$/)
        ) {
          context.report({
            node,
            messageId: "noStateUseRef",
          });
          return;
        }
      },
    };
  },
});
