import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  IconDeviceDesktop,
  IconStatusChange,
  IconCalendar,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { FilterDropdown, type FilterChip, type FilterField } from "./filter-dropdown";
import { FilterSelect } from "@/components/ui/filter-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Toggle } from "@/components/ui/toggle";

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
      <FilterSelect options={deviceOptions} value="" onChange={fn()} label="Device" />
    ),
  },
  {
    key: "status",
    label: "Status",
    icon: <IconStatusChange size={14} />,
    renderValueSelector: () => (
      <FilterSelect options={statusOptions} value="" onChange={fn()} label="Status" />
    ),
  },
  {
    key: "date",
    label: "Date range",
    icon: <IconCalendar size={14} />,
    renderValueSelector: () => (
      <DatePicker mode="range" value={null} onChange={fn()} placeholder="Select date range…" />
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

/**
 * FilterDropdown — "Add Filter" button with popover of filter options.
 *
 * Used alongside FilterBar on list pages (Punches, Audit Logs).
 * Each filter field can render its own value selector (select, date picker, toggle).
 */
const meta: Meta<typeof FilterDropdown> = {
  title: "UI/Inputs/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
  argTypes: {
    hasActiveFilters: { control: "boolean" },
    resultCount: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof FilterDropdown>;

export const Primary: Story = {
  args: { fields },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          No active filters
        </p>
        <FilterDropdown fields={fields} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          With result count
        </p>
        <FilterDropdown fields={fields} resultCount={128} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Active filters + clear
        </p>
        <FilterDropdown
          fields={fields}
          activeFilters={sampleChips}
          hasActiveFilters
          onClear={fn()}
          resultCount={12}
        />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          No results
        </p>
        <FilterDropdown
          fields={fields}
          activeFilters={sampleChips}
          hasActiveFilters
          onClear={fn()}
          resultCount={0}
        />
      </div>
    </div>
  ),
};

export const ContextPunchesFilter: Story = {
  name: "Context: Punches Page Filters",
  parameters: { controls: { disable: true } },
  render: () => (
    <FilterDropdown
      fields={fields}
      activeFilters={sampleChips.slice(0, 2)}
      hasActiveFilters
      onClear={fn()}
      resultCount={42}
    />
  ),
};
