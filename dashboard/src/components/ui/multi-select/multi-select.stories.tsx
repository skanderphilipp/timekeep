import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { useState } from "react";
import { MultiSelect, type MultiSelectOption } from "./multi-select";

const sampleOptions: MultiSelectOption[] = [
  { value: "read:punches", label: "Read Punches" },
  { value: "write:punches", label: "Write Punches" },
  { value: "read:devices", label: "Read Devices" },
  { value: "write:devices", label: "Write Devices" },
  { value: "read:users", label: "Read Users" },
  { value: "write:users", label: "Write Users" },
  { value: "read:reports", label: "Read Reports" },
  { value: "write:reports", label: "Write Reports" },
  { value: "admin:settings", label: "Admin Settings" },
  { value: "admin:apikeys", label: "Admin API Keys" },
];

/**
 * MultiSelect — dropdown for selecting multiple options.
 *
 * Used for column visibility toggles (FilterBar), permission
 * selection (API keys), and multi-value filters.
 */
const meta: Meta<typeof MultiSelect> = {
  title: "UI/Inputs/MultiSelect",
  component: MultiSelect,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    searchPlaceholder: { control: "text" },
    emptyMessage: { control: "text" },
    loading: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

export const Primary: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>(["read:punches"]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <MultiSelect
          options={sampleOptions}
          values={values}
          onChange={(v) => { setValues(v); fn()(v); }}
          placeholder="Select permissions…"
          searchPlaceholder="Search…"
          emptyMessage="No results found"
        />
      </div>
    );
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)", padding: 20 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Empty — nothing selected</p>
          <MultiSelect options={sampleOptions} values={[]} onChange={fn()} placeholder="Nothing selected…" />
        </div>
        <div>
          <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>With selections (3 items)</p>
          <MultiSelect
            options={sampleOptions}
            values={["read:punches", "write:punches", "read:devices"]}
            onChange={fn()}
            placeholder="Select…"
          />
        </div>
        <div>
          <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Many selected (5+ items)</p>
          <MultiSelect
            options={sampleOptions}
            values={["read:punches", "write:punches", "read:devices", "read:users", "read:reports"]}
            onChange={fn()}
            placeholder="Select…"
          />
        </div>
        <div>
          <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>Loading state</p>
          <MultiSelect options={[]} values={[]} onChange={fn()} placeholder="Loading options…" loading />
        </div>
      </div>
    );
  },
};

export const ContextColumnVisibility: Story = {
  name: "Context: Column Visibility",
  parameters: { controls: { disable: true } },
  render: () => {
    const [cols, setCols] = useState(["time", "employee", "device", "status"]);
    return (
      <div style={{ padding: 20, maxWidth: 300 }}>
        <MultiSelect
          options={[
            { value: "time", label: "Time" },
            { value: "employee", label: "Employee" },
            { value: "device", label: "Device" },
            { value: "status", label: "Status" },
            { value: "method", label: "Method" },
          ]}
          values={cols}
          onChange={setCols}
          placeholder="Columns"
        />
      </div>
    );
  },
};
