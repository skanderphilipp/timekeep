import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";

import { AuditLogPage } from "./audit-log-page";
import { worker, createHandlers } from "@/testing/mocks";
import {
  MOCK_AUDIT_EVENTS,
  MOCK_AUDIT_EVENTS_EMPTY,
} from "@/testing/mocks/data";

// ── Meta ──────────────────────────────────────────────────────────────────

const meta = {
  title: "Pages/Audit Log",
  component: AuditLogPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full audit log page with server-side search, sort, and filtering. " +
                    "Renders via the metadata-driven DataListView with schema-driven columns from useSchemaColumns('audit').",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AuditLogPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Stories ────────────────────────────────────────────────────────────────

/**
 * **Default** — Rich audit log with 10 events across multiple actors,
 * actions, and statuses. Demonstrates the full list page: search bar,
 * sortable columns, status badges, and timestamps.
 *
 * **Stakeholder verification:**
 * - Can you see all audit events with timestamps, actors, and actions?
 * - Can you sort by clicking column headers (Time, Actor, Action, Resource)?
 * - Can you search by typing in the search bar (e.g., "admin" or "device")?
 * - Are success/failure statuses visually distinct?
 */
export const Primary: Story = {
  name: "Default (10 events)",
  loaders: [
    async () => {
      await worker.use(
        ...createHandlers({
          auditEvents: MOCK_AUDIT_EVENTS,
        }),
      );
    },
  ],
};

/**
 * **Empty** — No audit events exist. Shows the empty state with a
 * descriptive message.
 *
 * **Stakeholder verification:**
 * - Is the empty state message clear and helpful?
 * - Does the search bar still appear (so user can verify there's nothing)?
 */
export const Empty: Story = {
  name: "Empty (no events)",
  loaders: [
    async () => {
      await worker.use(
        ...createHandlers({
          auditEvents: MOCK_AUDIT_EVENTS_EMPTY,
        }),
      );
    },
  ],
};

/**
 * **Error** — The audit API returns a 500 error. Shows the error state
 * with a retry button.
 *
 * **Stakeholder verification:**
 * - Is the error message clear?
 * - Does the "Try again" button appear and trigger a refetch?
 */
export const Error: Story = {
  name: "Error (API failure)",
  loaders: [
    async () => {
      // Override just the audit endpoint to return an error
      await worker.use(
        http.get("/api/audit", () =>
          HttpResponse.json(
            { data: null, meta: null, error: { code: "internal_error", message: "Database connection failed — please try again." } },
            { status: 500 },
          ),
        ),
      );
    },
  ],
};
