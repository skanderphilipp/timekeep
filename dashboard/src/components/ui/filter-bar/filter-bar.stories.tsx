import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { FilterBar } from "./filter-bar";
import { FilterInput } from "@/components/ui/filter-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { MultiSelect } from "@/components/ui/multi-select";
import type { ActiveFilter } from "./filter-bar";

const sampleFilters: ActiveFilter[] = [
  { key: "pin", label: "PIN: 145", onRemove: fn() },
  { key: "device", label: "SN: DEV-01", onRemove: fn() },
  { key: "date", label: "From: 2026-07-01", onRemove: fn() },
];

const meta: Meta<typeof FilterBar> = {
  title: "UI/FilterBar",
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

export const Default: Story = {
  args: {
    children: (
      <>
        <FilterInput placeholder="User PIN" value="" onChange={fn()} />
        <FilterInput placeholder="Device SN" value="" onChange={fn()} />
      </>
    ),
  },
};

export const WithSearch: Story = {
  args: {
    search: (
      <FilterInput placeholder="Search by employee name or PIN…" value="" onChange={fn()} />
    ),
    children: (
      <>
        <FilterInput placeholder="Device SN" value="" onChange={fn()} />
        <FilterSelect
          label="Status"
          value=""
          options={[
            { value: "", label: "All Statuses" },
            { value: "check_in", label: "Check In" },
            { value: "check_out", label: "Check Out" },
          ]}
          onChange={fn()}
        />
      </>
    ),
  },
};

export const WithResultCount: Story = {
  args: {
    children: (
      <>
        <FilterInput placeholder="User PIN" value="" onChange={fn()} />
      </>
    ),
    resultCount: 42,
  },
};

export const WithActions: Story = {
  args: {
    search: (
      <FilterInput placeholder="Search…" value="" onChange={fn()} />
    ),
    children: (
      <>
        <FilterInput placeholder="Device" value="" onChange={fn()} />
      </>
    ),
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
    resultCount: 128,
  },
};

export const WithActiveFilters: Story = {
  args: {
    search: (
      <FilterInput placeholder="Search by employee name or PIN…" value="145" onChange={fn()} />
    ),
    children: (
      <>
        <FilterInput placeholder="Device SN" value="" onChange={fn()} />
        <FilterSelect
          label="Status"
          value="check_in"
          options={[
            { value: "", label: "All Statuses" },
            { value: "check_in", label: "Check In" },
            { value: "check_out", label: "Check Out" },
          ]}
          onChange={fn()}
        />
      </>
    ),
    activeFilters: sampleFilters,
    hasActiveFilters: true,
    onClear: fn(),
    resultCount: 12,
  },
};

export const FullPunchTable: Story = {
  args: {
    search: (
      <FilterInput placeholder="Search by employee name or PIN…" value="" onChange={fn()} />
    ),
    children: (
      <>
        <FilterInput placeholder="Device SN" value="" onChange={fn()} />
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
    activeFilters: sampleFilters,
    hasActiveFilters: true,
    onClear: fn(),
    resultCount: 12,
  },
};

export const Sticky: Story = {
  args: {
    children: (
      <>
        <FilterInput placeholder="Search…" value="" onChange={fn()} />
      </>
    ),
    sticky: true,
  },
  decorators: [
    (Story) => (
      <div style={{ height: "300px", overflow: "auto" }}>
        <Story />
        <div style={{ height: "600px", padding: "16px" }}>
          <p>Scrollable content below the sticky filter bar.</p>
          {Array.from({ length: 20 }).map((_, i) => (
            <p key={i} style={{ color: "var(--ao-font-color-tertiary)", margin: "8px 0" }}>
              Row {i + 1} — the filter bar should remain visible while scrolling.
            </p>
          ))}
        </div>
      </div>
    ),
  ],
};

export const SimpleSearch: Story = {
  args: {
    children: (
      <>
        <FilterInput placeholder="Search actors, actions, resources…" value="" onChange={fn()} />
      </>
    ),
  },
};

export const MobileView: Story = {
  args: {
    children: (
      <>
        <FilterInput placeholder="PIN" value="" onChange={fn()} />
      </>
    ),
    activeFilters: [sampleFilters[0]],
    hasActiveFilters: true,
    onClear: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
