import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import {
  IconDeviceDesktop,
  IconStatusChange,
  IconCalendar,
  IconAlertTriangle,
} from "@tabler/icons-react";

import { FilterDropdown } from "./filter-dropdown";
import { FilterSelect } from "@/components/ui/filter-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Toggle } from "@/components/ui/toggle";
import { MultiSelect } from "@/components/ui/multi-select";
import type { FilterChip, FilterField } from "./filter-dropdown";

// ── Sample data ───────────────────────────────────────────────────────────────

const deviceOptions = [
  { value: "", label: "All Devices" },
  { value: "DEV-001", label: "Main Gate" },
  { value: "DEV-002", label: "Warehouse" },
  { value: "DEV-003", label: "Back Office" },
];

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "check_in", label: "Check In" },
  { value: "check_out", label: "Check Out" },
  { value: "break_out", label: "Break Out" },
  { value: "break_in", label: "Break In" },
];

const fields: FilterField[] = [
  {
    key: "device",
    label: "Device",
    icon: <IconDeviceDesktop size={14} />,
    renderValueSelector: () => (
      <FilterSelect
        options={deviceOptions}
        value=""
        onChange={fn()}
        label="Device"
      />
    ),
  },
  {
    key: "status",
    label: "Status",
    icon: <IconStatusChange size={14} />,
    renderValueSelector: () => (
      <FilterSelect
        options={statusOptions}
        value=""
        onChange={fn()}
        label="Status"
      />
    ),
  },
  {
    key: "date",
    label: "Date range",
    icon: <IconCalendar size={14} />,
    renderValueSelector: () => (
      <DatePicker
        mode="range"
        value={null}
        onChange={fn()}
        placeholder="Select date range…"
      />
    ),
  },
  {
    key: "anomalies",
    label: "Anomalies only",
    icon: <IconAlertTriangle size={14} />,
    renderValueSelector: () => (
      <Toggle checked={false} onChange={fn()} label="Show only anomalous punches" />
    ),
  },
];

const sampleChips: FilterChip[] = [
  { key: "device", label: "Device: Main Gate", onRemove: fn() },
  { key: "status", label: "Status: Check In", onRemove: fn() },
  { key: "date", label: "From: 2026-07-01", onRemove: fn() },
];

const meta: Meta<typeof FilterDropdown> = {
  title: "UI/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
  argTypes: {
    hasActiveFilters: { control: "boolean" },
    resultCount: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof FilterDropdown>;

// ── Stories ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    fields,
  },
};

export const WithActiveFilters: Story = {
  args: {
    fields,
    activeFilters: sampleChips,
    hasActiveFilters: true,
    onClear: fn(),
    resultCount: 12,
  },
};

export const WithCount: Story = {
  args: {
    fields,
    resultCount: 128,
  },
};

export const WithActions: Story = {
  args: {
    fields,
    activeFilters: sampleChips,
    hasActiveFilters: true,
    onClear: fn(),
    resultCount: 42,
    actions: (
      <MultiSelect
        options={[
          { value: "time", label: "Time" },
          { value: "employee", label: "Employee" },
          { value: "device", label: "Device" },
        ]}
        values={["time", "employee", "device"]}
        onChange={fn()}
        placeholder="Columns"
      />
    ),
  },
};

export const PopoverOpen: Story = {
  args: {
    fields,
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector("button") as HTMLButtonElement;
    if (button) button.click();
  },
};

export const SingleField: Story = {
  args: {
    fields: [fields[0]],
    activeFilters: [sampleChips[0]],
    hasActiveFilters: true,
    onClear: fn(),
  },
};

export const NoResults: Story = {
  args: {
    fields,
    resultCount: 0,
    activeFilters: sampleChips,
    hasActiveFilters: true,
    onClear: fn(),
  },
};
