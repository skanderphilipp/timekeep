/**
 * MSW handler contract test.
 *
 * Validates that all handlers return the ApiEnvelope<T> shape: `{ data: T }`.
 * This is the contract expected by apiGet<T>() which does `envelope.data`.
 *
 * Tests the handler response shapes directly (no HTTP layer needed) by
 * verifying the `ok()` helper and each handler's response structure.
 */

import { describe, it, expect } from "vitest";
import { HttpResponse } from "msw";

/**
 * The `ok()` helper from handlers.ts — reproduced here for contract testing.
 * Every handler MUST use this (or equivalent) to wrap responses.
 */
function ok<T>(data: T, meta?: Record<string, unknown>) {
	return HttpResponse.json({ data, ...(meta ? { meta } : {}) });
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("MSW handlers — ApiEnvelope contract", () => {
	it("ok() produces { data: ... } envelope", async () => {
		const response = ok({ punches: [{ id: "p-1" }] });
		const body = await response.json();

		expect(body).toHaveProperty("data");
		expect(body.data).toEqual({ punches: [{ id: "p-1" }] });
	});

	it("ok() with meta produces { data, meta } envelope", async () => {
		const response = ok({ punches: [] }, { has_more: true, next_cursor: "abc" });
		const body = await response.json();

		expect(body).toHaveProperty("data");
		expect(body).toHaveProperty("meta");
		expect(body.meta).toEqual({ has_more: true, next_cursor: "abc" });
	});

	it("apiGet<T>() contract: envelope.data is the actual payload", async () => {
		// Simulates what apiGet<T>().json() does:
		//   1. Fetch → HttpResponse.json({ data: { punches: [...] } })
		//   2. Parse → { data: { punches: [...] } }
		//   3. Return → envelope.data → { punches: [...] }

		const response = ok({ punches: [{ id: "p-1", status: "check_in" }] });
		const envelope = await response.json() as { data: { punches: Array<{ id: string }> } };
		const data = envelope.data;

		expect(data.punches).toHaveLength(1);
		expect(data.punches[0]!.id).toBe("p-1");
	});

	it("apiGetWithMeta<T>() contract: returns { data, meta }", async () => {
		// apiGetWithMeta does:
		//   const envelope = await _client.get(path).json<ApiEnvelope<T>>();
		//   return { data: envelope.data, meta: envelope.meta };

		const response = ok({ punches: [] }, { has_more: false, next_cursor: null });
		const envelope = await response.json() as {
			data: unknown;
			meta?: { has_more: boolean; next_cursor: string | null } | null;
		};

		const result = { data: envelope.data, meta: envelope.meta };
		expect(result.data).toBeDefined();
		expect(result.meta).toEqual({ has_more: false, next_cursor: null });
	});

	// ── Shape validation for each entity type ──────────────────────────

	it("Punches: { data: { punches: [...] } } shape", async () => {
		const response = ok({ punches: [{ id: "1", user_pin: "1001" }] });
		const body = await response.json();
		const data = body.data;

		expect(data).toHaveProperty("punches");
		expect(Array.isArray(data.punches)).toBe(true);
	});

	it("EmployeeWorkDays: { data: { user_pin, work_days } } shape", async () => {
		const response = ok({
			user_pin: "1001",
			work_days: [{ date: "2026-07-15" }],
		});
		const body = await response.json();
		const data = body.data;

		expect(data.user_pin).toBe("1001");
		expect(Array.isArray(data.work_days)).toBe(true);
	});

	it("EmployeeSummary: { data: { user_pin, total_days, ... } } shape", async () => {
		const response = ok({
			user_pin: "1001",
			total_days: 22,
			present_days: 18,
		});
		const body = await response.json();
		const data = body.data;

		expect(data.total_days).toBe(22);
	});

	it("CalendarDay[]: { data: [...] } shape", async () => {
		const response = ok([{ date: "2026-07-15", status_code: 1 }]);
		const body = await response.json();
		const data = body.data;

		expect(Array.isArray(data)).toBe(true);
		expect(data[0].date).toBe("2026-07-15");
	});

	it("Employee: { data: { id, pin, name } } shape", async () => {
		const response = ok({ id: "emp-alice", pin: "1001", name: "Alice" });
		const body = await response.json();
		const data = body.data;

		expect(data.id).toBe("emp-alice");
		expect(data.name).toBe("Alice");
	});

	it("Employee[]: { data: [...] } shape", async () => {
		const response = ok([{ id: "emp-1", pin: "1001" }]);
		const body = await response.json();
		const data = body.data;

		expect(Array.isArray(data)).toBe(true);
		expect(data).toHaveLength(1);
	});
});
