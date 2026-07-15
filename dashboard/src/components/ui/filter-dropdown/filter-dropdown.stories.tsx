import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import {
  IconDeviceDesktop,
  IconStatusChange,
  IconCalendar,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { FilterDropdown, type FilterField } from "./filter-dropdown";
import { FilterBar } from "@/components/ui/filter-bar";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";

// ── Field definitions ──────────────────────────────────────────────────────

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
    // onApply is unused in this story — the Combobox manages its own state
    renderValueSelector: ({ onApply: _onApply }) => (
      <Combobox
        options={deviceOptions}
        value=""
        onChange={fn()}
        placeholder="Device"
        searchable={deviceOptions.length > 8}
      />
    ),
  },
  {
    key: "status",
    label: "Status",
    icon: <IconStatusChange size={14} />,
    renderValueSelector: ({ onApply: _onApply }) => (
      <Combobox
        options={statusOptions}
        value=""
        onChange={fn()}
        placeholder="Status"
        searchable={statusOptions.length > 8}
      />
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
      <Switch checked={false} onCheckedChange={fn()} label="Show only anomalous punches" />
    ),
  },
];

// ── Meta ───────────────────────────────────────────────────────────────────

/**
 * FilterDropdown — "+ Filter" button + popover for building filters.
 *
 * **Always used inside a `<FilterBar>`** which provides the toolbar layout
 * (search, count, reset, actions, chips). FilterDropdown only handles the
 * filter-building popover UI.
 */
const meta: Meta<typeof FilterDropdown> = {
  title: "UI/Inputs/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FilterDropdown>;

// ── Stories ────────────────────────────────────────────────────────────────

export const Standalone: Story = {
  name: "Button only (standalone)",
  args: { fields },
};

export const InsideFilterBarNoFilters: Story = {
  name: "Inside FilterBar — no active filters",
  parameters: { controls: { disable: true } },
  render: () => (
    <FilterBar>
      <FilterDropdown fields={fields} />
    </FilterBar>
  ),
};

export const InsideFilterBarWithSearch: Story = {
  name: "Inside FilterBar — with search",
  parameters: { controls: { disable: true } },
  render: () => (
    <FilterBar search={<input placeholder="Search punches…" style={{ width: 200, height: 32, borderRadius: "var(--ao-radius-md)", border: "1px solid var(--ao-border-color-medium)", padding: "0 12px", fontSize: "var(--ao-font-size-sm)", background: "var(--ao-background-primary)" }} readOnly />}>
      <FilterDropdown fields={fields} />
    </FilterBar>
  ),
};

export const InsideFilterBarFullToolbar: Story = {
  name: "Inside FilterBar — full toolbar",
  parameters: { controls: { disable: true } },
  render: function FullToolbar() {
    const [active, setActive] = useState(false);
    const chips = active
      ? [
          { key: "device", label: "Device: Main Gate", onRemove: () => setActive(false) },
          { key: "status", label: "Status: Check In", onRemove: () => setActive(false) },
        ]
      : [];

    return (
      <FilterBar
        resultCount={42}
        hasActiveFilters={active}
        activeFilters={chips}
        onClear={() => setActive(false)}
      >
        <FilterDropdown fields={fields} />
      </FilterBar>
    );
  },
};
