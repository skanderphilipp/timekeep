import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { Punch } from "@/lib/api";
import { PunchQueryPage } from "./punch-query-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);

const MOCK_PUNCHES: Punch[] = [
  {
    id: "punch-1-20260714-080000-CQZ7232960836-145-0-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW - 3600,
    status: "check_in",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-2-20260714-080500-CQZ7232960836-201-0-15-0",
    user_pin: "201",
    employee_name: "Fatima Hassan",
    timestamp: NOW - 3500,
    status: "check_in",
    verify_mode: "face",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-3-20260714-120000-CQZ7232960836-145-1-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW - 2000,
    status: "break_out",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-4-20260714-123000-CQZ7232960836-145-0-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW - 1500,
    status: "break_in",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-5-20260714-170000-CQZ7232960836-145-1-15-0",
    user_pin: "145",
    employee_name: "Ahmed Al-Sabah",
    timestamp: NOW - 600,
    status: "check_out",
    verify_mode: "fingerprint",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-6-20260714-170500-CQZ7232960836-201-1-15-0",
    user_pin: "201",
    employee_name: "Fatima Hassan",
    timestamp: NOW - 300,
    status: "check_out",
    verify_mode: "face",
    device_sn: "CQZ7232960836",
  },
  {
    id: "punch-7-20260714-090000-BIO8865123472-310-0-15-1",
    user_pin: "310",
    employee_name: "Omar Khalid",
    timestamp: NOW - 3000,
    status: "check_in",
    verify_mode: "card",
    device_sn: "BIO8865123472",
    is_anomaly: true,
    anomaly_type: "missing_check_out",
  },
];

const MOCK_PUNCH_FILTERS = {
  facets: [
    {
      key: "device_sn",
      label: "Device",
      options: [
        { value: "CQZ7232960836", label: "Office Entrance", count: 5 },
        { value: "BIO8865123472", label: "Warehouse B", count: 1 },
      ],
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "check_in", label: "Check In", count: 3 },
        { value: "check_out", label: "Check Out", count: 2 },
        { value: "break_out", label: "Break Out", count: 1 },
        { value: "break_in", label: "Break In", count: 1 },
      ],
    },
  ],
};

function envelopeOk<T>(data: T, meta?: Record<string, unknown>) {
  return { data, meta: meta ?? null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof PunchQueryPage> = {
  title: "Pages/PunchQuery",
  component: PunchQueryPage,
  tags: ["autodocs", "level:page"],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof PunchQueryPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Seven punches across two devices with one anomaly. */
export const WithData: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/punches", () =>
          HttpResponse.json(
            envelopeOk({ punches: MOCK_PUNCHES }, { has_more: false, total: MOCK_PUNCHES.length }),
          ),
        ),
        http.get("/api/punches/filters", () => HttpResponse.json(envelopeOk(MOCK_PUNCH_FILTERS))),
      );
    },
  ],
  render: () => <PunchQueryPage />,
};

/** Empty state — no punch records. */
export const Empty: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/punches", () =>
          HttpResponse.json(envelopeOk({ punches: [] }, { has_more: false, total: 0 })),
        ),
        http.get("/api/punches/filters", () => HttpResponse.json(envelopeOk({ facets: [] }))),
      );
    },
  ],
  render: () => <PunchQueryPage />,
};

/** Loading state — API responds with infinite delay. */
export const Loading: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/punches", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk({ punches: [] }));
        }),
        http.get("/api/punches/filters", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk({ facets: [] }));
        }),
      );
    },
  ],
  render: () => <PunchQueryPage />,
};

/** Error state — API returns 500. */
export const Error: Story = {
  name: "Error",
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/punches", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/punches/filters", () => HttpResponse.json(envelopeOk({ facets: [] }))),
      );
    },
  ],
  render: () => <PunchQueryPage />,
};
