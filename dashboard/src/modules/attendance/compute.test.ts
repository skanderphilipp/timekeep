/**
 * compute.test.ts — Pure logic tests for attendance classification.
 *
 * Covers:
 *  - classifyDayFromPunches (Bug 8: timezone handling)
 *  - aggregateDayStatus (multi-employee calendar aggregation)
 *  - buildBlocks (timeline block construction)
 *  - computeAttendanceSummary
 *  - formatDuration
 *  - Edge cases: empty input, breaks, overtime, anomalous punches
 *
 * NEW BUGS FOUND by tests:
 *  - Bug 11: break_in is NOT tracked as period end → breaks don't subtract from hours
 *  - Bug 12: overtime_in is NOT treated as period start → overtime not counted
 */

import { describe, it, expect } from "vitest";
import {
	classifyDayFromPunches,
	aggregateDayStatus,
	buildBlocks,
	computeAttendanceSummary,
	formatDuration,
} from "./compute";
import { makePunch } from "@/testing/mocks/data";
import type { Punch } from "@/lib/api/punches";

const t = (key: string) => key;

// ── Helpers (use LOCAL timestamps — timezone-independent) ─────────────────

/** Create a Unix timestamp at a specific LOCAL date and time. */
function localTs(year: number, month: number, day: number, hour: number, min = 0): number {
	return Math.floor(new Date(year, month - 1, day, hour, min, 0).getTime() / 1000);
}

function makeDayPair(pin: string, date: string, inHour: number, outHour: number): Punch[] {
	const [y, m, d] = date.split("-").map(Number);
	return [
		makePunch({ user_pin: pin, employee_name: `Emp ${pin}`, timestamp: localTs(y!, m!, d!, inHour), status: "check_in" }),
		makePunch({ user_pin: pin, employee_name: `Emp ${pin}`, timestamp: localTs(y!, m!, d!, outHour), status: "check_out" }),
	];
}

// ═══════════════════════════════════════════════════════════════════════════
// classifyDayFromPunches
// ═══════════════════════════════════════════════════════════════════════════

