import { describe, it, expect } from "vitest";

import { computeAttendanceSummary, formatDuration } from "../../components/daily-timeline/attendance-summary";
import type { Punch } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────

function makePunch(overrides: Partial<Punch> = {}): Punch {
	return {
		id: overrides.id ?? "p-1",
		user_pin: overrides.user_pin ?? "12345",
		timestamp: overrides.timestamp ?? 1700000000,
		status: overrides.status ?? "check_in",
		verify_mode: overrides.verify_mode ?? "fingerprint",
		device_sn: overrides.device_sn ?? "DEV001",
		is_anomaly: overrides.is_anomaly ?? false,
	};
}

// ── formatDuration ───────────────────────────────────────────────────────

describe("formatDuration", () => {
	it("returns 0m for zero or negative minutes", () => {
		expect(formatDuration(0)).toBe("0m");
		expect(formatDuration(-5)).toBe("0m");
	});

	it("formats minutes only when under 60", () => {
		expect(formatDuration(42)).toBe("42m");
		expect(formatDuration(1)).toBe("1m");
	});

	it("formats hours only when exact", () => {
		expect(formatDuration(60)).toBe("1h");
		expect(formatDuration(180)).toBe("3h");
	});

	it("formats hours and minutes", () => {
		expect(formatDuration(90)).toBe("1h 30m");
		expect(formatDuration(485)).toBe("8h 5m");
	});
});

// ── computeAttendanceSummary ─────────────────────────────────────────────

describe("computeAttendanceSummary", () => {
	it("returns zeros for empty punches", () => {
		const summary = computeAttendanceSummary([]);
		expect(summary.totalPunches).toBe(0);
		expect(summary.firstCheckIn).toBeNull();
		expect(summary.lastCheckOut).toBeNull();
		expect(summary.presentMinutes).toBe(0);
		expect(summary.breakMinutes).toBe(0);
		expect(summary.overtimeMinutes).toBe(0);
		expect(summary.anomalyCount).toBe(0);
		expect(summary.events).toHaveLength(0);
	});

	it("counts total punches and anomaly count", () => {
		const punches = [
			makePunch({ id: "p-1", timestamp: 1700000000, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: 1700003600, status: "check_out", is_anomaly: true }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.totalPunches).toBe(2);
		expect(summary.anomalyCount).toBe(1);
	});

	it("computes present time from check_in → check_out", () => {
		// check_in at 08:00, check_out at 17:00 = 9 hours = 540 minutes
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 9 * 3600, status: "check_out" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.presentMinutes).toBe(540);
		expect(summary.breakMinutes).toBe(0);
	});

	it("computes break time from break_out → break_in", () => {
		// check_in at 08:00, break_out at 12:00, break_in at 13:00, check_out at 17:00
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 4 * 3600, status: "break_out" }),
			makePunch({ id: "p-3", timestamp: base + 5 * 3600, status: "break_in" }),
			makePunch({ id: "p-4", timestamp: base + 9 * 3600, status: "check_out" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.presentMinutes).toBe(480); // 8 hours total present
		expect(summary.breakMinutes).toBe(60);    // 1 hour break
	});

	it("computes overtime from overtime_in → overtime_out", () => {
		const base = new Date("2026-07-15T17:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "overtime_in" }),
			makePunch({ id: "p-2", timestamp: base + 2 * 3600, status: "overtime_out" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.overtimeMinutes).toBe(120);
		expect(summary.presentMinutes).toBe(0);
	});

	it("handles orphaned check_in (still present)", () => {
		// check_in with no check_out — counted as present up to the last event
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.totalPunches).toBe(1);
		// Orphaned check_in: duration = lastTs - inBlock = 0
		// (since there's only one punch, lastTs === inBlock timestamp)
		expect(summary.presentMinutes).toBe(0);
	});

	it("records first and last event timestamps", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 8 * 3600, status: "check_out" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.firstCheckIn).toBe(base);
		expect(summary.lastCheckOut).toBe(base + 8 * 3600);
	});

	it("generates chronological event list with formatted times", () => {
		const base = new Date("2026-07-15T08:30:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 3600, status: "break_out" }),
		];
		const summary = computeAttendanceSummary(punches);
		expect(summary.events).toHaveLength(2);
		expect(summary.events[0].status).toBe("check_in");
		expect(summary.events[0].isAnomaly).toBe(false);
		expect(summary.events[1].status).toBe("break_out");
	});
});
