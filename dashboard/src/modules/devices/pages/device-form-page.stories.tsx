import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import { DeviceFormPage } from "./device-form-page";

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_DEVICE = {
  serial_number: "CQZ7232960836",
  label: "Office Entrance",
  host: "192.168.1.100",
  port: 4370,
  comm_key: 0,
  push_enabled: true,
  timezone: "Asia/Riyadh",
};

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Router wrapper ──────────────────────────────────────────────────────

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

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof DeviceFormPage> = {
  title: "Pages/Devices/Form",
  component: DeviceFormPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof DeviceFormPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Fresh create form — no pre-filled data, POST returns 201. */
export const Create: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.post("/api/devices", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            envelopeOk({ ...body, serial_number: body.serial_number }),
            { status: 201 },
          );
        }),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/new"
      redirectTo="/devices/new"
      element={<DeviceFormPage />}
    />
  ),
};

/** Edit existing device — form pre-filled from GET /api/devices/:sn. */
export const Edit: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", () =>
          HttpResponse.json(
            envelopeOk({ ...MOCK_DEVICE, status: "online", model: "SpeedFace-V5L [TI]", firmware_version: "Ver 8.45" }),
          ),
        ),
        http.put("/api/devices/:sn", () =>
          HttpResponse.json(envelopeOk({ status: "updated" })),
        ),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn/edit"
      redirectTo="/devices/CQZ7232960836/edit"
      element={<DeviceFormPage />}
    />
  ),
};

/** Loading state — device detail fetch hangs. */
export const Loading: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/devices/:sn", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_DEVICE));
        }),
      );
    },
  ],
  render: () => (
    <PageAt
      routePath="/devices/:sn/edit"
      redirectTo="/devices/CQZ7232960836/edit"
      element={<DeviceFormPage />}
    />
  ),
};
