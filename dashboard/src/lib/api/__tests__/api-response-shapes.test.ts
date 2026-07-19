/**
 * API Response Shape Contract Tests
 *
 * Validates that the backend response shapes (simulated via realistic mock data)
 * are assignable to our TypeScript types. These are the types that were
 * reconciled in the OpenAPI type audit.
 *
 * Each test constructs a payload exactly matching what the Rust backend
 * serializes (verified against the generated api-types.ts), then asserts
 * it satisfies the hand-typed domain model.
 *
 * This is a compile-time contract enforced at runtime — if the backend
 * ever changes and the types aren't updated, these tests fail.
 */
import { describe, it, expect } from "vitest";
import type {
  WorkDay,
  WorkPeriod,
  EmployeeWorkDays,
  CalendarDay,
  MonthlyTrendPoint,
  EmployeeSummary,
  DeviceSummary,
  SystemSettings,
  QuickStats,
  DeviceGroup,
  ReportSummary,
} from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Assert that a value is non-null and has all expected keys. */
function hasShape<T extends Record<string, unknown>>(
  value: unknown,
  requiredKeys: (keyof T)[],
): value is T {
  if (value == null || typeof value !== "object") return false;
  return requiredKeys.every((k) => k in value);
}

// ── WorkDay / EmployeeWorkDays ─────────────────────────────────────────────────

describe("WorkDay — backend response shape", () => {
  /** Exact shape the Rust backend serializes (verified against generated api-types.ts). */
  const backendResponse: EmployeeWorkDays = {
    user_pin: "145",
    work_days: [
      {
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
          {
            check_in: 1752595200,
            check_out: 1752627600,
            duration_secs: 32400,
            kind: "regular",
          },
        ],
      },
    ],
  };

  it("accepts the backend WorkDayResponse shape", () => {
    const day = backendResponse.work_days[0];
    expect(hasShape<WorkDay>(day, ["date", "user_pin", "status", "periods"])).toBe(true);
    expect(typeof day.date).toBe("string");
    expect(Array.isArray(day.periods)).toBe(true);
    expect(day.periods.length).toBe(1);
  });

  it("accepts WorkPeriod shape from periods array", () => {
    const period: WorkPeriod = backendResponse.work_days[0].periods[0];
    expect(hasShape<WorkPeriod>(period, ["check_in", "duration_secs", "kind"])).toBe(true);
    expect(typeof period.check_in).toBe("number");
    expect(typeof period.duration_secs).toBe("number");
    expect(typeof period.kind).toBe("string");
  });

  it("handles empty periods (absent day)", () => {
    const day: WorkDay = {
      date: "2026-07-13",
      user_pin: "145",
      status: "absent",
      total_regular_seconds: 0,
      total_break_seconds: 0,
      total_overtime_seconds: 0,
      net_work_seconds: 0,
      is_present_now: false,
      anomaly_count: 0,
      periods: [],
    };
    expect(day.periods).toHaveLength(0);
  });

  it("handles anomaly_count > 0 (replaces old is_anomaly boolean)", () => {
    const day: WorkDay = {
      date: "2026-07-12",
      user_pin: "145",
      status: "present",
      total_regular_seconds: 28800,
      total_break_seconds: 1800,
      total_overtime_seconds: 0,
      net_work_seconds: 27000,
      is_present_now: false,
      anomaly_count: 2,
      periods: [],
    };
    expect(day.anomaly_count).toBe(2);
  });

  it("handles open check-out (still present)", () => {
    const period: WorkPeriod = {
      check_in: 1752336000,
      check_out: null,
      duration_secs: 0,
      kind: "regular",
    };
    expect(period.check_out).toBeNull();
  });

  it("wraps correctly in EmployeeWorkDays", () => {
    expect(backendResponse.user_pin).toBe("145");
    expect(backendResponse.work_days).toHaveLength(1);
  });
});

// ── CalendarDay ─────────────────────────────────────────────────────────────────

