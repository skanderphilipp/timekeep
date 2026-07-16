import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { ApiKey } from "@/lib/api";
import { ApiKeysPage } from "./api-keys-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: "key-001",
    name: "Odoo Production",
    prefix: "tsk_odoo_prod_a1b2",
    permissions: ["read:punches", "write:punches"],
    created_by: "admin",
    created_at: NOW - DAY * 60,
    last_used_at: NOW - 3600,
    expires_at: NOW + DAY * 305,
    revoked: false,
  },
  {
    id: "key-002",
    name: "Zapier Integration",
    prefix: "tsk_zapier_c3d4",
    permissions: ["read:punches"],
    created_by: "admin",
    created_at: NOW - DAY * 30,
    last_used_at: NOW - 7200,
    expires_at: null,
    revoked: false,
  },
  {
    id: "key-003",
    name: "Old Dashboard Access",
    prefix: "tsk_dash_old_e5f6",
    permissions: ["read:punches", "read:devices"],
    created_by: "operator_ahmed",
    created_at: NOW - DAY * 90,
    last_used_at: null,
    expires_at: NOW - DAY * 30,
    revoked: true,
  },
];

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof ApiKeysPage> = {
  title: "Pages/API Keys",
  component: ApiKeysPage,
  tags: ["autodocs", "level:page"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof ApiKeysPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Active keys list with one revoked key. */
export const WithKeys: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/api-keys", () =>
          HttpResponse.json(envelopeOk(MOCK_API_KEYS)),
        ),
      );
    },
  ],
};

/** Empty state — no API keys created yet. */
export const Empty: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/api-keys", () =>
          HttpResponse.json(envelopeOk([])),
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
        http.get("/api/api-keys", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_API_KEYS));
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
        http.get("/api/api-keys", () =>
          new HttpResponse(null, { status: 500 }),
        ),
      );
    },
  ],
};
