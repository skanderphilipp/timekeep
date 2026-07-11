import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterSelect } from "./filter-select";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "check_in", label: "Check In" },
  { value: "check_out", label: "Check Out" },
  { value: "break_out", label: "Break Out" },
];
const deviceOptions = [
  { value: "", label: "All Devices" },
  { value: "DEV-001", label: "Main Gate" },
  { value: "DEV-002", label: "Warehouse B" },
];

const meta: Meta<typeof FilterSelect> = {
  title: "UI/Inputs/FilterSelect",
  component: FilterSelect,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FilterSelect>;

export const Primary: Story = {
  args: { label: "Status", value: "", options: statusOptions, onChange: fn() },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: "var(--ao-spacing-2)", padding: 20 }}>
      <FilterSelect label="Status" value="check_in" options={statusOptions} onChange={fn()} />
      <FilterSelect label="Device" value="" options={deviceOptions} onChange={fn()} />
    </div>
  ),
};
