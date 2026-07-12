import type { Meta, StoryObj } from "@storybook/react";
import { CalendarChart, type CalendarDay, type CalendarDayStatus } from "./CalendarChart";
import { Chart } from "./chart";

/**
 * Generate a month of attendance data with proper status codes.
 *
 * Weekends: status 0 (weekend), hours null
 * Weekdays: randomly distributed statuses with realistic hours
 */
function generateMonthData(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (isWeekend) {
      days.push({ day: iso, value: 0, hours: null, status: "weekend" });
    } else {
      // Simulate realistic attendance pattern
      const roll = Math.random();
      let status: CalendarDayStatus;
      let value: number;
      let hours: number | null;

      if (roll < 0.70) {
        // 70% of days: full attendance
        status = "full";
        value = 4;
        hours = Math.round((7.5 + Math.random() * 1.5) * 10) / 10; // 7.5–9.0h
      } else if (roll < 0.85) {
        // 15%: half day
        status = "half";
        value = 3;
        hours = Math.round((4.0 + Math.random() * 2.0) * 10) / 10; // 4.0–6.0h
      } else if (roll < 0.92) {
        // 7%: late
        status = "late";
        value = 2;
        hours = Math.round((7.0 + Math.random() * 1.5) * 10) / 10; // present but late
      } else {
        // 8%: absent
        status = "absent";
        value = 1;
        hours = null;
      }

      days.push({ day: iso, value, hours, status });
    }
  }
  return days;
}

const julyData = generateMonthData(2026, 6); // July 2026

const meta: Meta<typeof CalendarChart> = {
  title: "UI/Charts/CalendarChart",
  component: CalendarChart,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CalendarChart>;

// ── Primary ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Chart
      title="Attendance Calendar — July 2026"
      description="Green = full day, amber = late, red = absent, gray = weekend. Click a day to see punches."
    >
      <CalendarChart data={julyData} from="2026-07-01" to="2026-07-31" height={300} />
    </Chart>
  ),
};

// ── Variants ──────────────────────────────────────────────────────────────

export const PerfectAttendance: Story = {
  name: "Perfect Attendance",
  render: () => {
    const perfectData: CalendarDay[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 6, d); // July
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const iso = `2026-07-${String(d).padStart(2, "0")}`;
      perfectData.push({
        day: iso,
        value: isWeekend ? 0 : 4,
        hours: isWeekend ? null : 8.0 + Math.random() * 0.5,
        status: isWeekend ? "weekend" : "full",
      });
    }
    return (
      <Chart
        title="Perfect Attendance — July 2026"
        description="All weekdays are green. This employee is reliable."
      >
        <CalendarChart data={perfectData} from="2026-07-01" to="2026-07-31" height={300} />
      </Chart>
    );
  },
};

export const ProblematicAttendance: Story = {
  name: "Problematic Attendance",
  render: () => {
    const badData: CalendarDay[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 6, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const iso = `2026-07-${String(d).padStart(2, "0")}`;
      if (isWeekend) {
        badData.push({ day: iso, value: 0, hours: null, status: "weekend" });
      } else {
        const roll = Math.random();
        let status: CalendarDayStatus;
        let value: number;
        let hours: number | null;
        if (roll < 0.35) {
          status = "full";
          value = 4;
          hours = 8.0;
        } else if (roll < 0.50) {
          status = "late";
          value = 2;
          hours = 7.5;
        } else if (roll < 0.70) {
          status = "half";
          value = 3;
          hours = 5.0;
        } else {
          status = "absent";
          value = 1;
          hours = null;
        }
        badData.push({ day: iso, value, hours, status });
      }
    }
    return (
      <Chart
        title="Problematic Attendance — July 2026"
        description="This employee frequently arrives late or is absent."
      >
        <CalendarChart data={badData} from="2026-07-01" to="2026-07-31" height={300} />
      </Chart>
    );
  },
};

// ── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading State",
  render: () => (
    <Chart title="Attendance Calendar — July 2026" description="Fetching calendar data…" isLoading>
      <CalendarChart data={julyData} from="2026-07-01" to="2026-07-31" height={300} />
    </Chart>
  ),
};

export const ErrorState: Story = {
  name: "Error State",
  render: () => (
    <Chart
      title="Attendance Calendar — July 2026"
      description="Could not load calendar data."
      error={new globalThis.Error("Employee not found — they may have been deleted.")}
    >
      <CalendarChart data={julyData} from="2026-07-01" to="2026-07-31" height={300} />
    </Chart>
  ),
};

export const EmptyMonth: Story = {
  name: "Empty Month (no data)",
  render: () => (
    <Chart title="Attendance Calendar — August 2026" description="No attendance data yet." isEmpty>
      <CalendarChart data={[]} from="2026-08-01" to="2026-08-31" height={300} />
    </Chart>
  ),
};

// ── Interaction ───────────────────────────────────────────────────────────

export const WithOnClick: Story = {
  name: "Interactive (onClick)",
  render: () => (
    <Chart title="Click a day to see details">
      <CalendarChart
        data={julyData}
        from="2026-07-01"
        to="2026-07-31"
        height={300}
        onClick={(day) => {
          alert(`${day.day}\nStatus: ${day.status}\nHours: ${day.hours ?? "—"}`);
        }}
      />
    </Chart>
  ),
};

// ── Responsive ────────────────────────────────────────────────────────────

export const NarrowContainer: Story = {
  name: "Narrow Container (360px)",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Chart title="Attendance Calendar" description="Fits in mobile viewport.">
        <CalendarChart data={julyData} from="2026-07-01" to="2026-07-31" height={250} />
      </Chart>
    </div>
  ),
};
