import type { Meta, StoryObj } from "@storybook/react";
import { EmployeeAttendanceLog } from "./employee-attendance-log";
import type { EmployeeWorkDays } from "@/lib/api";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

function dayDate(daysAgo: number): string {
  const d = new Date((NOW - daysAgo * DAY) * 1000);
  return d.toISOString().split("T")[0];
}

function period(checkInOffset: number, checkOutOffset: number, kind: string = "regular") {
  return {
    check_in: NOW - checkInOffset * DAY + 28800,
    check_out: NOW - checkOutOffset * DAY + 61200,
    duration_secs: 32400,
    kind,
  };
}

const mockWorkDays: EmployeeWorkDays = {
  user_pin: "145",
  work_days: [
    { date: dayDate(1), user_pin: "145", status: "present", total_regular_seconds: 28800, total_break_seconds: 1800, total_overtime_seconds: 3600, net_work_seconds: 30600, is_present_now: false, anomaly_count: 0, periods: [period(1, 1)] },
    { date: dayDate(2), user_pin: "145", status: "late", total_regular_seconds: 25200, total_break_seconds: 1800, total_overtime_seconds: 0, net_work_seconds: 23400, is_present_now: false, anomaly_count: 0, periods: [{ check_in: NOW - 2 * DAY + 30600, check_out: NOW - 2 * DAY + 61200, duration_secs: 30600, kind: "regular" }] },
    { date: dayDate(3), user_pin: "145", status: "absent", total_regular_seconds: 0, total_break_seconds: 0, total_overtime_seconds: 0, net_work_seconds: 0, is_present_now: false, anomaly_count: 1, periods: [] },
    { date: dayDate(4), user_pin: "145", status: "present", total_regular_seconds: 28800, total_break_seconds: 1800, total_overtime_seconds: 7200, net_work_seconds: 34200, is_present_now: false, anomaly_count: 0, periods: [period(4, 4), { check_in: NOW - 4 * DAY + 61200, check_out: NOW - 4 * DAY + 68400, duration_secs: 7200, kind: "overtime" }] },
    { date: dayDate(5), user_pin: "145", status: "present", total_regular_seconds: 25200, total_break_seconds: 1800, total_overtime_seconds: 0, net_work_seconds: 23400, is_present_now: false, anomaly_count: 0, periods: [{ check_in: NOW - 5 * DAY + 28800, check_out: NOW - 5 * DAY + 57600, duration_secs: 28800, kind: "regular" }] },
  ],
};

const emptyWorkDays: EmployeeWorkDays = {
  user_pin: "87",
  work_days: [],
};

const meta: Meta<typeof EmployeeAttendanceLog> = {
  title: "Modules/Employees/EmployeeAttendanceLog",
  component: EmployeeAttendanceLog,
  tags: ["autodocs", "level:composite"],
};

export default meta;
type Story = StoryObj<typeof EmployeeAttendanceLog>;

export const WithData: Story = {
  args: { workDays: mockWorkDays },
};

export const Empty: Story = {
  args: { workDays: emptyWorkDays },
};
