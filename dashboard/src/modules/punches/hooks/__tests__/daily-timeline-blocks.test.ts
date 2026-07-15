import { describe, it, expect } from "vitest";

import { buildBlocks, buildLegendItems, statusLabel } from "../../components/daily-timeline/daily-timeline-blocks";
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

/** Identity translator for tests — handles both Lingui MessageDescriptor and string fallback. */
const _ = (descriptor: { id?: string; message?: string } | string) => {
	if (typeof descriptor === "string") return descriptor;
	return descriptor.message ?? descriptor.id ?? "";
};

// ── buildLegendItems ─────────────────────────────────────────────────────

describe("buildLegendItems", () => {
	it("returns three legend items: Present, Break, Overtime", () => {
		const items = buildLegendItems(_);
		expect(items).toHaveLength(3);
		expect(items[0]).toEqual({ color: "present", label: "Present" });
		expect(items[1]).toEqual({ color: "warning", label: "Break" });
		expect(items[2]).toEqual({ color: "overtime", label: "Overtime" });
	});
});

// ── statusLabel ──────────────────────────────────────────────────────────

describe("statusLabel", () => {
	it("returns translated label for known statuses", () => {
		expect(statusLabel("check_in", _)).toBe("Check In");
		expect(statusLabel("check_out", _)).toBe("Check Out");
		expect(statusLabel("break_out", _)).toBe("Break Out");
	});

	it("falls back to the raw value for unknown statuses", () => {
		expect(statusLabel("unknown_status", _)).toBe("unknown_status");
	});
});

// ── buildBlocks ──────────────────────────────────────────────────────────

describe("buildBlocks", () => {
	it("returns empty array for empty punches", () => {
		expect(buildBlocks([], _)).toEqual([]);
	});

	it("pairs a single check_in → check_out into one present block", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
			makePunch({ id: "p-2", timestamp: base + 9 * 3600, status: "check_out" }),
		];
		const blocks = buildBlocks(punches, _);
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
		const blocks = buildBlocks(punches, _);
		// buildBlocks pairs: check_in→break_out (present), break_in→check_out (warning)
		// Note: break_out acts as "close current block", break_in opens a new block
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
		const blocks = buildBlocks(punches, _);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("overtime");
	});

	it("handles orphaned check_in (no matching check_out)", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		const punches = [
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
		];
		const blocks = buildBlocks(punches, _);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].color).toBe("present");
	});

	it("sorts punches by timestamp before building blocks", () => {
		const base = new Date("2026-07-15T08:00:00Z").getTime() / 1000;
		// Intentionally out of order
		const punches = [
			makePunch({ id: "p-2", timestamp: base + 9 * 3600, status: "check_out" }),
			makePunch({ id: "p-1", timestamp: base, status: "check_in" }),
		];
		const blocks = buildBlocks(punches, _);
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
		const blocks = buildBlocks(punches, _);
		expect(blocks[0].title).toContain("Check In");
		// Title format: "Check In: HH:MM - HH:MM" — times are local timezone
		expect(blocks[0].title).toMatch(/Check In: \d{2}:\d{2} - \d{2}:\d{2}/);
	});
});
