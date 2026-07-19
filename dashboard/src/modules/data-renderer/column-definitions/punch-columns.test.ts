/**
 * Punch column definitions — reference entity validation test.
 *
 * Validates Issue #1 fix: the `user_pin` and `employee_name` columns
 * MUST point to `referenceEntity: "employee"`, not `"user"`.
 * This ensures clicking an employee name in the punch table opens
 * the correct employee detail panel (with pin, name, department, etc.)
 * instead of the dashboard user detail panel (with username, role, etc.).
 */
import { describe, it, expect } from "vitest";
import { createPunchColumns } from "../column-definitions/punch-columns";
import type { ReferenceFieldMetadata } from "../types";

/**
 * Minimal Lingui-compatible translation function for tests.
 * Returns the message descriptor's ID as the translated string.
 */
function mockT(descriptor: { id?: string; message?: string }): string {
  return descriptor.id ?? descriptor.message ?? "";
}

describe("punch-columns", () => {
  const columns = createPunchColumns(mockT as any);

  describe("user_pin column", () => {
    const col = columns.find((c) => c.id === "user_pin");

    it("exists", () => {
      expect(col).toBeDefined();
    });

    it("is a reference type", () => {
      expect(col!.type).toBe("reference");
    });

    it("navigates to employee entity (not user)", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.referenceEntity).toBe("employee");
    });

    it("uses user_pin as the reference ID field", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.referenceIdField).toBe("user_pin");
    });
  });

  describe("employee_name column", () => {
    const col = columns.find((c) => c.id === "employee_name");

    it("exists", () => {
      expect(col).toBeDefined();
    });

    it("is a reference type", () => {
      expect(col!.type).toBe("reference");
    });

    it("navigates to employee entity (not user)", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.referenceEntity).toBe("employee");
    });

    it("uses user_pin as the reference ID field", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.referenceIdField).toBe("user_pin");
    });

    it("uses employee_name as the display field", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.displayField).toBe("employee_name");
    });
  });

  describe("device_sn column (unrelated, sanity check)", () => {
    const col = columns.find((c) => c.id === "device_sn");

    it("navigates to device entity", () => {
      const meta = col!.metadata as ReferenceFieldMetadata;
      expect(meta.referenceEntity).toBe("device");
    });
  });
});
