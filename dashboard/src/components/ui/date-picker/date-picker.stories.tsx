import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect } from "storybook/test";
import { DatePicker } from "./date-picker";

const meta: Meta<typeof DatePicker> = {
  title: "UI/Inputs/DatePicker",
  component: DatePicker,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

// ── Interactive Single Date ─────────────────────────────────────────────

function SingleDateDemo() {
  const [date, setDate] = useState<Date | null>(new Date("2026-07-11"));
  return (
    <div style={{ padding: 20 }}>
      <DatePicker value={date} onChange={setDate} placeholder="Select date…" />
      <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginTop: 12 }}>
        Selected: {date?.toISOString().split("T")[0] ?? "none"}
      </div>
    </div>
  );
}

export const Primary: Story = {
  render: () => <SingleDateDemo />,
};

// ── Play-tested Single Date ─────────────────────────────────────────────

export const WithPlayTest: Story = {
  render: () => <SingleDateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open the calendar by clicking the display text
    const display = canvas.getByText("2026-07-11");
    await userEvent.click(display);

    // Wait for calendar gridcells to appear
    const day15 = await canvas.findByRole("gridcell", {
      name: /Choose Wednesday, July 15th/,
    });
    await userEvent.click(day15);

    // Verify the selection updated
    await expect(canvas.getByText("Selected: 2026-07-15")).toBeVisible();
  },
};

// ── Interactive Range ───────────────────────────────────────────────────

function RangeDemo() {
  const [from, setFrom] = useState<Date | null>(new Date("2026-07-01"));
  const [to, setTo] = useState<Date | null>(new Date("2026-07-11"));
  return (
    <div style={{ padding: 20 }}>
      <DatePicker
        mode="range"
        value={from}
        endValue={to}
        onChange={(d, e) => {
          setFrom(d);
          if (e !== undefined) setTo(e);
        }}
      />
      <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginTop: 12 }}>
        {from?.toISOString().split("T")[0] ?? "?"} – {to?.toISOString().split("T")[0] ?? "?"}
      </div>
    </div>
  );
}

export const Range: Story = {
  render: () => <RangeDemo />,
};

// ── All Variants (visual reference with live interactions) ─────────────

function AllVariantsDemo() {
  const [single, setSingle] = useState<Date | null>(new Date("2026-07-11"));
  const [noDate, setNoDate] = useState<Date | null>(null);
  const [from, setFrom] = useState<Date | null>(new Date("2026-07-01"));
  const [to, setTo] = useState<Date | null>(new Date("2026-07-11"));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div>
        <p style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginBottom: 8 }}>
          Single date — selected
        </p>
        <DatePicker value={single} onChange={setSingle} />
      </div>
      <div>
        <p style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginBottom: 8 }}>
          Single date — empty
        </p>
        <DatePicker value={noDate} onChange={setNoDate} placeholder="Pick a date…" />
      </div>
      <div>
        <p style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginBottom: 8 }}>
          Range mode
        </p>
        <DatePicker
          mode="range"
          value={from}
          endValue={to}
          onChange={(d, e) => {
            setFrom(d);
            if (e !== undefined) setTo(e);
          }}
        />
      </div>
    </div>
  );
}

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => <AllVariantsDemo />,
};

// ── Playground (all props via Storybook controls) ───────────────────────

export const Playground: Story = {
  args: {
    value: new Date("2026-07-11"),
    onChange: fn(),
    placeholder: "Select date…",
    clearable: true,
  },
};
