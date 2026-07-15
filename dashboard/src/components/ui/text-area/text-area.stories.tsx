import type { Meta, StoryObj } from "@storybook/react";
import { TextArea } from "./text-area";

const meta: Meta<typeof TextArea> = {
  title: "UI/Inputs/TextArea",
  component: TextArea,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    error: { control: "text" },
    helperText: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    rows: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Primary: Story = {
  args: { placeholder: "Enter description…", rows: 4 },
};

export const WithLabel: Story = {
  args: { label: "Description", placeholder: "Enter description…", rows: 4 },
};

export const Required: Story = {
  args: { label: "Description", placeholder: "Enter description…", rows: 4, required: true },
};

export const WithError: Story = {
  args: {
    label: "Description",
    placeholder: "Enter description…",
    rows: 4,
    error: "Description is required",
  },
};

export const WithHelperText: Story = {
  args: {
    label: "Notes",
    placeholder: "Add any additional notes…",
    rows: 3,
    helperText: "Optional. Maximum 500 characters.",
  },
};

export const Disabled: Story = {
  args: { placeholder: "This field is disabled", rows: 3, disabled: true },
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
        maxWidth: 400,
      }}
    >
      <TextArea label="Basic" placeholder="Enter notes…" rows={3} />
      <TextArea label="Required" placeholder="Enter notes…" rows={3} required />
      <TextArea label="With error" placeholder="Enter notes…" rows={3} error="This field cannot be empty" />
      <TextArea label="With helper" placeholder="Enter notes…" rows={3} helperText="Optional notes field" />
      <TextArea label="Disabled" defaultValue="Pre-filled text that cannot be edited." disabled rows={3} />
    </div>
  ),
};
