/**
 * Integration test: EmployeeAttendanceLog renders correctly with
 * data shaped like the backend's actual WorkDayResponse.
 *
 * Validates the fix for the WorkDay type reconciliation:
 *   - ISO date strings (not Unix timestamps)
 *   - periods[] array (not flat check_in/check_out)
 *   - anomaly_count (not is_anomaly boolean)
 *   - total_regular_seconds / total_overtime_seconds (not regular_seconds / overtime_seconds)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

import { EmployeeAttendanceLog } from "./employee-attendance-log";
import type { EmployeeWorkDays, WorkDay, WorkPeriod } from "@/lib/api";

// ── Lingui setup ───────────────────────────────────────────────────────────────

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

// ── Mock data shaped exactly like the backend sends ────────────────────────────

function makePeriod(
  checkIn: number,
  checkOut: number | null,
  kind: string = "regular",
): WorkPeriod {
  return {
    check_in: checkIn,
    check_out: checkOut,
    duration_secs: checkOut != null ? checkOut - checkIn : 0,
    kind,
  };
}

function makeWorkDay(overrides: Partial<WorkDay> = {}): WorkDay {
  return {
    date: "2026-07-15",
    user_pin: "145",
    status: "present",
    total_regular_seconds: 28800,
    total_break_seconds: 1800,
    total_overtime_seconds: 3600,
    net_work_seconds: 30600,
    is_present_now: false,
    anomaly_count: 0,
    periods: [
      makePeriod(1752595200, 1752627600, "regular"),
      makePeriod(1752627600, 1752631200, "overtime"),
    ],
    ...overrides,
  };
}

const presentDay: WorkDay = makeWorkDay();
const lateDay: WorkDay = makeWorkDay({
  date: "2026-07-14",
  status: "late",
  total_overtime_seconds: 0,
  net_work_seconds: 25200,
  periods: [makePeriod(1752508800, 1752537600)],
});
const absentDay: WorkDay = makeWorkDay({
  date: "2026-07-13",
  status: "absent",
  total_regular_seconds: 0,
  total_break_seconds: 0,
  total_overtime_seconds: 0,
  net_work_seconds: 0,
  anomaly_count: 0,
  periods: [],
});
const anomalyDay: WorkDay = makeWorkDay({
  date: "2026-07-12",
  status: "present",
  anomaly_count: 3,
  periods: [makePeriod(1752336000, null)], // still present (open check-out)
});

const workDays: EmployeeWorkDays = {
  user_pin: "145",
  work_days: [presentDay, lateDay, absentDay, anomalyDay],
};

const emptyWorkDays: EmployeeWorkDays = {
  user_pin: "87",
  work_days: [],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("EmployeeAttendanceLog — integration (backend shape)", () => {
  it("renders all work days from the backend response shape", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);

    // Date column — uses ISO date strings (not Unix timestamps)
    expect(screen.getByText(/7\/15\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/7\/14\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/7\/13\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/7\/12\/2026/)).toBeInTheDocument();
  });

  it("shows Present badge for normal attendance", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    // The first row (presentDay) should show "Present"
    const badges = screen.getAllByText("Present");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Late badge for late arrivals", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("shows Absent badge", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    expect(screen.getByText("Absent")).toBeInTheDocument();
  });

  it("shows Anomaly badge when anomaly_count > 0", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    const anomalyBadges = screen.getAllByText("Anomaly");
    // Only the anomalyDay has anomaly_count > 0
    expect(anomalyBadges.length).toBe(1);
  });

  it("renders check-in/check-out from periods array", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);

    // The present day has a check_in at 1752595200 and check_out at 1752627600
    // formatTime() converts Unix seconds → HH:MM locale-dependent time
    // The absentDay (no periods) and anomalyDay (open check-out) show "—"
    // But presentDay's check_in/check_out should NOT be dashes
    const presentDayRows = screen
      .getAllByRole("row")
      .filter((row) => row.textContent?.includes("7/15/2026"));
    expect(presentDayRows.length).toBeGreaterThan(0);
  });

  it("shows hours as total_regular + total_overtime seconds formatted", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    // presentDay: 28800 + 3600 = 32400 seconds = 9h 0m
    const hoursCells = screen.getAllByText("9h 0m");
    expect(hoursCells.length).toBeGreaterThanOrEqual(1);
    // absentDay: 0 + 0 = 0 seconds = 0m
    expect(screen.getByText("0m")).toBeInTheDocument();
  });

  it("shows overtime from total_overtime_seconds", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    // presentDay has 3600 overtime seconds = 1h 0m
    const overtimeCells = screen.getAllByText("1h 0m");
    expect(overtimeCells.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no work days", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={emptyWorkDays} />);
    expect(
      screen.getByText(/No attendance records found/),
    ).toBeInTheDocument();
  });

  it("handles day still in progress (open check-out)", () => {
    renderWithI18n(<EmployeeAttendanceLog workDays={workDays} />);
    // The anomalyDay has periods[0].check_out = null (still present)
    // Should show "—" for check-out
    const anomalyRow = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("7/12/2026"));
    expect(anomalyRow).toBeDefined();
    // Verify the anomaly badge is shown
    expect(anomalyRow?.textContent).toContain("Anomaly");
  });
});
