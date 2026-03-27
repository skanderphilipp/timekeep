import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { PermissionMultiSelect } from "./permission-multiselect";

const meta: Meta<typeof PermissionMultiSelect> = {
  title: "UI/PermissionMultiSelect",
  component: PermissionMultiSelect,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    fullWidth: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof PermissionMultiSelect>;

export const Default: Story = {
  render: () => {
    const [permissions, setPermissions] = useState<string[]>(["read:punches"]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <PermissionMultiSelect
          values={permissions}
          onChange={(v) => {
            setPermissions(v);
            fn()(v);
          }}
          placeholder="Select permissions…"
        />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => {
    const [permissions, setPermissions] = useState<string[]>([]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <PermissionMultiSelect
          values={permissions}
          onChange={setPermissions}
          placeholder="Select permissions…"
        />
      </div>
    );
  },
};

export const FullWidth: Story = {
  render: () => {
    const [permissions, setPermissions] = useState<string[]>(["write:users"]);
    return (
      <div style={{ padding: 20 }}>
        <PermissionMultiSelect
          values={permissions}
          onChange={setPermissions}
          placeholder="Select permissions…"
          fullWidth
        />
      </div>
    );
  },
};

export const ManyPermissions: Story = {
  render: () => {
    const [permissions, setPermissions] = useState<string[]>([
      "read:punches",
      "write:punches",
      "read:devices",
      "read:users",
      "write:users",
      "read:reports",
    ]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <PermissionMultiSelect
          values={permissions}
          onChange={setPermissions}
          placeholder="Select permissions…"
        />
      </div>
    );
  },
};
