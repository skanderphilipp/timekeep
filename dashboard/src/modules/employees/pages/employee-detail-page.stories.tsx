import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import { EmployeeDetailPage } from "./employee-detail-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

const MOCK_EMPLOYEE = {
  id: "emp-001",
  pin: "145",
  name: "Ahmed Al-Sabah",
  department: "Engineering",
  external_id: "odoo-42",
  active: true,
  created_at: NOW - DAY * 30,
  updated_at: NOW - 3600,
};

const MOCK_SUMMARY = {
  user_pin: "145",
  total_days: 22,
  present_days: 19,
  late_days: 2,
  half_days: 1,
  absent_days: 3,
  avg_hours_per_day: 8.2,
  total_overtime_seconds: 12600,
};

const MOCK_WORK_DAYS = {
  user_pin: "145",
  work_days: [
    { date: NOW - DAY, status: "present", check_in: NOW - DAY + 28800, check_out: NOW - DAY + 61200, regular_seconds: 28800, overtime_seconds: 3600, break_seconds: 1800, is_anomaly: false },
    { date: NOW - DAY * 2, status: "late", check_in: NOW - DAY * 2 + 30600, check_out: NOW - DAY * 2 + 61200, regular_seconds: 25200, overtime_seconds: 0, break_seconds: 1800, is_anomaly: false },
    { date: NOW - DAY * 3, status: "absent", check_in: null, check_out: null, regular_seconds: 0, overtime_seconds: 0, break_seconds: 0, is_anomaly: true },
    { date: NOW - DAY * 4, status: "present", check_in: NOW - DAY * 4 + 28800, check_out: NOW - DAY * 4 + 61200, regular_seconds: 28800, overtime_seconds: 7200, break_seconds: 1800, is_anomaly: false },
  ],
};

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Router wrapper ──────────────────────────────────────────────────────

function PageAt({ routePath, redirectTo, element }: { routePath: string; redirectTo: string; element: ReactNode }) {
  return (
    <Routes>
      <Route path={routePath} element={element} />
      <Route path="*" element={<Navigate to={redirectTo} replace />} />
    </Routes>
  );
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof EmployeeDetailPage> = {
  title: "Pages/Employees/Detail",
  component: EmployeeDetailPage,
  tags: ["autodocs", "level:page"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof EmployeeDetailPage>;

// ── Stories ─────────────────────────────────────────────────────────────

export const WithData: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees/:id", () => HttpResponse.json(envelopeOk(MOCK_EMPLOYEE))),
        http.get("/api/employees/:pin/summary", () => HttpResponse.json(envelopeOk(MOCK_SUMMARY))),
        http.get("/api/employees/:pin/work-days", () => HttpResponse.json(envelopeOk(MOCK_WORK_DAYS))),
      );
    },
  ],
  render: () => (
    <PageAt routePath="/employees/:id" redirectTo="/employees/emp-001" element={<EmployeeDetailPage />} />
  ),
};

export const Loading: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees/:id", async () => { await delay("infinite"); return HttpResponse.json(envelopeOk(MOCK_EMPLOYEE)); }),
        http.get("/api/employees/:pin/summary", () => HttpResponse.json(envelopeOk(MOCK_SUMMARY))),
        http.get("/api/employees/:pin/work-days", () => HttpResponse.json(envelopeOk(MOCK_WORK_DAYS))),
      );
    },
  ],
  render: () => (
    <PageAt routePath="/employees/:id" redirectTo="/employees/emp-001" element={<EmployeeDetailPage />} />
  ),
};

export const ErrorState: Story = {
  name: "Error",
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees/:id", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/employees/:pin/summary", () => HttpResponse.json(envelopeOk(MOCK_SUMMARY))),
        http.get("/api/employees/:pin/work-days", () => HttpResponse.json(envelopeOk(MOCK_WORK_DAYS))),
      );
    },
  ],
  render: () => (
    <PageAt routePath="/employees/:id" redirectTo="/employees/emp-001" element={<EmployeeDetailPage />} />
  ),
};