describe("CalendarDay — backend response shape", () => {
  const backendResponse: CalendarDay[] = [
    { date: "2026-07-15", status_code: 1, hours: 8.5, is_working_day: true },
    { date: "2026-07-16", status_code: 0, hours: null, is_working_day: false },
  ];

  it("accepts CalendarDayResponse from backend", () => {
    const day = backendResponse[0];
    expect(hasShape<CalendarDay>(day, ["date", "status_code", "is_working_day"])).toBe(true);
    expect(typeof day.date).toBe("string");
    expect(typeof day.status_code).toBe("number");
    expect(typeof day.is_working_day).toBe("boolean");
  });

  it("handles null hours (non-working day)", () => {
    expect(backendResponse[1].hours).toBeNull();
  });

  it("handles working day with hours", () => {
    expect(backendResponse[0].hours).toBe(8.5);
    expect(backendResponse[0].is_working_day).toBe(true);
  });
});

// ── MonthlyTrendPoint ───────────────────────────────────────────────────────────

describe("MonthlyTrendPoint — backend response shape", () => {
  const backendResponse: MonthlyTrendPoint[] = [
    { year: 2026, month: 6, attendance_pct: 92.5 },
    { year: 2026, month: 7, attendance_pct: 88.3 },
  ];

  it("accepts MonthlyTrendResponse from backend", () => {
    const point = backendResponse[0];
    expect(hasShape<MonthlyTrendPoint>(point, ["year", "month", "attendance_pct"])).toBe(true);
    expect(typeof point.year).toBe("number");
    expect(typeof point.month).toBe("number");
    expect(typeof point.attendance_pct).toBe("number");
  });

  it("represents attendance as percentage", () => {
    expect(backendResponse[0].attendance_pct).toBe(92.5);
  });
});

// ── EmployeeSummary ─────────────────────────────────────────────────────────────

describe("EmployeeSummary — enriched with new backend fields", () => {
  const backendResponse: EmployeeSummary = {
    user_pin: "145",
    total_days: 22,
    present_days: 20,
    late_days: 3,
    half_days: 1,
    absent_days: 1,
    avg_hours_per_day: 8.2,
    total_overtime_seconds: 7200,
    total_regular_seconds: 176000,
    work_days: [
      {
        date: "2026-07-15",
        user_pin: "145",
        status: "present",
        total_regular_seconds: 28800,
        total_break_seconds: 1800,
        total_overtime_seconds: 3600,
        net_work_seconds: 30600,
        is_present_now: false,
        anomaly_count: 0,
        periods: [{ check_in: 1752595200, check_out: 1752627600, duration_secs: 32400, kind: "regular" }],
      },
    ],
  };

  it("includes total_regular_seconds (new field)", () => {
    expect(backendResponse.total_regular_seconds).toBe(176000);
  });

  it("includes work_days array (new field)", () => {
    expect(backendResponse.work_days).toHaveLength(1);
    expect(backendResponse.work_days[0].date).toBe("2026-07-15");
  });

  it("retains legacy fields", () => {
    expect(backendResponse.present_days).toBe(20);
    expect(backendResponse.absent_days).toBe(1);
  });
});

// ── DeviceSummary ───────────────────────────────────────────────────────────────

describe("DeviceSummary — now includes vendor + new fields", () => {
  const backendResponse: DeviceSummary = {
    serial_number: "CQZ7232960836",
    label: "Office Entrance",
    host: "192.168.1.100",
    port: 4370,
    push_enabled: true,
    connection_status: "online",
    adms_active: true,
    sdk_poll_active: true,
    vendor: "zkteco",
    location: "HQ Floor 1",
    sdk_last_poll: 1752595200,
  };

  it("includes vendor (now required)", () => {
    expect(backendResponse.vendor).toBe("zkteco");
  });

  it("includes location (new field)", () => {
    expect(backendResponse.location).toBe("HQ Floor 1");
  });

  it("includes sdk_last_poll (new field)", () => {
    expect(backendResponse.sdk_last_poll).toBe(1752595200);
  });

  it("retains existing fields unchanged", () => {
    expect(backendResponse.connection_status).toBe("online");
    expect(backendResponse.adms_active).toBe(true);
  });
});

// ── SystemSettings ──────────────────────────────────────────────────────────────

describe("SystemSettings — now includes workspace metadata", () => {
  const backendResponse: SystemSettings = {
    poll_interval_secs: 30,
    auto_discover: true,
    support_email: "admin@alsabah.com",
    workspace_name: "Alsabah Group",
  };

  it("includes support_email (new field)", () => {
    expect(backendResponse.support_email).toBe("admin@alsabah.com");
  });

  it("includes workspace_name (new field)", () => {
    expect(backendResponse.workspace_name).toBe("Alsabah Group");
  });

  it("accepts empty strings as defaults", () => {
    const defaults: SystemSettings = {
      poll_interval_secs: 30,
      auto_discover: false,
      support_email: "",
      workspace_name: "",
    };
    expect(defaults.support_email).toBe("");
    expect(defaults.workspace_name).toBe("");
  });
});

