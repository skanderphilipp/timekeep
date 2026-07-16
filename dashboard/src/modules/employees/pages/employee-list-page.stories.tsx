import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import { EmployeeListPage } from "./employee-list-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);

const MOCK_EMPLOYEES = [
  { id: "emp-001", pin: "145", name: "Ahmed Al-Sabah", department: "Engineering", external_id: "odoo-42", active: true, created_at: NOW - 86400 * 30, updated_at: NOW - 3600 },
  { id: "emp-002", pin: "87", name: "Fatima Noor", department: "Operations", external_id: "odoo-77", active: true, created_at: NOW - 86400 * 14, updated_at: NOW - 7200 },
  { id: "emp-003", pin: "32", name: "Omar Hassan", department: "Engineering", external_id: null, active: true, created_at: NOW - 86400 * 60, updated_at: NOW - 86400 },
  { id: "emp-004", pin: "201", name: "Layla Mahmoud", department: "HR", external_id: "odoo-15", active: false, created_at: NOW - 86400 * 90, updated_at: NOW - 86400 * 10 },
];

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof EmployeeListPage> = {
  title: "Pages/Employees/List",
  component: EmployeeListPage,
  tags: ["autodocs", "level:page"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof EmployeeListPage>;

// ── Stories ─────────────────────────────────────────────────────────────

export const WithEmployees: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees", () => HttpResponse.json(envelopeOk(MOCK_EMPLOYEES))),
      );
    },
  ],
};

export const Empty: Story = {
  name: "Empty (no employees)",
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees", () => HttpResponse.json(envelopeOk([]))),
      );
    },
  ],
};

export const Loading: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_EMPLOYEES));
        }),
      );
    },
  ],
};

export const ErrorState: Story = {
  name: "Error",
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/employees", () => new HttpResponse(null, { status: 500 })),
      );
    },
  ],
};
