import type { Meta, StoryObj } from "@storybook/react";
import { TextArea } from "./text-area";

const meta: Meta<typeof TextArea> = {
  title: "UI/Inputs/TextArea",
  component: TextArea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Primary: Story = {
  args: { placeholder: "Enter description…", rows: 4 },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)", maxWidth: 400 }}>
      <TextArea placeholder="Enter notes…" rows={3} />
      <TextArea defaultValue="Pre-filled text that cannot be edited." disabled rows={3} />
    </div>
  ),
};
