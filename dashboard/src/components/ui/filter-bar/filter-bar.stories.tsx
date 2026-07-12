import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterBar, type ActiveFilter } from "./filter-bar";
import { FilterInput } from "@/components/ui/filter-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";

const sampleFilters: ActiveFilter[] = [
  { key: "device", label: "Device: Main Gate", onRemove: fn() },
  { key: "status", label: "Status: Check In", onRemove: fn() },
  { key: "date", label: "From: 2026-07-01", onRemove: fn() },
];

/**
 * FilterBar — top-level search + filter controls for list pages.
 *
 * Used on Punches, Reports, Audit Logs, and Employee Directory pages.
 * Supports search input, filter dropdowns, active filter chips, result count,
 * column visibility toggles, and sticky positioning.
 */
const meta: Meta<typeof FilterBar> = {
  title: "UI/Inputs/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  argTypes: {
    sticky: { control: "boolean" },
    resultCount: { control: "number" },
    hasActiveFilters: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof FilterBar>;

export const Primary: Story = {
  args: {
    search: <FilterInput placeholder="Search by employee name or PIN…" value="" onChange={fn()} />,
    children: (
      <>
        <FilterSelect
          label="Status"
          value=""
          options={[
            { value: "", label: "All Statuses" },
            { value: "check_in", label: "Check In" },
            { value: "check_out", label: "Check Out" },
            { value: "break_out", label: "Break Out" },
            { value: "break_in", label: "Break In" },
          ]}
          onChange={fn()}
        />
      </>
    ),
    resultCount: 128,
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-8)" }}>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Simple Search
        </p>
        <FilterBar>
          <FilterInput placeholder="Search…" value="" onChange={fn()} />
        </FilterBar>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          With Result Count
        </p>
        <FilterBar resultCount={42}>
          <FilterInput placeholder="Search…" value="" onChange={fn()} />
        </FilterBar>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          With Active Filters
        </p>
        <FilterBar
          search={<FilterInput placeholder="Search by name or PIN…" value="145" onChange={fn()} />}
          activeFilters={sampleFilters}
          hasActiveFilters
          onClear={fn()}
          resultCount={12}
        >
          <FilterSelect
            label="Status"
            value="check_in"
            options={[
              { value: "", label: "All" },
              { value: "check_in", label: "Check In" },
            ]}
            onChange={fn()}
          />
        </FilterBar>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          With Column Toggle
        </p>
        <FilterBar
          actions={
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
          }
          resultCount={128}
        >
          <FilterInput placeholder="Search…" value="" onChange={fn()} />
        </FilterBar>
      </div>
    </div>
  ),
};

export const ContextPunchesFilter: Story = {
  name: "Context: Punches Page Filter",
  parameters: { controls: { disable: true } },
  render: () => (
    <FilterBar
      search={
        <FilterInput placeholder="Search by employee name or PIN…" value="" onChange={fn()} />
      }
      activeFilters={[sampleFilters[0], sampleFilters[1]]}
      hasActiveFilters
      onClear={fn()}
      resultCount={42}
    >
      <FilterSelect
        label="Device"
        value=""
        options={[
          { value: "", label: "All Devices" },
          { value: "CQZ7232960836", label: "Main Gate" },
          { value: "BKW8471209384", label: "Warehouse B" },
        ]}
        onChange={fn()}
      />
      <FilterSelect
        label="Status"
        value=""
        options={[
          { value: "", label: "All Statuses" },
          { value: "check_in", label: "Check In" },
          { value: "check_out", label: "Check Out" },
          { value: "break_out", label: "Break Out" },
          { value: "break_in", label: "Break In" },
        ]}
        onChange={fn()}
      />
      <Switch checked={false} label="Show only anomalies" onCheckedChange={fn()} />
    </FilterBar>
  ),
};
