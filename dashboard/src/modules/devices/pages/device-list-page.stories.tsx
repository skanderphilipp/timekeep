import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { DeviceSummary } from "@/lib/api";
import { DeviceListPage } from "./device-list-page";

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_DEVICES: DeviceSummary[] = [
  {
    serial_number: "CQZ7232960836",
    label: "Office Entrance",
    host: "192.168.1.100",
    port: 4370,
    push_enabled: true,
    connection_status: "online",
    adms_active: true,
    sdk_poll_active: true,
  },
  {
    serial_number: "BIO8865123472",
    label: "Warehouse B",
    host: "192.168.1.200",
    port: 4370,
    push_enabled: true,
    connection_status: "offline",
    adms_active: false,
    sdk_poll_active: false,
  },
  {
    serial_number: "SPD4456789012",
    label: "R&D Lab",
    host: "192.168.1.50",
    port: 4370,
    push_enabled: false,
    connection_status: "online",
    adms_active: true,
    sdk_poll_active: true,
  },
];

function envelopeOk<T>(data: T) {
  return {
    data,
    meta: { has_more: false, total: Array.isArray(data) ? data.length : 1 },
    error: null,
  };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof DeviceListPage> = {
  title: "Pages/Devices/List",
  component: DeviceListPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof DeviceListPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Three devices: Office Entrance (online), Warehouse B (offline), R&D Lab (online). */
export const WithData: Story = {
  loaders: [
    async () => {
      await worker.use(http.get("/api/devices", () => HttpResponse.json(envelopeOk(MOCK_DEVICES))));
    },
  ],
  render: () => <DeviceListPage />,
};

/** Empty state — no devices registered yet. */
export const Empty: Story = {
  loaders: [
    async () => {
      await worker.use(http.get("/api/devices", () => HttpResponse.json(envelopeOk([]))));
    },
  ],
  render: () => <DeviceListPage />,
};

/** Loading state — API responds with infinite delay. */
export const Loading: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk([]));
        }),
      );
    },
  ],
  render: () => <DeviceListPage />,
};

/** Error state — API returns 500. */
export const Error: Story = {
  name: "Error",
  loaders: [
    async () => {
      await worker.use(http.get("/api/devices", () => new HttpResponse(null, { status: 500 })));
    },
  ],
  render: () => <DeviceListPage />,
};
