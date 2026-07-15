import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import { SettingsPage } from "./settings-page";

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_HEALTH = {
  status: "healthy",
  version: "0.3.0",
  db: "sqlite",
  uptime_seconds: 172800,
  engine: {
    events_processed: 12450,
    events_dropped: 23,
    events_distributed: 12427,
    events_failed: 0,
  },
  distributors: [
    { name: "webhook", delivered: 5200, dead: 0, queued: 0 },
    { name: "odoo", delivered: 7227, dead: 0, queued: 3 },
  ],
  devices: [
    {
      serial_number: "CQZ7232960836",
      adms_active: true,
      sdk_active: true,
      last_seen_secs_ago: 12,
      last_poll_secs_ago: 30,
    },
    {
      serial_number: "BIO8865123472",
      adms_active: true,
      sdk_active: false,
      last_seen_secs_ago: 45,
      last_poll_secs_ago: 120,
    },
  ],
};

const MOCK_SETTINGS = {
  poll_interval_secs: 30,
  auto_discover: true,
};

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof SettingsPage> = {
  title: "Pages/Settings",
  component: SettingsPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SettingsPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Full settings page with health cards, engine stats, devices, distributors, and settings form. */
export const Default: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/health", () => HttpResponse.json(envelopeOk(MOCK_HEALTH))),
        http.get("/api/settings", () => HttpResponse.json(envelopeOk(MOCK_SETTINGS))),
      );
    },
  ],
};

/** Degraded health — database error, engine pipeline empty. */
export const Degraded: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/health", () =>
          HttpResponse.json(
            envelopeOk({
              ...MOCK_HEALTH,
              status: "degraded",
              db: "error",
              engine: {
                events_processed: 0,
                events_dropped: 0,
                events_distributed: 0,
                events_failed: 5,
              },
              distributors: [
                { name: "webhook", delivered: 0, dead: 12, queued: 0 },
              ],
            }),
          ),
        ),
        http.get("/api/settings", () => HttpResponse.json(envelopeOk(MOCK_SETTINGS))),
      );
    },
  ],
};

/** Loading state — health API hangs. */
export const Loading: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/health", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_HEALTH));
        }),
        http.get("/api/settings", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_SETTINGS));
        }),
      );
    },
  ],
};

/** Error state — health API returns 500. */
export const Error: Story = {
  name: "Error",
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/health", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/settings", () => new HttpResponse(null, { status: 500 })),
      );
    },
  ],
};
