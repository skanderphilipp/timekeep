import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { FormField } from "../form/form-field";

/**
 * Input — single-line text field.
 *
 * Used in forms, filters, and search. Supports placeholder,
 * disabled, and error states. Compose with FormField for labels.
 */
const meta: Meta<typeof Input> = {
  title: "UI/Inputs/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  args: { placeholder: "Search employees…" },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 320,
      }}
    >
      <div>
        <FormField label="Username">
          <Input placeholder="Enter username…" />
        </FormField>
      </div>
      <div>
        <FormField label="Disabled">
          <Input value="Cannot edit" disabled />
        </FormField>
      </div>
      <div>
        <FormField label="With Value">
          <Input value="Ahmed Al-Sabah" />
        </FormField>
      </div>
    </div>
  ),
};

export const ContextSearch: Story = {
  name: "Context: Search Employee",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-4)", maxWidth: 400 }}>
      <Input placeholder="Search by name or PIN…" />
      <div style={{ marginTop: 8, color: "var(--ao-font-color-tertiary)", fontSize: 12 }}>
        Search across employee names and PIN numbers
      </div>
    </div>
  ),
};
