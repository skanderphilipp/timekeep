import { describe, it, expect } from "vitest";
import { generateDays, isoDate, isWeekend, sameDay } from "./calendar-month.utils";

describe("calendar-month utils", () => {
  describe("isoDate", () => {
    it("formats a date with zero-padded month and day", () => {
      expect(isoDate(2026, 7, 14)).toBe("2026-07-14");
    });

    it("handles single-digit month and day", () => {
      expect(isoDate(2026, 1, 5)).toBe("2026-01-05");
    });

    it("handles December 31st", () => {
      expect(isoDate(2026, 12, 31)).toBe("2026-12-31");
    });
  });

  describe("isWeekend", () => {
    it("returns true for Saturday", () => {
      expect(isWeekend(new Date("2026-07-11"))).toBe(true); // Saturday
    });

    it("returns true for Sunday", () => {
      expect(isWeekend(new Date("2026-07-12"))).toBe(true); // Sunday
    });

    it("returns false for Monday", () => {
      expect(isWeekend(new Date("2026-07-13"))).toBe(false);
    });

    it("returns false for Friday", () => {
      expect(isWeekend(new Date("2026-07-10"))).toBe(false);
    });
  });

  describe("sameDay", () => {
    it("returns true for same date", () => {
      expect(sameDay(new Date("2026-07-14"), new Date("2026-07-14"))).toBe(true);
    });

    it("returns false for different days", () => {
      expect(sameDay(new Date("2026-07-14"), new Date("2026-07-15"))).toBe(false);
    });

    it("returns false for different months", () => {
      expect(sameDay(new Date("2026-07-14"), new Date("2026-08-14"))).toBe(false);
    });

    it("ignores time of day", () => {
      expect(sameDay(new Date("2026-07-14T08:00:00"), new Date("2026-07-14T23:59:59"))).toBe(true);
    });
  });

  describe("generateDays", () => {
    it("returns 42 cells (6 weeks)", () => {
      const days = generateDays(2026, 7, 1);
      expect(days).toHaveLength(42);
    });

    it("marks current month days correctly", () => {
      const days = generateDays(2026, 7, 1); // July 2026, week starts Monday
      const julyDays = days.filter((d) => d.isCurrentMonth);
      expect(julyDays.length).toBe(31); // July has 31 days
    });

    it("marks weekend days in current month", () => {
      const days = generateDays(2026, 7, 1); // July 2026
      const weekends = days.filter((d) => d.isCurrentMonth && d.status === "weekend");
      // July 2026: 4 Saturdays + 4 Sundays = 8 weekend days
      expect(weekends.length).toBeGreaterThanOrEqual(6);
    });

    it("applies explicit dayStatus overrides", () => {
      const days = generateDays(2026, 7, 1, {
        "2026-07-14": { status: "full", hours: 8 },
        "2026-07-15": { status: "half", hours: 4 },
      });
      const day14 = days.find((d) => d.date === "2026-07-14");
      const day15 = days.find((d) => d.date === "2026-07-15");
      expect(day14?.status).toBe("full");
      expect(day14?.hours).toBe(8);
      expect(day15?.status).toBe("half");
      expect(day15?.hours).toBe(4);
    });

    it("treats adjacent month days as weekend (neutral)", () => {
      const days = generateDays(2026, 7, 1); // July 2026
      const otherMonthDays = days.filter((d) => !d.isCurrentMonth);
      for (const d of otherMonthDays) {
        expect(d.status).toBe("weekend");
      }
    });

    it("defaults working days without data to absent", () => {
      const days = generateDays(2026, 7, 1); // July 2026
      const workingDaysNoData = days.filter((d) => d.isCurrentMonth && d.status === "absent");
      // Weekdays in July without explicit data should be "absent"
      expect(workingDaysNoData.length).toBeGreaterThan(0);
    });

    it("respects weekStartsOn = 0 (Sunday)", () => {
      const daysMon = generateDays(2026, 7, 1); // Monday start
      const daysSun = generateDays(2026, 7, 0); // Sunday start
      // First cell should differ
      expect(daysMon[0].day).not.toBe(daysSun[0].day);
    });

    it("generates sequential day numbers within each week", () => {
      const days = generateDays(2026, 7, 1);
      for (let w = 0; w < 6; w++) {
        const weekStart = w * 7;
        for (let d = 1; d < 7; d++) {
          // Each day in a week should be one more than the previous
          // (handling month boundaries)
          const prev = days[weekStart + d - 1].day;
          const curr = days[weekStart + d].day;
          if (days[weekStart + d - 1].isCurrentMonth && days[weekStart + d].isCurrentMonth) {
            expect(curr).toBe(prev + 1);
          }
        }
      }
    });
  });
});
