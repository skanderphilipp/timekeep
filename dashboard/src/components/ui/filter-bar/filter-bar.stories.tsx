import { type Meta, type StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { IconFilter } from "@tabler/icons-react";

import { FilterBar } from "./filter-bar";
import { SearchInput } from "@/components/ui/search-input/search-input";
import { FilterDropdown } from "@/components/ui/filter-dropdown/filter-dropdown";

import type { FilterChip } from "@/components/ui/filter-chips";
import type { FilterField } from "@/components/ui/filter-dropdown/filter-dropdown";

/**
 * FilterBar — the single toolbar layout for all list pages.
 *
 * Slots:
 *   search      — SearchInput (renders inline in the toolbar)
 *   children    — inline filter controls (Combobox, FilterDropdown, DatePicker)
 *   actions     — right-side actions (column selector, export)
 *   onClear     — reset all filters
 *   activeFilters — chip data (passed to FilterChips)
 *   resultCount — "N results" badge
 *   sticky      — stick to top on scroll
 *
 * **FilterDropdown goes inside FilterBar as a child**, not as a standalone
 * replacement. FilterBar owns the toolbar; FilterDropdown provides the
 * "+ Filter" popover UI.
 */
const meta: Meta<typeof FilterBar> = {
  title: "UI/FilterBar",
  component: FilterBar,
};

export default meta;
type Story = StoryObj<typeof FilterBar>;

// ── Helpers ────────────────────────────────────────────────────────────────────

const sampleFields: FilterField[] = [
  {
    key: "device",
    label: "Device",
    icon: <IconFilter size={14} />,
    renderValueSelector: ({ onApply, onBack }) => (
      <div style={{ padding: "8px" }}>
        <p style={{ margin: 0, fontSize: "13px" }}>Device filter panel</p>
        <button onClick={onApply} style={{ marginTop: "8px" }}>
          Apply
        </button>
        <button onClick={onBack} style={{ marginTop: "8px", marginLeft: "8px" }}>
          Back
        </button>
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    renderValueSelector: ({ onApply, onBack }) => (
      <div style={{ padding: "8px" }}>
        <p style={{ margin: 0, fontSize: "13px" }}>Status filter panel</p>
        <button onClick={onApply} style={{ marginTop: "8px" }}>
          Apply
        </button>
        <button onClick={onBack} style={{ marginTop: "8px", marginLeft: "8px" }}>
          Back
        </button>
      </div>
    ),
  },
];

const sampleChips: FilterChip[] = [
  { key: "chip-1", label: "Device: Main Entrance", onRemove: () => {} },
  { key: "chip-2", label: "Status: Late", onRemove: () => {} },
];

// ── Stories ────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty — no filters",
  render: () => (
    <FilterBar>
      <span style={{ color: "var(--ao-font-color-tertiary)", fontSize: "13px" }}>
        No filters applied
      </span>
    </FilterBar>
  ),
};

export const WithSearch: Story = {
  name: "With search",
  render: () => {
    const [query, setQuery] = useState("");
    return (
      <FilterBar search={<SearchInput value={query} onChange={setQuery} debounceMs={300} />}>
        <span style={{ color: "var(--ao-font-color-tertiary)", fontSize: "13px" }}>
          Search across records
        </span>
      </FilterBar>
    );
  },
};

export const WithFilterDropdown: Story = {
  name: "With FilterDropdown (child)",
  render: () => (
    <FilterBar>
      <FilterDropdown fields={sampleFields} />
    </FilterBar>
  ),
};

export const WithFiltersAndChips: Story = {
  name: "Full toolbar — search + dropdown + chips + count",
  render: () => {
    const [query, setQuery] = useState("");
    return (
      <FilterBar
        search={<SearchInput value={query} onChange={setQuery} debounceMs={300} />}
        activeFilters={sampleChips}
        resultCount={42}
        hasActiveFilters
        onClear={() => {}}
      >
        <FilterDropdown fields={sampleFields} />
      </FilterBar>
    );
  },
};

export const Sticky: Story = {
  name: "Sticky variant",
  render: () => {
    const [query, setQuery] = useState("");
    return (
      <div style={{ height: "200px", overflow: "auto" }}>
        <FilterBar
          sticky
          search={<SearchInput value={query} onChange={setQuery} debounceMs={300} />}
          activeFilters={sampleChips}
          resultCount={42}
          hasActiveFilters
          onClear={() => {}}
        >
          <FilterDropdown fields={sampleFields} />
        </FilterBar>
        <div style={{ padding: "16px", height: "400px" }}>
          <p>Scroll down to test sticky behaviour</p>
        </div>
      </div>
    );
  },
};
