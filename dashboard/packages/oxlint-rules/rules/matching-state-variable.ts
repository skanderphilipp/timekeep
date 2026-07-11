import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "matching-state-variable";

/**
 * Enforces the React convention that `useState` destructuring matches:
 *   const [count, setCount] = useState(0);
 *   const [items, setItems] = useCustomState();
 *
 * Any hook whose name matches a setter pattern (setXxx, toggleXxx, etc.)
 * must have its state variable named consistently.
 */

const VALUE_HOOKS = ["useState", "useReducer"];

const SUFFIX_PATTERN = /(State|Reducer)$/;

const _getExpectedBaseName = (stateArgName: string): string =>
  stateArgName.replace(SUFFIX_PATTERN, "");

const getExpectedSetterName = (baseName: string): string =>
  `set${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}`;

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Ensure state variable and setter naming follows React conventions",
    },
    fixable: "code",
    schema: [],
    messages: {
      invalidVariableName:
        "Invalid usage of {{ hookName }}: the variable should be named '{{ expectedName }}' but found '{{ actualName }}'.",
      invalidSetterName:
        "Invalid usage of {{ hookName }}: expected setter '{{ expectedName }}' but found '{{ actualName }}'.",
    },
  },
  create: (context) => {
    return {
      VariableDeclarator: (node: any) => {
        if (
          node?.init?.type !== "CallExpression" ||
          node.init.callee?.type !== "Identifier" ||
          !VALUE_HOOKS.includes(node.init.callee.name)
        ) {
          return;
        }

        const hookName = node.init.callee.name;

        if (node.id.type === "ArrayPattern") {
          const actualVariableName =
            node.id.elements?.[0]?.type === "Identifier" ? node.id.elements[0].name : undefined;

          if (!actualVariableName) return;

          if (!actualVariableName.match(/^[a-z]/)) {
            context.report({
              node,
              messageId: "invalidVariableName",
              data: {
                actualName: actualVariableName,
                expectedName: "camelCase variable",
                hookName,
              },
            });
          }

          if (node.id.elements[1]?.type === "Identifier") {
            const actualSetterName = node.id.elements[1].name;
            const expectedSetter = getExpectedSetterName(actualVariableName);

            if (actualSetterName !== expectedSetter) {
              context.report({
                node,
                messageId: "invalidSetterName",
                data: {
                  hookName,
                  actualName: actualSetterName,
                  expectedName: expectedSetter,
                },
                fix: (fixer: any) => {
                  if (node.id.type === "ArrayPattern") {
                    return fixer.replaceText(node.id.elements[1]!, expectedSetter);
                  }
                  return null;
                },
              });
            }
          }
        }
      },
    };
  },
});
