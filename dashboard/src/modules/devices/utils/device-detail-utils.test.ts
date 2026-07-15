import { describe, it, expect } from "vitest";
import {
  mapEventKind,
  calcStoragePct,
  storageBarVariant,
  calcUserPct,
} from "./device-detail-utils";

describe("device-detail-utils", () => {
  describe("mapEventKind", () => {
    it('maps events containing "offline" to offline', () => {
      expect(mapEventKind("device_went_offline")).toBe("offline");
      expect(mapEventKind("push_timeout_offline")).toBe("offline");
    });

    it('maps events containing "online" to online', () => {
      expect(mapEventKind("device_came_online")).toBe("online");
      expect(mapEventKind("reconnected_online")).toBe("online");
    });

    it("maps sync failures to warning", () => {
      expect(mapEventKind("sync_failed")).toBe("warning");
      expect(mapEventKind("sync_timeout_fail")).toBe("warning");
    });

    it("maps plain sync events to sync", () => {
      expect(mapEventKind("sync_completed")).toBe("sync");
      expect(mapEventKind("data_sync")).toBe("sync");
    });

    it("maps config/settings events to config", () => {
      expect(mapEventKind("config_changed")).toBe("config");
      expect(mapEventKind("settings_updated")).toBe("config");
    });

    it("falls back to provision for unknown types", () => {
      expect(mapEventKind("firmware_update")).toBe("provision");
      expect(mapEventKind("unknown_event")).toBe("provision");
    });

    it("handles null/undefined without crashing", () => {
      expect(mapEventKind(undefined)).toBe("provision");
      expect(mapEventKind(null)).toBe("provision");
    });

    it("offline has priority over online when both present", () => {
      // "offline" is checked first, so it wins
      expect(mapEventKind("device_offline_after_online")).toBe("offline");
    });
  });

  describe("calcStoragePct", () => {
    it("calculates percentage correctly", () => {
      expect(calcStoragePct(50, 100)).toBe(50);
      expect(calcStoragePct(0, 100)).toBe(0);
      expect(calcStoragePct(100, 100)).toBe(100);
    });

    it("caps at 100%", () => {
      expect(calcStoragePct(150, 100)).toBe(100);
      expect(calcStoragePct(200, 100)).toBe(100);
    });

    it("returns 0 when capacity is 0", () => {
      expect(calcStoragePct(50, 0)).toBe(0);
    });

    it("returns 0 for negative capacity", () => {
      expect(calcStoragePct(50, -1)).toBe(0);
    });
  });

  describe("storageBarVariant", () => {
    it("returns success below 60%", () => {
      expect(storageBarVariant(0)).toBe("success");
      expect(storageBarVariant(30)).toBe("success");
      expect(storageBarVariant(59)).toBe("success");
    });

    it("returns warning at 60-79%", () => {
      expect(storageBarVariant(60)).toBe("warning");
      expect(storageBarVariant(75)).toBe("warning");
      expect(storageBarVariant(79)).toBe("warning");
    });

    it("returns danger at 80% and above", () => {
      expect(storageBarVariant(80)).toBe("danger");
      expect(storageBarVariant(95)).toBe("danger");
      expect(storageBarVariant(100)).toBe("danger");
    });
  });

  describe("calcUserPct", () => {
    it("calculates user percentage", () => {
      expect(calcUserPct(50, 100)).toBe(50);
      expect(calcUserPct(116, 3000)).toBeCloseTo(3.87, 1);
    });

    it("returns 0 when capacity is 0", () => {
      expect(calcUserPct(10, 0)).toBe(0);
    });
  });
});
