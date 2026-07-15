import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Combobox, type ComboboxOption } from "./combobox";
import { StatusDot } from "../status-dot";

const deviceOptions: ComboboxOption[] = [
  { value: "CQZ7232960836", label: "Main Gate", prefix: <StatusDot status="online" /> },
  { value: "BKW8471209384", label: "Warehouse B", prefix: <StatusDot status="online" /> },
  { value: "OFM9928475623", label: "Office Floor", prefix: <StatusDot status="offline" /> },
];

const meta: Meta<typeof Combobox> = {
  title: "UI/Inputs/Combobox",
  component: Combobox,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Combobox>;

export const Primary: Story = {
  render: function InteractiveCombobox() {
    const [selected, setSelected] = useState<string | undefined>(undefined);
    return (
      <div style={{ padding: 20, maxWidth: 300 }}>
        <Combobox
          options={deviceOptions}
          value={selected}
          onChange={setSelected}
          placeholder="Select device…"
        />
      </div>
    );
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", padding: 20 }}
    >
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          With selection
        </p>
        <Combobox
          options={deviceOptions}
          value="CQZ7232960836"
          onChange={fn()}
          placeholder="Select device…"
        />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          No selection
        </p>
        <Combobox
          options={deviceOptions}
          value={undefined}
          onChange={fn()}
          placeholder="Select device…"
        />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Loading
        </p>
        <Combobox options={[]} value={undefined} onChange={fn()} placeholder="Loading…" loading />
      </div>
    </div>
  ),
};
