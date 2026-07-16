import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { ReportSummary } from "@/lib/api";
import { ReportsPage } from "./reports-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

const MOCK_REPORT: ReportSummary = {
  date_from: NOW - DAY * 30,
  date_to: NOW,
  total_punches: 847,
  check_ins: 423,
  check_outs: 420,
  break_outs: 187,
  break_ins: 186,
  overtime_ins: 24,
  overtime_outs: 24,
  unique_users: 42,
  work_days: 22,
  avg_seconds_per_day: 29520,
  overtime_seconds: 43200,
  absence_rate: 3.8,
  daily_breakdown: Array.from({ length: 10 }, (_, i) => ({
    date: NOW - DAY * (9 - i),
    count: 25 + Math.floor(Math.random() * 20),
  })),
  daily_hours: Array.from({ length: 7 }, (_, i) => ({
    date: NOW - DAY * (6 - i),
    regular_seconds: 25200 + Math.floor(Math.random() * 7200),
    overtime_seconds: Math.floor(Math.random() * 3600),
  })),
  weekly_hours: [
    { week: 27, year: 2026, total_seconds: 184320 },
    { week: 28, year: 2026, total_seconds: 176400 },
    { week: 29, year: 2026, total_seconds: 190080 },
  ],
  status_distribution: [
    { status: "full", count: 780, percentage: 85.2 },
    { status: "half", count: 72, percentage: 7.9 },
    { status: "absent", count: 63, percentage: 6.9 },
  ],
  employees: [
    {
      user_pin: "145",
      employee_name: "Ahmed Al-Sabah",
      days_present: 20,
      days_absent: 2,
      days_late: 1,
      avg_seconds_per_day: 29880,
      overtime_seconds: 12600,
      anomaly_count: 0,
    },
    {
      user_pin: "87",
      employee_name: "Fatima Noor",
      days_present: 19,
      days_absent: 3,
      days_late: 2,
      avg_seconds_per_day: 28800,
      overtime_seconds: 5400,
      anomaly_count: 1,
    },
    {
      user_pin: "32",
      employee_name: "Omar Hassan",
      days_present: 18,
      days_absent: 4,
      days_late: 3,
      avg_seconds_per_day: 27600,
      overtime_seconds: 1800,
      anomaly_count: 2,
    },
  ],
};

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof ReportsPage> = {
  title: "Pages/Reports",
  component: ReportsPage,
  tags: ["autodocs", "level:page"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof ReportsPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Full report with charts, KPIs, and export bar. */
export const WithData: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/reports/summary", () =>
          HttpResponse.json(envelopeOk(MOCK_REPORT)),
        ),
      );
    },
  ],
};

/** Empty state — no punches in period. */
export const Empty: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/reports/summary", () =>
          HttpResponse.json(
            envelopeOk({
              ...MOCK_REPORT,
              total_punches: 0,
              check_ins: 0,
              check_outs: 0,
              unique_users: 0,
              daily_breakdown: [],
              daily_hours: [],
              weekly_hours: [],
              status_distribution: [],
              employees: [],
            }),
          ),
        ),
      );
    },
  ],
};

/** Loading state — API hangs. */
export const Loading: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/reports/summary", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_REPORT));
        }),
      );
    },
  ],
};

/** Error state — API returns 500. */
export const Error: Story = {
  name: "Error",
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/reports/summary", () =>
          new HttpResponse(null, { status: 500 }),
        ),
      );
    },
  ],
};