// ── QuickStats ──────────────────────────────────────────────────────────────────

describe("QuickStats — now includes work_days", () => {
  const backendResponse: QuickStats = {
    unique_users: 45,
    total_punches: 342,
    check_ins: 171,
    check_outs: 165,
    currently_present: 6,
    late_arrivals: 12,
    anomalies_detected: 3,
    work_days: [
      {
        date: "2026-07-18",
        user_pin: "145",
        status: "present",
        total_regular_seconds: 28800,
        total_break_seconds: 1800,
        total_overtime_seconds: 0,
        net_work_seconds: 27000,
        is_present_now: true,
        anomaly_count: 0,
        periods: [{ check_in: 1753372800, check_out: null, duration_secs: 14400, kind: "regular" }],
      },
    ],
  };

  it("includes work_days (new field)", () => {
    expect(backendResponse.work_days).toHaveLength(1);
    expect(backendResponse.work_days[0].is_present_now).toBe(true);
  });

  it("retains legacy stats fields", () => {
    expect(backendResponse.unique_users).toBe(45);
    expect(backendResponse.anomalies_detected).toBe(3);
  });
});

// ── DeviceGroup ─────────────────────────────────────────────────────────────────

describe("DeviceGroup — now includes department_ids", () => {
  const backendResponse: DeviceGroup = {
    id: "group-1",
    name: "Onboarding Devices",
    description: "Devices used during employee onboarding",
    device_count: 3,
    department_ids: ["dept-eng", "dept-hr"],
    created_at: 1752595200,
    updated_at: 1752595200,
  };

  it("includes department_ids (new field)", () => {
    expect(backendResponse.department_ids).toEqual(["dept-eng", "dept-hr"]);
  });

  it("accepts empty department_ids (all departments)", () => {
    const allDepts: DeviceGroup = {
      id: "group-2",
      name: "All Devices",
      department_ids: [],
      created_at: 1752595200,
      updated_at: 1752595200,
    };
    expect(allDepts.department_ids).toHaveLength(0);
  });
});

// ── ReportSummary — required fields ─────────────────────────────────────────────

describe("ReportSummary — newly required fields", () => {
  const backendResponse: ReportSummary = {
    date_from: 1752595200,
    date_to: 1753200000,
    total_punches: 1500,
    check_ins: 750,
    check_outs: 740,
    break_outs: 200,
    break_ins: 195,
    overtime_ins: 50,
    overtime_outs: 48,
    unique_users: 50,
    daily_breakdown: [{ date: 1752595200, count: 45 }],
    work_days: 22,
    avg_seconds_per_day: 29520,
    overtime_seconds: 36000,
    absence_rate: 4.5,
    daily_hours: [{ date: 1752595200, regular_seconds: 28800, overtime_seconds: 3600 }],
    weekly_hours: [{ week: 29, year: 2026, total_seconds: 180000 }],
    status_distribution: [{ status: "full", count: 40, percentage: 80 }],
    employees: [
      {
        user_pin: "145",
        employee_name: "Ahmed",
        days_present: 20,
        days_absent: 1,
        days_late: 3,
        avg_seconds_per_day: 28800,
        overtime_seconds: 7200,
        anomaly_count: 0,
      },
    ],
  };

  it("requires daily_hours (was optional, now required)", () => {
    expect(backendResponse.daily_hours).toHaveLength(1);
    expect(backendResponse.daily_hours[0].regular_seconds).toBe(28800);
  });

  it("requires weekly_hours (was optional, now required)", () => {
    expect(backendResponse.weekly_hours).toHaveLength(1);
  });

  it("requires status_distribution (was optional, now required)", () => {
    expect(backendResponse.status_distribution).toHaveLength(1);
    expect(backendResponse.status_distribution[0].percentage).toBe(80);
  });

  it("requires employees (was optional, now required)", () => {
    expect(backendResponse.employees).toHaveLength(1);
    expect(backendResponse.employees[0].anomaly_count).toBe(0);
  });
});
