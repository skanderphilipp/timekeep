import type { Meta, StoryObj } from "@storybook/react";
import { CalendarMonth } from "./calendar-month";
import type { CalendarDayStatus } from "./calendar-month.utils";

/**
 * Generate mock attendance data for a month.
 * 70% full, 10% half, 8% late, 5% absent, rest weekend.
 */
function mockDayStatus(
  year: number,
  month: number,
): Record<string, { status: CalendarDayStatus; hours?: number | null }> {
  const data: Record<string, { status: CalendarDayStatus; hours?: number | null }> = {};
  const lastDay = new Date(year, month, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (isWeekend) {
      data[key] = { status: "weekend" as const, hours: null };
    } else {
      const roll = Math.random();
      let status: CalendarDayStatus;
      let hours: number | null;

      if (roll < 0.7) {
        status = "full";
        hours = Math.round((7.5 + Math.random() * 1.5) * 10) / 10;
      } else if (roll < 0.8) {
        status = "half";
        hours = Math.round((4.0 + Math.random() * 2.0) * 10) / 10;
      } else if (roll < 0.88) {
        status = "late";
        hours = Math.round((7.0 + Math.random() * 1.5) * 10) / 10;
      } else {
        status = "absent";
        hours = null;
      }

      data[key] = { status, hours };
    }
  }

  return data;
}

const julyData = mockDayStatus(2026, 7);

const meta: Meta<typeof CalendarMonth> = {
  title: "UI/Data Display/CalendarMonth",
  component: CalendarMonth,
  tags: ["autodocs"],
  argTypes: {
    weekStartsOn: { control: "select", options: [0, 1] },
  },
};

export default meta;
type Story = StoryObj<typeof CalendarMonth>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    year: 2026,
    month: 7,
    dayStatus: julyData,
  },
};

// ── Variants ──────────────────────────────────────────────────────────────

export const SundayStart: Story = {
  name: "Week Starts Sunday",
  args: {
    year: 2026,
    month: 7,
    weekStartsOn: 0,
    dayStatus: julyData,
  },
};

export const WithSelection: Story = {
  name: "With Selected Day",
  args: {
    year: 2026,
    month: 7,
    dayStatus: julyData,
    selectedDate: "2026-07-15",
  },
};

export const NoData: Story = {
  name: "No Status Data (defaults)",
  render: () => <CalendarMonth year={2026} month={7} />,
};

export const PerfectAttendance: Story = {
  name: "Perfect Attendance",
  render: () => {
    const perfect: Record<string, { status: CalendarDayStatus; hours?: number | null }> = {};
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 6, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const key = `2026-07-${String(d).padStart(2, "0")}`;
      perfect[key] = {
        status: isWeekend ? "weekend" : "full",
        hours: isWeekend ? null : 8.0 + Math.random() * 0.5,
      };
    }
    return <CalendarMonth year={2026} month={7} dayStatus={perfect} />;
  },
};

export const ProblematicAttendance: Story = {
  name: "Problematic Attendance",
  render: () => {
    const bad: Record<string, { status: CalendarDayStatus; hours?: number | null }> = {};
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 6, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const key = `2026-07-${String(d).padStart(2, "0")}`;
      if (isWeekend) {
        bad[key] = { status: "weekend", hours: null };
      } else {
        const roll = Math.random();
        if (roll < 0.35) bad[key] = { status: "full", hours: 8.0 };
        else if (roll < 0.5) bad[key] = { status: "late", hours: 7.5 };
        else if (roll < 0.65) bad[key] = { status: "half", hours: 5.0 };
        else bad[key] = { status: "absent", hours: null };
      }
    }
    return <CalendarMonth year={2026} month={7} dayStatus={bad} />;
  },
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  args: {
    year: 2026,
    month: 7,
    isLoading: true,
  },
};

export const ErrorState: Story = {
  name: "Error State",
  args: {
    year: 2026,
    month: 7,
    error: new Error("Failed to fetch attendance data — the API may be unreachable."),
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    year: 2026,
    month: 8,
    isEmpty: true,
  },
};

// ── Interactive ───────────────────────────────────────────────────────────

export const Clickable: Story = {
  name: "Clickable Days",
  args: {
    year: 2026,
    month: 7,
    dayStatus: julyData,
    selectedDate: "2026-07-01",
    onDayClick: (day) => {
      alert(`${day.date}\nStatus: ${day.status}\nHours: ${day.hours ?? "—"}`);
    },
  },
};