describe("classifyDayFromPunches", () => {
	describe("basic classification", () => {
		it('returns "absent" when no punches exist', () => {
			const r = classifyDayFromPunches([]);
			expect(r.status).toBe("absent");
			expect(r.hours).toBeNull();
		});

		it('returns "full" when working 8+ hours', () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 8, 17));
			expect(r.status).toBe("full");
			expect(r.hours).toBeCloseTo(9, 0);
		});

		it('returns "half" when working <4 hours with early check-in', () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 8, 10));
			expect(r.status).toBe("half");
			expect(r.hours).toBeCloseTo(2, 0);
		});

		it('returns "late" when working <4h but check-in >= 9 AM UTC (late > half)', () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 9, 11));
			expect(r.status).toBe("late");
			expect(r.hours).toBeCloseTo(2, 0);
		});

		it('returns "late" when check-in at or after 9 AM UTC', () => {
			const punches: Punch[] = [
				makePunch({ timestamp: localTs(2026, 7, 15, 9, 30), status: "check_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 18, 0), status: "check_out" }),
			];
			const r = classifyDayFromPunches(punches);
			// Late + 8.5h → late (priority over full)
			expect(r.status).toBe("late");
		});

		it('returns "full" when check-in before 9 AM (not late)', () => {
				// 8:55 AM check-in → not late, 17:00 check-out → 8.08h → full
				const punches: Punch[] = [
					makePunch({ timestamp: localTs(2026, 7, 15, 8, 55), status: "check_in" }),
					makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
				];
				const r = classifyDayFromPunches(punches);
				expect(r.status).toBe("full");
			});
	});

	describe("Bug 8: timezone-dependent late detection", () => {
		it("BUG_DOC: uses UTC hours (getUTCHours) — 3 AM UTC = not late", () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 3, 12));
			// getUTCHours() = 3 → < 9 → not late → 9h → full
			// But for UTC-5, 3 AM UTC = 10 PM previous day local
			expect(r.status).toBe("full");
		});

		it("BUG_DOC: 14:00 UTC → marked late (UTC+5 would be 7 PM local)", () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 14, 23));
			expect(r.status).toBe("late");
		});

		it("BUG_DOC: exactly 09:00 UTC is considered late (inclusive boundary)", () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 9, 17));
			expect(r.status).toBe("late");
		});
	});

	describe("Bug 11 & 12: break/overtime period handling", () => {
		it("FIXED: break_in ends morning period, break_out starts afternoon → 8h total", () => {
			const punches: Punch[] = [
				makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 12, 0), status: "break_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 13, 0), status: "break_out" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
			];
			const r = classifyDayFromPunches(punches);
			// break_in ends morning (4h), break_out starts afternoon (4h) = 8h
			expect(r.hours).toBeCloseTo(8, 0);
		});

		it("FIXED: overtime_in starts new period → 9h + 2h = 11h", () => {
			const punches: Punch[] = [
				makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "overtime_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 19, 0), status: "overtime_out" }),
			];
			const r = classifyDayFromPunches(punches);
			// 9h regular + 2h overtime = 11h
			expect(r.hours).toBeCloseTo(11, 0);
		});

		it("returns absent with null hours for open check-in", () => {
			const r = classifyDayFromPunches([
				makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			]);
			expect(r.hours).toBeNull();
			expect(r.status).toBe("absent");
		});
	});

	describe("edge cases", () => {
		it("sorts punches internally (handles unsorted input)", () => {
			const r = classifyDayFromPunches([
				makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			]);
			expect(r.status).toBe("full");
			expect(r.hours).toBeCloseTo(9, 0);
		});

		it("handles multiple check_in/check_out pairs", () => {
			const r = classifyDayFromPunches([
				makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 12, 0), status: "check_out" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 13, 0), status: "check_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
			]);
			expect(r.hours).toBeCloseTo(8, 0);
		});

		it("returns absent null for non-check_in punches only", () => {
			const r = classifyDayFromPunches([
				makePunch({ timestamp: localTs(2026, 7, 15, 10, 0), status: "break_in" }),
				makePunch({ timestamp: localTs(2026, 7, 15, 10, 30), status: "break_out" }),
			]);
			expect(r.hours).toBeNull();
			expect(r.status).toBe("absent");
		});

		it("late status takes precedence over full hours", () => {
			const r = classifyDayFromPunches(makeDayPair("1001", "2026-07-15", 10, 19));
			expect(r.status).toBe("late");
			expect(r.hours).toBeCloseTo(9, 0);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// aggregateDayStatus
// ═══════════════════════════════════════════════════════════════════════════

describe("aggregateDayStatus", () => {
	it('returns "absent" for empty punch list', () => {
		const r = aggregateDayStatus([]);
		expect(r.status).toBe("absent");
		expect(r.presentCount).toBe(0);
		expect(r.totalCount).toBe(0);
	});

	it('returns "full" when ≥80% present and none late', () => {
		const r = aggregateDayStatus([
			...makeDayPair("1001", "2026-07-15", 8, 17),
			...makeDayPair("1002", "2026-07-15", 8, 18),
			...makeDayPair("1003", "2026-07-15", 8, 16),
		]);
		expect(r.status).toBe("full");
		expect(r.presentCount).toBe(3);
		expect(r.totalCount).toBe(3);
	});

	it('returns "late" when any employee is late (even if ≥80% present)', () => {
		const r = aggregateDayStatus([
			...makeDayPair("1001", "2026-07-15", 8, 17),
			...makeDayPair("1002", "2026-07-15", 8, 17),
			...makeDayPair("1003", "2026-07-15", 10, 18), // late
		]);
		expect(r.status).toBe("late");
		expect(r.presentCount).toBe(3);
	});

	it('returns "full" when 100% present (1 out of 1)', () => {
		const r = aggregateDayStatus(makeDayPair("1001", "2026-07-15", 8, 17));
		expect(r.status).toBe("full");
		expect(r.presentCount).toBe(1);
	});

	it('returns "half" when 50% present (1 out of 2)', () => {
		const r = aggregateDayStatus([
			...makeDayPair("1001", "2026-07-15", 8, 17),
			makePunch({ user_pin: "1002", employee_name: "Emp 1002", timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
		]);
		expect(r.status).toBe("half");
		expect(r.presentCount).toBe(1);
		expect(r.totalCount).toBe(2);
	});

	it("computes average hours across present employees", () => {
		const r = aggregateDayStatus([
			...makeDayPair("1001", "2026-07-15", 8, 16), // 8h
			...makeDayPair("1002", "2026-07-15", 9, 17), // 8h
		]);
		expect(r.avgHours).toBeCloseTo(8, 0);
	});

	it("all absent → absent status", () => {
		const r = aggregateDayStatus([
			makePunch({ user_pin: "1001", timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			makePunch({ user_pin: "1002", timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
		]);
		expect(r.status).toBe("absent");
		expect(r.presentCount).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// buildBlocks
// ═══════════════════════════════════════════════════════════════════════════

describe("buildBlocks", () => {
	it("builds a present block from check_in→check_out", () => {
		const blocks = buildBlocks(makeDayPair("1001", "2026-07-15", 8, 17), t);
		expect(blocks.length).toBeGreaterThan(0);
		expect(blocks[0]!.color).toBe("present");
	});

	it("renders break blocks in warning color", () => {
		const blocks = buildBlocks([
			makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 12, 0), status: "break_in" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 13, 0), status: "break_out" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
		], t);
		const warning = blocks.filter((b) => b.color === "warning");
		expect(warning.length).toBeGreaterThan(0);
	});

	it("renders overtime blocks in overtime color", () => {
		const blocks = buildBlocks([
			makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "overtime_in" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 19, 0), status: "overtime_out" }),
		], t);
		const ot = blocks.filter((b) => b.color === "overtime");
		expect(ot.length).toBeGreaterThan(0);
	});

	it("handles empty punch array", () => {
		expect(buildBlocks([], t)).toEqual([]);
	});

	it("handles open check-in with open-ended block", () => {
		const blocks = buildBlocks([
			makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
		], t);
		expect(blocks.length).toBe(1);
		expect(blocks[0]!.color).toBe("present");
	});

	it("sorts punches internally before building", () => {
		const blocks = buildBlocks([
			makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
		], t);
		expect(blocks.filter((b) => b.color === "present").length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// computeAttendanceSummary
// ═══════════════════════════════════════════════════════════════════════════

describe("computeAttendanceSummary", () => {
	it("computes summary for a full work day", () => {
		const s = computeAttendanceSummary([
			makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out" }),
		]);
		expect(s.totalPunches).toBe(2);
		expect(s.firstCheckIn).toBe(localTs(2026, 7, 15, 8, 0));
		expect(s.lastCheckOut).toBe(localTs(2026, 7, 15, 17, 0));
	});

	it("counts anomalies", () => {
		const s = computeAttendanceSummary([
			makePunch({ timestamp: localTs(2026, 7, 15, 8, 0), status: "check_in" }),
			makePunch({ timestamp: localTs(2026, 7, 15, 17, 0), status: "check_out", is_anomaly: true }),
		]);
		expect(s.anomalyCount).toBe(1);
	});

	it("handles empty punches", () => {
		const s = computeAttendanceSummary([]);
		expect(s.totalPunches).toBe(0);
		expect(s.firstCheckIn).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDuration
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDuration", () => {
	it('formats zero as "0m"', () => {
		expect(formatDuration(0)).toBe("0m");
	});
	it("formats minutes only", () => {
		expect(formatDuration(45)).toBe("45m");
	});
	it("formats hours only", () => {
		expect(formatDuration(120)).toBe("2h");
	});
	it("formats hours and minutes", () => {
		expect(formatDuration(150)).toBe("2h 30m");
	});
	it("rounds minutes (not whole value)", () => {
		expect(formatDuration(151)).toBe("2h 31m");
	});
	it("handles negative", () => {
		expect(formatDuration(-10)).toBe("0m");
	});
});
