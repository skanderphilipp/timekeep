/**
 * compute-bugfixes.test.ts — RED tests for Bugs 8, 11, 12.
 *
 * These use LOCAL timestamps (new Date(y,m,d,h,m)) to ensure
 * timezone-independent test results regardless of test runner location.
 */

import { describe, it, expect } from "vitest";
import { classifyDayFromPunches } from "./compute";
import { makePunch } from "@/testing/mocks/data";
import type { Punch } from "@/lib/api/punches";

/** Create a punch at a specific LOCAL time. */
function localPunch(dateStr: string, hour: number, min: number, status: Punch["status"]): Punch {
	const [y, m, d] = dateStr.split("-").map(Number);
	const localDate = new Date(y!, m! - 1, d!, hour, min, 0);
	return makePunch({ timestamp: Math.floor(localDate.getTime() / 1000), status });
}

describe("Bug 8 FIX: local hours for late detection", () => {
	it("RED: 9:30 AM local → late", () => {
		const punches: Punch[] = [
			localPunch("2026-07-15", 9, 30, "check_in"),
			makePunch({ timestamp: Math.floor(new Date(2026, 6, 15, 18, 30).getTime() / 1000), status: "check_out" }),
		];
		expect(classifyDayFromPunches(punches).status).toBe("late");
	});

	it("RED: 8:00 AM local → not late, full", () => {
		const punches: Punch[] = [
			localPunch("2026-07-15", 8, 0, "check_in"),
			makePunch({ timestamp: Math.floor(new Date(2026, 6, 15, 17, 0).getTime() / 1000), status: "check_out" }),
		];
		const r = classifyDayFromPunches(punches);
		expect(r.status).toBe("full");
		expect(r.hours).toBeCloseTo(9, 0);
	});

	it("RED: 8:59 AM local → not late", () => {
		const punches: Punch[] = [
			localPunch("2026-07-15", 8, 59, "check_in"),
			makePunch({ timestamp: Math.floor(new Date(2026, 6, 15, 17, 59).getTime() / 1000), status: "check_out" }),
		];
		expect(classifyDayFromPunches(punches).status).toBe("full");
	});
});

describe("Bug 11 FIX: break periods don't inflate hours", () => {
	it("RED: 8-12 + break + 13-17 = 8h total", () => {
		const punches: Punch[] = [
			localPunch("2026-07-15", 8, 0, "check_in"),
			localPunch("2026-07-15", 12, 0, "break_in"),
			localPunch("2026-07-15", 13, 0, "break_out"),
			localPunch("2026-07-15", 17, 0, "check_out"),
		];
		const r = classifyDayFromPunches(punches);
		expect(r.hours).toBeCloseTo(8, 0);
		expect(r.status).toBe("full");
	});
});

describe("Bug 12 FIX: overtime adds to total", () => {
	it("RED: 9h regular + 2h overtime = 11h", () => {
		const punches: Punch[] = [
			localPunch("2026-07-15", 8, 0, "check_in"),
			localPunch("2026-07-15", 17, 0, "check_out"),
			localPunch("2026-07-15", 17, 0, "overtime_in"),
			localPunch("2026-07-15", 19, 0, "overtime_out"),
		];
		const r = classifyDayFromPunches(punches);
		expect(r.hours).toBeCloseTo(11, 0);
	});
});
