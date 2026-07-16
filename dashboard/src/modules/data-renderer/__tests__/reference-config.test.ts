import { describe, it, expect } from "vitest";

import { REFERENCE_CONFIG } from "@/types/metadata";

/**
 * Architecture test: REFERENCE_CONFIG must only reference valid entity types.
 */
describe("REFERENCE_CONFIG architecture", () => {
  const validEntityTypes: Set<string> = new Set([
    "device", "punch", "user", "api_key", "audit", "employee", "department", "endpoint",
  ]);

  it("all referenceEntity values are valid EntityType strings", () => {
    for (const [_entity, fields] of Object.entries(REFERENCE_CONFIG)) {
      for (const [_field, config] of Object.entries(fields)) {
        expect(
          validEntityTypes.has(config.referenceEntity),
          `referenceEntity "${config.referenceEntity}" is not a valid EntityType`,
        ).toBe(true);
      }
    }
  });

  it("all referenceEntity values are non-empty", () => {
    for (const [_entity, fields] of Object.entries(REFERENCE_CONFIG)) {
      for (const [_field, config] of Object.entries(fields)) {
        expect(config.referenceEntity.length).toBeGreaterThan(0);
      }
    }
  });

  it("every reference has a referenceIdField (with fallback)", () => {
    for (const [_entity, fields] of Object.entries(REFERENCE_CONFIG)) {
      for (const [field, config] of Object.entries(fields)) {
        const idField = config.referenceIdField ?? field;
        expect(idField.length).toBeGreaterThan(0);
      }
    }
  });

  // ── Entity-specific config checks ───────────────────────────────────────

  it("punch.device_sn navigates to device", () => {
    expect(REFERENCE_CONFIG.punch.device_sn.referenceEntity).toBe("device");
    expect(REFERENCE_CONFIG.punch.device_sn.referenceIdField).toBe("device_sn");
    expect(REFERENCE_CONFIG.punch.device_sn.displayField).toBe("device_label");
  });

  it("punch.user_pin navigates to user", () => {
    expect(REFERENCE_CONFIG.punch.user_pin.referenceEntity).toBe("user");
    expect(REFERENCE_CONFIG.punch.user_pin.referenceIdField).toBe("user_pin");
  });

  it("punch.employee_name navigates to user via user_pin", () => {
    expect(REFERENCE_CONFIG.punch.employee_name.referenceEntity).toBe("user");
    expect(REFERENCE_CONFIG.punch.employee_name.referenceIdField).toBe("user_pin");
    expect(REFERENCE_CONFIG.punch.employee_name.displayField).toBe("employee_name");
  });

  it("employee.department navigates to department via department_id", () => {
    expect(REFERENCE_CONFIG.employee.department.referenceEntity).toBe("department");
    expect(REFERENCE_CONFIG.employee.department.referenceIdField).toBe("department_id");
    expect(REFERENCE_CONFIG.employee.department.displayField).toBe("department");
  });
});
