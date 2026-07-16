import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import { DeviceDetailPage } from "./device-detail-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const MOCK_DEVICE = {
  serial_number: "CQZ7232960836",
  label: "Office Entrance",
  host: "192.168.1.100",
  port: 4370,
  comm_key: 0,
  push_enabled: true,
  timezone: "Asia/Riyadh",
};

/** Mock device summary for the device-list endpoint (used by DeviceToDeviceCopyDialog). */
const MOCK_DEVICE_SUMMARY = {
  serial_number: "CQZ7232960836",
  label: "Office Entrance",
  host: "192.168.1.100",
  port: 4370,
  push_enabled: true,
  connection_status: "online",
  adms_active: true,
  sdk_poll_active: true,
  last_seen_at: NOW_SECONDS - 12,
  auto_registered: false,
};

const MOCK_HEALTH = {
  status: "ok",
  version: "0.2.0",
  db: "sqlite",
  uptime_seconds: 86400,
  devices: [
    {
      serial_number: "CQZ7232960836",
      adms_active: true,
      sdk_active: true,
      last_seen_secs_ago: 12,
      last_poll_secs_ago: 30,
    },
  ],
};

/** Realistic activity timeline — matches UX spec mockup with relative times. */
const MOCK_EVENTS = [
  {
    id: "evt-1",
    device_sn: "CQZ7232960836",
    label: "Came online",
    timestamp: NOW_SECONDS - 55,
    event_type: "device_came_online",
    is_problem: false,
  },
  {
    id: "evt-2",
    device_sn: "CQZ7232960836",
    label: "Sync completed (+27 records, 1.2s)",
    timestamp: NOW_SECONDS - 130,
    event_type: "sync_completed",
    is_problem: false,
  },
  {
    id: "evt-3",
    device_sn: "CQZ7232960836",
    label: "Went offline (push timeout)",
    timestamp: NOW_SECONDS - 250,
    event_type: "device_went_offline",
    is_problem: true,
  },
  {
    id: "evt-4",
    device_sn: "CQZ7232960836",
    label: "Came online",
    timestamp: NOW_SECONDS - 14400,
    event_type: "device_came_online",
    is_problem: false,
  },
  {
    id: "evt-5",
    device_sn: "CQZ7232960836",
    label: "Host changed to 192.168.1.100",
    timestamp: NOW_SECONDS - 14520,
    event_type: "config_changed",
    is_problem: false,
  },
];

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

function envelopeError(code: string, message: string) {
  return { data: null, meta: null, error: { code, message } };
}

// ── Router wrapper (uses existing MemoryRouter from preview.tsx) ───────

function PageAt({
  routePath,
  redirectTo,
  element,
}: {
  routePath: string;
  redirectTo: string;
  element: ReactNode;
}) {
  return (
    <Routes>
      <Route path={routePath} element={element} />
      <Route path="*" element={<Navigate to={redirectTo} replace />} />
    </Routes>
  );
}

/**
 * Shared MSW handlers for the device detail page.
 *
 * Covers all endpoints that child components (EnrollEmployeeDialog,
 * DeviceToDeviceCopyDialog, DeviceUsersTab) query on mount.
 */
function deviceDetailHandlers() {
  return [
    http.get("/api/devices/:sn", () =>
      HttpResponse.json(envelopeOk({ ...MOCK_DEVICE, status: "online" })),
    ),
    http.get("/api/devices/:sn/events", () => HttpResponse.json(envelopeOk(MOCK_EVENTS))),
    http.get("/api/devices/:sn/enrollments", () => HttpResponse.json(envelopeOk([]))),
    http.get("/api/devices/:sn/synced-users", () => HttpResponse.json(envelopeOk([]))),
    http.get("/api/devices", () => HttpResponse.json(envelopeOk([MOCK_DEVICE_SUMMARY]))),
    http.get("/api/health", () => HttpResponse.json(envelopeOk(MOCK_HEALTH))),
  ];
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof DeviceDetailPage> = {
  title: "Pages/Devices/Detail",
  component: DeviceDetailPage,
  tags: ["autodocs", "level:page"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof DeviceDetailPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/**
 * Primary story: online device with full mock data.
 * Shows: health cards with real numbers, activity timeline with 5 events,
 * storage bar at 11.5%.
 */
export const WithData: Story = {
  parameters: {
    controls: { disable: true },
  },
  loaders: [
    async () => {
      await worker.use(...deviceDetailHandlers());
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn"
      redirectTo="/devices/CQZ7232960836"
      element={<DeviceDetailPage />}
    />
  ),
};

/**
 * Degraded state: backend not yet enriched.
 * Shows health cards with "—" placeholders and empty activity timeline.
 */
export const Degraded: Story = {
  name: "Degraded (no stats)",
  parameters: {
    controls: { disable: true },
  },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", () =>
          HttpResponse.json(envelopeOk({ ...MOCK_DEVICE, status: "online" })),
        ),
        http.get("/api/devices/:sn/enrollments", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices/:sn/synced-users", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices", () => HttpResponse.json(envelopeOk([MOCK_DEVICE_SUMMARY]))),
        http.get("/api/health", () => HttpResponse.json(envelopeOk(MOCK_HEALTH))),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn"
      redirectTo="/devices/CQZ7232960836"
      element={<DeviceDetailPage />}
    />
  ),
};

export const NotFound: Story = {
  parameters: {
    controls: { disable: true },
  },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", () =>
          HttpResponse.json(envelopeError("not_found", "device not found"), { status: 404 }),
        ),
        http.get("/api/devices/:sn/enrollments", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices/:sn/synced-users", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices", () => HttpResponse.json(envelopeOk([MOCK_DEVICE_SUMMARY]))),
        http.get("/api/health", () => HttpResponse.json(envelopeOk(MOCK_HEALTH))),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn"
      redirectTo="/devices/nonexistent"
      element={<DeviceDetailPage />}
    />
  ),
};

export const ErrorState: Story = {
  name: "Error",
  parameters: {
    controls: { disable: true },
  },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/devices/:sn/enrollments", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/devices/:sn/synced-users", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/devices", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/health", () => new HttpResponse(null, { status: 500 })),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn"
      redirectTo="/devices/CQZ7232960836"
      element={<DeviceDetailPage />}
    />
  ),
};

export const Loading: Story = {
  parameters: {
    controls: { disable: true },
  },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_DEVICE));
        }),
        http.get("/api/devices/:sn/enrollments", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices/:sn/synced-users", () => HttpResponse.json(envelopeOk([]))),
        http.get("/api/devices", () => HttpResponse.json(envelopeOk([MOCK_DEVICE_SUMMARY]))),
        http.get("/api/health", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_HEALTH));
        }),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn"
      redirectTo="/devices/CQZ7232960836"
      element={<DeviceDetailPage />}
    />
  ),
};
