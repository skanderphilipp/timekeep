import { describe, it, expect } from "vitest";

import { buildBlocks, buildLegendItems, statusLabel } from "@/modules/attendance/compute";
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

/** Identity translator for tests — matches (key: string) => string signature. */
const t = (key: string) => key;

// ── buildLegendItems ─────────────────────────────────────────────────────

describe("buildLegendItems", () => {
	it("returns three legend items: Present, Break, Overtime", () => {
		const items = buildLegendItems(t);
		expect(items).toHaveLength(3);
		expect(items[0]).toEqual({ color: "present", label: "Present" });
		expect(items[1]).toEqual({ color: "warning", label: "Break" });
		expect(items[2]).toEqual({ color: "overtime", label: "Overtime" });
	});
});

// ── statusLabel ──────────────────────────────────────────────────────────

describe("statusLabel", () => {
	it("returns translated label for known statuses", () => {
		expect(statusLabel("check_in", t)).toBe("Check In");
		expect(statusLabel("check_out", t)).toBe("Check Out");
		expect(statusLabel("break_out", t)).toBe("Break Out");
	});

	it("falls back to the raw value for unknown statuses", () => {
		expect(statusLabel("unknown_status", t)).toBe("unknown_status");
	});
});

// ── buildBlocks ──────────────────────────────────────────────────────────

describe("buildBlocks", () => {
	it("returns empty array for empty punches", () => {
		expect(buildBlocks([], t)).toEqual([]);
	});

	it("pairs a single check_in → check_out into one present block", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 9 * 3600, status: "check_out" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("present");
	});

	it("pairs break sequence into present + break blocks", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 4 * 3600, status: "break_out" }),
			makePunch({ id: "p-3", timestamp: base + 5 * 3600, status: "break_in" }),
			makePunch({ id: "p-4", timestamp: base + 9 * 3600, status: "check_out" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].color).toBe("present");
		expect(blocks[1].color).toBe("warning");
	});

	it("renders overtime_in → overtime_out as overtime blocks", () => {
		const base = new Date("2026-07-15T17:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "overtime_in" }),
			makePunch({ id: "p-2", timestamp: base + 2 * 3600, status: "overtime_out" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("overtime");
	});

	it("handles orphaned check_in (no matching check_out)", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("present");
	});

	it("sorts punches by timestamp before building blocks", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-2", timestamp: base + 9 * 3600, status: "check_out" }),
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("present");
		expect(blocks[0].left).toBeGreaterThan(0);
		expect(blocks[0].width).toBeGreaterThan(0);
	});

	it("includes tooltip title with time range and status label", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 3600, status: "check_out" }),
		];
		const blocks = buildBlocks(punches, t);
		expect(blocks[0].title).toContain("Check In");
		expect(blocks[0].title).toMatch(/Check In: \d{2}:\d{2} - \d{2}:\d{2}/);
	});
});
