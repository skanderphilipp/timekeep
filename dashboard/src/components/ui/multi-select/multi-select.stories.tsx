import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
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

const meta: Meta<typeof MultiSelect> = {
  title: "UI/MultiSelect",
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

function MultiSelectStory(args: Partial<typeof MultiSelect>) {
  const [values, setValues] = useState<string[]>(["read:punches"]);
  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <MultiSelect
        options={sampleOptions}
        values={values}
        onChange={(v) => {
          setValues(v);
          fn()(v);
        }}
        placeholder="Select permissions…"
        searchPlaceholder="Search…"
        emptyMessage="No results found"
        {...(args as any)}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <MultiSelectStory />,
};

export const Empty: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>([]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <MultiSelect
          options={sampleOptions}
          values={values}
          onChange={setValues}
          placeholder="Nothing selected…"
        />
      </div>
    );
  },
};

export const ManySelected: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>([
      "read:punches",
      "write:punches",
      "read:devices",
      "read:users",
      "read:reports",
    ]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <MultiSelect
          options={sampleOptions}
          values={values}
          onChange={setValues}
          placeholder="Select…"
        />
      </div>
    );
  },
};

export const Loading: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>([]);
    return (
      <div style={{ padding: 20, maxWidth: 400 }}>
        <MultiSelect
          options={[]}
          values={values}
          onChange={setValues}
          placeholder="Loading options…"
          loading
        />
      </div>
    );
  },
};
