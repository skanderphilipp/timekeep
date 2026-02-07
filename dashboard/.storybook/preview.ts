import type { Preview } from "@storybook/react";
import "../src/styles/generated-tokens.css";
import "../src/styles/global.scss";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "var(--ao-background-primary)" },
        { name: "dark", value: "#111" },
      ],
    },
  },
  decorators: [
    (Story) => {
      // Ensure light theme class is set for consistent rendering
      document.documentElement.classList.add("light");
      return Story();
    },
  ],
};

export default preview;
