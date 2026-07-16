import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterDateRange } from "./filter-date-range";

const meta: Meta<typeof FilterDateRange> = {
  title: "UI/Inputs/FilterDateRange",
  component: FilterDateRange,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof FilterDateRange>;

function PrimaryDemo() {
  const [value, setValue] = useState("");
  return (
    <div style={{ padding: 20 }}>
      <FilterDateRange label="Date range" value={value} onChange={setValue} />
      <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginTop: 12 }}>
        Value: {value || "(none)"}
      </div>
    </div>
  );
}

export const Primary: Story = {
  render: () => <PrimaryDemo />,
};

export const Playground: Story = {
  args: { label: "Date range", value: "", onChange: fn() },
};
