import type { Meta, StoryObj } from "@storybook/react";
import { EmployeeAttendanceLog } from "./employee-attendance-log";
import type { EmployeeWorkDays } from "@/lib/api";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

const mockWorkDays: EmployeeWorkDays = {
  user_pin: "145",
  work_days: [
    { date: NOW - DAY, status: "present", check_in: NOW - DAY + 28800, check_out: NOW - DAY + 61200, regular_seconds: 28800, overtime_seconds: 3600, break_seconds: 1800, is_anomaly: false },
    { date: NOW - DAY * 2, status: "late", check_in: NOW - DAY * 2 + 30600, check_out: NOW - DAY * 2 + 61200, regular_seconds: 25200, overtime_seconds: 0, break_seconds: 1800, is_anomaly: false },
    { date: NOW - DAY * 3, status: "absent", check_in: null, check_out: null, regular_seconds: 0, overtime_seconds: 0, break_seconds: 0, is_anomaly: true },
    { date: NOW - DAY * 4, status: "present", check_in: NOW - DAY * 4 + 28800, check_out: NOW - DAY * 4 + 61200, regular_seconds: 28800, overtime_seconds: 7200, break_seconds: 1800, is_anomaly: false },
    { date: NOW - DAY * 5, status: "present", check_in: NOW - DAY * 5 + 28800, check_out: NOW - DAY * 5 + 57600, regular_seconds: 25200, overtime_seconds: 0, break_seconds: 1800, is_anomaly: false },
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
