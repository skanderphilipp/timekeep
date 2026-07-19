/**
 * MSW request handlers for punch, employee attendance, and related API endpoints.
 *
 * These handlers simulate the Rust backend API so integration tests can
 * exercise the full data flow from component → TanStack Query → HTTP → response
 * without a running server.
 *
 * ALL handlers return the standard `ApiEnvelope<T>` shape: `{ data: T, meta?: PageMeta }`.
 * This matches what `apiGet<T>()` / `apiGetWithMeta<T>()` expect in the ky-based client.
 *
 * Usage in tests:
 * ```ts
 * import { setupServer } from "msw/node";
 * import { handlers } from "@/testing/mocks/handlers";
 *
 * const server = setupServer(...handlers);
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */

import { http, HttpResponse } from "msw";
import {
	makeWorkDay,
	makeEmployeeSummary,
	makeCalendarDay,
	dateToTimestamp,
} from "./data";
import type { Punch } from "@/lib/api/punches";

// ── In-memory store (reset between tests) ────────────────────────────────────

let punches: Punch[] = [];

export function seedPunches(data: Punch[]) {
	punches = [...data];
}

export function resetStore() {
	punches = [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSinceUntil(url: URL): { since?: number; to?: number } {
	const result: { since?: number; to?: number } = {};
	const sinceRaw = url.searchParams.get("since");
	const untilRaw = url.searchParams.get("until");
	if (sinceRaw) result.since = Number(sinceRaw);
	if (untilRaw) result.to = Number(untilRaw);
	return result;
}

function filterByDateRange(all: Punch[], since?: number, until?: number): Punch[] {
	return all.filter((p) => {
		if (since !== undefined && p.timestamp < since) return false;
		if (until !== undefined && p.timestamp > until) return false;
		return true;
	});
}

/**
 * Wrap data in the standard ApiEnvelope shape.
 * Every handler MUST use this so `apiGet<T>().json()` receives `envelope.data`.
 */
function ok<T>(data: T, meta?: Record<string, unknown>) {
	return HttpResponse.json({ data, ...(meta ? { meta } : {}) });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export const handlers = [
	// ═══════════════════════════════════════════════════════════════════
	// Punches — cursor-based infinite scroll
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/punches", ({ request }) => {
		const url = new URL(request.url);
		const { since, to } = parseSinceUntil(url);

		const limit = Number(url.searchParams.get("limit") ?? "20");
		const cursor = url.searchParams.get("cursor");

		let filtered = filterByDateRange(punches, since, to);

		// Device filter
		const deviceSns = url.searchParams.get("device_sns")?.split(",").filter(Boolean);
		if (deviceSns && deviceSns.length > 0) {
			filtered = filtered.filter((p) => deviceSns.includes(p.device_sn));
		}

		// User PIN filter
		const userPins = url.searchParams.get("user_pins")?.split(",").filter(Boolean);
		if (userPins && userPins.length > 0) {
			filtered = filtered.filter((p) => userPins.includes(p.user_pin));
		}

		// Status filter
		const status = url.searchParams.get("status");
		if (status) {
			filtered = filtered.filter((p) => p.status === status);
		}

		// Verify mode filter
		const verifyMode = url.searchParams.get("verify_mode");
		if (verifyMode) {
			filtered = filtered.filter((p) => p.verify_mode === verifyMode);
		}

		// Anomalies only
		const anomaliesOnly = url.searchParams.get("anomalies_only");
		if (anomaliesOnly === "true") {
			filtered = filtered.filter((p) => p.is_anomaly);
		}

		// Search
		const search = url.searchParams.get("search");
		if (search) {
			const q = search.toLowerCase();
			filtered = filtered.filter(
				(p) =>
					p.user_pin.toLowerCase().includes(q) ||
					(p.employee_name ?? "").toLowerCase().includes(q),
			);
		}

		// Sort
		const sortBy = url.searchParams.get("sort_by");
		const sortOrder = url.searchParams.get("sort_order") ?? "desc";
		if (sortBy === "timestamp") {
			filtered.sort((a, b) =>
				sortOrder === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
			);
		}

		// Cursor pagination
		let startIdx = 0;
		if (cursor) {
			const cursorIdx = filtered.findIndex((p) => p.id === cursor);
			if (cursorIdx >= 0) startIdx = cursorIdx + 1;
		}

		const page = filtered.slice(startIdx, startIdx + limit);
		const hasMore = startIdx + limit < filtered.length;
		const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

		return ok(
			{ punches: page },
			{ has_more: hasMore, next_cursor: nextCursor },
		);
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee work days
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees/:pin/work-days", ({ request }) => {
		const url = new URL(request.url);
		const fromRaw = url.searchParams.get("from");
		const toRaw = url.searchParams.get("to");

		// When NO date range is provided, simulate the backend default
		// (the BUG: backend returns only today's data or empty)
		const hasDateRange = fromRaw !== null || toRaw !== null;

		if (!hasDateRange) {
			const today = new Date().toISOString().split("T")[0]!;
			return ok({
				work_days: [
					makeWorkDay({
						date: today,
						status: "present",
					}),
				],
			});
		}

		// With date range: return data for the full range
		const from = fromRaw ? Number(fromRaw) : undefined;
		const to = toRaw ? Number(toRaw) : undefined;

		const workDays = [];
		if (from && to) {
			const fromDate = new Date(from * 1000);
			const toDate = new Date(to * 1000);
			for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
				const dateStr = d.toISOString().split("T")[0]!;
				workDays.push(
					makeWorkDay({
							date: dateStr,
							status: "present",
					}),
				);
			}
		}

		return ok({
			work_days: workDays.length > 0 ? workDays : [],
		});
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee summary
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees/:pin/summary", ({ request }) => {
		const url = new URL(request.url);
		const fromRaw = url.searchParams.get("from");
		const toRaw = url.searchParams.get("to");

		const hasDateRange = fromRaw !== null || toRaw !== null;

		if (!hasDateRange) {
			return ok(
				makeEmployeeSummary({
					total_days: 1,
					present_days: 1,
					absent_days: 0,
					late_days: 0,
				}),
			);
		}

		const from = fromRaw ? Number(fromRaw) : undefined;
		const to = toRaw ? Number(toRaw) : undefined;

		let daysInRange = 30;
		if (from && to) {
			daysInRange = Math.ceil((to - from) / 86400);
		}

		return ok(
			makeEmployeeSummary({
				total_days: daysInRange,
				present_days: Math.floor(daysInRange * 0.9),
				late_days: Math.floor(daysInRange * 0.05),
				absent_days: Math.floor(daysInRange * 0.05),
			}),
		);
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee calendar
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees/:pin/calendar", ({ request }) => {
		const url = new URL(request.url);
		const fromRaw = url.searchParams.get("from");
		const toRaw = url.searchParams.get("to");

		const hasDateRange = fromRaw !== null || toRaw !== null;

		if (!hasDateRange) {
			const today = new Date().toISOString().split("T")[0]!;
			return ok([makeCalendarDay({ date: today,  })]);
		}

		const from = fromRaw ? Number(fromRaw) : undefined;
		const to = toRaw ? Number(toRaw) : undefined;
		const days: ReturnType<typeof makeCalendarDay>[] = [];

		if (from && to) {
			const fromDate = new Date(from * 1000);
			const toDate = new Date(to * 1000);
			for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
				const dateStr = d.toISOString().split("T")[0]!;
				days.push(makeCalendarDay({ date: dateStr }));
			}
		}

		return ok(days);
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee CRUD
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees", () => {
		return ok([
			{
				id: "emp-alice",
				pin: "1001",
				name: "Alice Test",
				department_id: "dept-engineering",
				department: "Engineering",
				external_id: null,
				active: true,
				created_at: dateToTimestamp("2026-01-01"),
				updated_at: dateToTimestamp("2026-07-01"),
			},
			{
				id: "emp-bob",
				pin: "1002",
				name: "Bob Test",
				department_id: "dept-marketing",
				department: "Marketing",
				external_id: null,
				active: true,
				created_at: dateToTimestamp("2026-02-01"),
				updated_at: dateToTimestamp("2026-07-01"),
			},
		]);
	}),

	http.get("/api/employees/:id", ({ params }) => {
		return ok({
			id: params.id as string,
			pin: "1001",
			name: "Alice Test",
			department_id: "dept-engineering",
			department: "Engineering",
			active: true,
			created_at: dateToTimestamp("2026-01-01"),
			updated_at: dateToTimestamp("2026-07-01"),
		});
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Departments (for reference field options in RecordDetailRenderer)
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/departments", () => {
		return ok([
			{ id: "dept-engineering", name: "Engineering" },
			{ id: "dept-marketing", name: "Marketing" },
		]);
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Punch schema (metadata system)
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/punches/schema", () => {
		return ok({
			entity: "punch",
			columns: [
				{ field: "timestamp", label: "Time", type: "timestamp", sortable: true, filterable: false },
				{ field: "user_pin", label: "Employee", type: "text", sortable: true, filterable: true, facet_kind: "reference" },
				{ field: "status", label: "Status", type: "enum", sortable: true, filterable: true, facet_kind: "enum" },
				{ field: "device_sn", label: "Device", type: "text", sortable: true, filterable: true, facet_kind: "reference" },
				{ field: "verify_mode", label: "Method", type: "enum", sortable: false, filterable: true, facet_kind: "enum" },
			],
		});
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Punch facet filters
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/punches/filters", () => {
		return ok([
			{ dimension: "status", facets: [{ value: "check_in", count: 42, label: "Check In" }, { value: "check_out", count: 38, label: "Check Out" }] },
			{ dimension: "device_sn", facets: [{ value: "DEV-001", count: 50, label: "Main Entrance" }] },
		]);
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee schema
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees/schema", () => {
		return ok({
			entity: "employee",
			columns: [
				{ field: "pin", label: "PIN", type: "text", sortable: true, filterable: true },
				{ field: "name", label: "Name", type: "text", sortable: true, filterable: true, facet_kind: "reference" },
				{ field: "department", label: "Department", type: "text", sortable: true, filterable: true, facet_kind: "reference" },
				{ field: "active", label: "Active", type: "boolean", sortable: true, filterable: true },
			],
		});
	}),

	// ═══════════════════════════════════════════════════════════════════
	// Employee facet filters
	// ═══════════════════════════════════════════════════════════════════

	http.get("/api/employees/filters", () => {
		return ok([
			{ dimension: "department", facets: [{ value: "dept-engineering", count: 15, label: "Engineering" }, { value: "dept-marketing", count: 8, label: "Marketing" }] },
		]);
	}),
];
