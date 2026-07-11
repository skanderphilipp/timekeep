import type { Meta, StoryObj } from "@storybook/react";
import { VisuallyHidden } from "./visually-hidden";
import { Text } from "../text";

const meta: Meta<typeof VisuallyHidden> = {
  title: "UI/Separators/VisuallyHidden",
  component: VisuallyHidden,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof VisuallyHidden>;

export const Primary: Story = {
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)" }}>
      <button type="button" style={{ padding: 8 }}>
        <span aria-hidden="true">✕</span>
        <VisuallyHidden>Close dialog</VisuallyHidden>
      </button>
    </div>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 4, display: "block" }}>Button label (visible icon, hidden text)</Text>
        <button type="button" style={{ padding: 8 }}>
          ✓ <VisuallyHidden>Mark as complete</VisuallyHidden>
        </button>
      </div>
      <div>
        <Text variant="caption" color="tertiary" style={{ marginBottom: 4, display: "block" }}>Status message for screen readers</Text>
        <div>
          <span aria-live="polite" role="status">
            <VisuallyHidden>3 anomalies detected. Page loaded successfully.</VisuallyHidden>
          </span>
          <span>Content visible to all users.</span>
        </div>
      </div>
    </div>
  ),
};

export const ContextSkipLink: Story = {
  name: "Context: Skip Navigation",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)" }}>
      <a href="#main-content" style={{ position: "absolute", left: "-9999px" }}>
        <VisuallyHidden>Skip to main content</VisuallyHidden>
      </a>
      <Text variant="body">Main content area. The skip link is hidden but screen-reader accessible.</Text>
    </div>
  ),
};
