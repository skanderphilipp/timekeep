import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker, todaySummary, todaySummaryEmpty } from "@/testing/mocks";
import { DashboardPage } from "./dashboard-page";

// ── Helpers ─────────────────────────────────────────────────────────────

function envelopeOk<T>(data: T) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof DashboardPage> = {
  title: "Pages/Dashboard",
  component: DashboardPage,
  tags: ["autodocs", "level:page"],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof DashboardPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Full dashboard with 42 present, 8 absent, 3 late, checked-in list, charts. */
export const WithData: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/dashboard/today", () => HttpResponse.json(envelopeOk(todaySummary))),
      );
    },
  ],
  render: () => <DashboardPage />,
};

/** Empty state — no punches today, no checked-in employees. */
export const Empty: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/dashboard/today", () => HttpResponse.json(envelopeOk(todaySummaryEmpty))),
      );
    },
  ],
  render: () => <DashboardPage />,
};

/** Loading state — API responds with infinite delay. */
export const Loading: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/dashboard/today", async () => {
          await delay("infinite");
          return HttpResponse.json({ data: null, meta: null, error: null });
        }),
      );
    },
  ],
  render: () => <DashboardPage />,
};

/** Error state — API returns 500. */
export const Error: Story = {
  name: "Error",
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/dashboard/today", () =>
          HttpResponse.json(
            {
              data: null,
              meta: null,
              error: { code: "internal", message: "Database unreachable" },
            },
            { status: 500 },
          ),
        ),
      );
    },
  ],
  render: () => <DashboardPage />,
};
