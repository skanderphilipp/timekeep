import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse, delay } from "msw";

import { worker } from "@/testing/mocks";
import type { DashboardUser } from "@/lib/api";
import { UsersPage } from "./users-page";

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_USERS: DashboardUser[] = [
  {
    id: "user-1",
    username: "admin",
    display_name: "System Administrator",
    role: "admin",
    active: true,
    permissions: "read:punches write:punches read:devices write:devices manage:users",
    created_at: 1705315200,
    updated_at: 1720621800,
  },
  {
    id: "user-2",
    username: "hr_manager",
    display_name: "HR Manager",
    role: "operator",
    active: true,
    permissions: "read:punches write:punches read:devices",
    created_at: 1710979200,
    updated_at: 1720782000,
  },
  {
    id: "user-3",
    username: "shift_supervisor",
    display_name: "Shift Supervisor",
    role: "operator",
    active: true,
    permissions: "read:punches read:devices",
    created_at: 1711929600,
    updated_at: 1719705600,
  },
  {
    id: "user-4",
    username: "readonly_auditor",
    display_name: "Audit Viewer",
    role: "viewer",
    active: false,
    permissions: "read:punches",
    created_at: 1708012800,
    updated_at: 1715731200,
  },
];

function envelopeOk<T>(data: T) {
  return { data, meta: null, error: null };
}

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof UsersPage> = {
  title: "Pages/Users",
  component: UsersPage,
  tags: ["autodocs", "level:page"],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof UsersPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Four users: admin, HR manager, shift supervisor, and an inactive audit viewer. */
export const WithData: Story = {
  loaders: [
    async () => {
      await worker.use(http.get("/api/users", () => HttpResponse.json(envelopeOk(MOCK_USERS))));
    },
  ],
  render: () => <UsersPage />,
};

/** Empty state — no dashboard users yet. */
export const Empty: Story = {
  loaders: [
    async () => {
      await worker.use(http.get("/api/users", () => HttpResponse.json(envelopeOk([]))));
    },
  ],
  render: () => <UsersPage />,
};

/** Loading state — API responds with infinite delay. */
export const Loading: Story = {
  loaders: [
    async () => {
      await worker.use(
        http.get("/api/users", async () => {
          await delay("infinite");
          return HttpResponse.json(envelopeOk([]));
        }),
      );
    },
  ],
  render: () => <UsersPage />,
};

/** Error state — API returns 500. */
export const Error: Story = {
  name: "Error",
  loaders: [
    async () => {
      await worker.use(http.get("/api/users", () => new HttpResponse(null, { status: 500 })));
    },
  ],
  render: () => <UsersPage />,
};
