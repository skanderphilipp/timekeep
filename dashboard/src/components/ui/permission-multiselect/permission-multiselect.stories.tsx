import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { useState } from "react";
import { PermissionMultiSelect } from "./permission-multiselect";

/**
 * PermissionMultiSelect — specialized MultiSelect for API permissions.
 *
 * Pre-loaded with all available permission scopes. Used in API key
 * creation dialogs and user role management.
 */
const meta: Meta<typeof PermissionMultiSelect> = {
  title: "UI/Inputs/PermissionMultiSelect",
  component: PermissionMultiSelect,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    fullWidth: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof PermissionMultiSelect>;

export const Primary: Story = {
  render: () => {
    const [permissions, setPermissions] = useState<string[]>(["read:punches"]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <PermissionMultiSelect
          values={permissions}
          onChange={(v) => { setPermissions(v); fn()(v); }}
          placeholder="Select permissions…"
        />
      </div>
    );
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", padding: 20 }}>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Empty — no permissions selected</p>
        <PermissionMultiSelect values={[]} onChange={fn()} placeholder="Select permissions…" />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Few permissions</p>
        <PermissionMultiSelect values={["read:punches"]} onChange={fn()} placeholder="Select permissions…" />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Many permissions (6 items)</p>
        <PermissionMultiSelect
          values={["read:punches", "write:punches", "read:devices", "read:users", "write:users", "read:reports"]}
          onChange={fn()}
          placeholder="Select permissions…"
        />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Full width</p>
        <PermissionMultiSelect values={["write:users"]} onChange={fn()} placeholder="Select permissions…" fullWidth />
      </div>
    </div>
  ),
};

export const ContextApiKeyCreation: Story = {
  name: "Context: API Key Creation",
  parameters: { controls: { disable: true } },
  render: () => {
    const [permissions, setPermissions] = useState(["read:punches"]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Scoped Permissions</p>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 12 }}>
          Select which resources this API key can access.
        </p>
        <PermissionMultiSelect
          values={permissions}
          onChange={setPermissions}
          placeholder="Select permissions…"
        />
      </div>
    );
  },
};
