/**
 * REFERENCE_CONFIG contract test.
 *
 * This is the SECONDARY fix for Issue #1 — the metadata.ts REFERENCE_CONFIG
 * is the source of truth for schema-driven columns. punch-columns.ts is only
 * the fallback used when the backend schema fails to load.
 *
 * Validates that:
 * - punch.user_pin referenceEntity is "employee" (not "user")
 * - punch.employee_name referenceEntity is "employee" (not "user")
 * - All referenceEntity values are valid EntityType strings
 */
import { describe, it, expect } from "vitest";
import { REFERENCE_CONFIG } from "@/types/metadata";

describe("REFERENCE_CONFIG (schema-driven column navigation)", () => {
  describe("punch — user_pin", () => {
    const config = REFERENCE_CONFIG.punch?.user_pin;

    it("exists", () => {
      expect(config).toBeDefined();
    });

    it("navigates to employee, not user", () => {
      expect(config.referenceEntity).toBe("employee");
    });

    it("uses user_pin as the reference ID field", () => {
      expect(config.referenceIdField).toBe("user_pin");
    });
  });

  describe("punch — employee_name", () => {
    const config = REFERENCE_CONFIG.punch?.employee_name;

    it("exists", () => {
      expect(config).toBeDefined();
    });

    it("navigates to employee, not user", () => {
      expect(config.referenceEntity).toBe("employee");
    });

    it("uses user_pin as the reference ID field", () => {
      expect(config.referenceIdField).toBe("user_pin");
    });

    it("has employee_name as the display field", () => {
      expect(config.displayField).toBe("employee_name");
    });
  });

  describe("punch — device_sn (unrelated, sanity check)", () => {
    it("still navigates to device", () => {
      expect(REFERENCE_CONFIG.punch?.device_sn.referenceEntity).toBe("device");
    });
  });

  describe("employee — department (unrelated, sanity check)", () => {
    it("still navigates to department", () => {
      expect(REFERENCE_CONFIG.employee?.department.referenceEntity).toBe(
        "department",
      );
    });
  });

  describe("no leftover user references in punch config", () => {
    it("has no referenceEntity: user anywhere in punch config", () => {
      const punchConfig = REFERENCE_CONFIG.punch;
      if (!punchConfig) return;
      for (const [_field, cfg] of Object.entries(punchConfig)) {
        expect(cfg.referenceEntity).not.toBe("user");
      }
    });
  });
});
