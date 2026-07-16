import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { IntegrationEndpoint } from "@/lib/api";
import type { IntegrationKindValue } from "@shared/integration-kinds";
import { EndpointsPage } from "./endpoints-page";

// ── Mock data ───────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);

const MOCK_ENDPOINTS: IntegrationEndpoint[] = [
  {
    id: "ep-001",
    name: "Odoo Production",
    kind: "odoo" as IntegrationKindValue,
    enabled: true,
    config: { url: "https://odoo.example.com", database: "production" },
    created_at: NOW - 86400 * 30,
    updated_at: NOW - 3600,
  },
  {
    id: "ep-002",
    name: "Slack Notifications",
    kind: "webhook" as IntegrationKindValue,
    enabled: true,
    config: { url: "https://hooks.slack.com/services/T01/B01/abc123" },
    created_at: NOW - 86400 * 14,
    updated_at: NOW - 7200,
  },
  {
    id: "ep-003",
    name: "SAP HR Sync",
    kind: "sap" as IntegrationKindValue,
    enabled: false,
    config: {},
    created_at: NOW - 86400 * 45,
    updated_at: NOW - 86400 * 10,
  },
];

function envelopeOk(data: unknown) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof EndpointsPage> = {
  title: "Pages/Endpoints",
  component: EndpointsPage,
  tags: ["autodocs", "level:page"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof EndpointsPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Active endpoints with different integration kinds. */
export const WithEndpoints: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/endpoints", () =>
          HttpResponse.json(envelopeOk(MOCK_ENDPOINTS)),
        ),
      );
    },
  ],
};

/** Empty state — no endpoints configured. */
export const Empty: Story = {
  parameters: { controls: { disable: true } },
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/endpoints", () =>
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
        http.get("/api/endpoints", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk(MOCK_ENDPOINTS));
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
        http.get("/api/endpoints", () =>
          new HttpResponse(null, { status: 500 }),
        ),
      );
    },
  ],
};
