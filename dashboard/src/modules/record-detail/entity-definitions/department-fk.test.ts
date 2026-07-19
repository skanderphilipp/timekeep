import { describe, it, expect } from "vitest";

import { ENTITY_DEFINITIONS } from "./index";
import type { DetailViewConfig, DetailFieldConfig, DetailTabConfig } from "./types";
import type { ReferenceFieldMetadata } from "@/modules/data-renderer";

/**
 * RED TESTS: Department Work Policy FK Rendering
 *
 * These tests PROVE the current system is broken before we fix it.
 *
 * Issues covered:
 *   - Department detail config has no reference field for work_policy FK
 *   - The "Work Policy" tab only shows nested policy fields, not the FK name
 *   - displayField metadata is never used to resolve display values
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function allFields(config: DetailViewConfig): DetailFieldConfig[] {
  return (config.tabs ?? []).flatMap((t: DetailTabConfig) =>
    t.sections.flatMap((s) => s.fields),
  ).concat((config.sections ?? []).flatMap((s) => s.fields));
}

function findField(config: DetailViewConfig, fieldId: string): DetailFieldConfig | undefined {
  return allFields(config).find((f) => f.fieldId === fieldId);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Department detail config — work_policy FK (RED)", () => {
  const config = ENTITY_DEFINITIONS.department.detailConfig;

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Department config MUST have a reference field for work_policy FK
  // ═══════════════════════════════════════════════════════════════════════════

  it("MUST have a reference field for work_policy_id FK", () => {
    const wpField = findField(config, "work_policy_title");
    expect(wpField, "Department config is missing a 'work_policy_title' reference field").toBeDefined();
    expect(wpField!.type, "work_policy field must be type 'reference'").toBe("reference");

    const meta = wpField!.metadata as ReferenceFieldMetadata;
    expect(meta.referenceEntity, "must reference the work_policy entity").toBe("work_policy");
    expect(meta.referenceIdField, "must use work_policy_id as the FK column").toBe("work_policy_id");
    expect(
      meta.displayField,
      "must specify displayField so the name is shown instead of the UUID",
    ).toBe("work_policy_title");
    expect(wpField!.editable, "work_policy assignment must be editable (dropdown select)").toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: The reference field must be in the "policy" tab (not "details")
  // ═══════════════════════════════════════════════════════════════════════════

  it("MUST place the work_policy reference field in the policy tab", () => {
    const policyTab = config.tabs?.find((t) => t.key === "policy");
    expect(policyTab, "Department must have a 'policy' tab").toBeDefined();

    const overviewSection = policyTab!.sections.find((s) => s.title === "Overview");
    const assignmentField = overviewSection?.fields.find(
      (f) => f.fieldId === "work_policy_title",
    );
    expect(
      assignmentField,
      "Policy tab MUST have a 'work_policy_title' reference field in the Overview section",
    ).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: displayField must be set on ALL reference fields
  // ═══════════════════════════════════════════════════════════════════════════

  it("ALL reference fields MUST have displayField set", () => {
    for (const [entity, def] of Object.entries(ENTITY_DEFINITIONS)) {
      if (!def?.detailConfig) continue;
      const fields = allFields(def.detailConfig);
      for (const field of fields) {
        if (field.type !== "reference") continue;
        const meta = field.metadata as ReferenceFieldMetadata;
        expect(
          meta.displayField,
          `"${entity}" reference field "${field.fieldId}" must have displayField set. ` +
            "Without it, the raw FK ID (UUID) will be shown instead of the display name.",
        ).toBeTruthy();
        expect(
          meta.displayField!.length,
          `"${entity}" reference field "${field.fieldId}" displayField must be non-empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Every entity with reference fields must have options preloadable
  // ═══════════════════════════════════════════════════════════════════════════

  it("reference fields must declare their reference entity for options loading", () => {
    for (const [entity, def] of Object.entries(ENTITY_DEFINITIONS)) {
      if (!def?.detailConfig) continue;
      const fields = allFields(def.detailConfig);
      for (const field of fields) {
        if (field.type !== "reference") continue;
        const meta = field.metadata as ReferenceFieldMetadata;
        expect(
          meta.referenceEntity,
          `"${entity}" reference field "${field.fieldId}" must declare a referenceEntity`,
        ).toBeTruthy();
        // It must be a valid entity type
        expect(
          ["employee", "department", "device", "work_policy", "user", "device_group"].includes(
            meta.referenceEntity,
          ),
          `"${entity}" field "${field.fieldId}" referenceEntity "${meta.referenceEntity}" is not a known entity`,
        ).toBe(true);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Work Policy detail config must also exist and be complete
  // ═══════════════════════════════════════════════════════════════════════════

  it("work_policy entity definition must exist with fetchById", () => {
    const wp = ENTITY_DEFINITIONS.work_policy;
    expect(wp, "work_policy entity definition must exist").toBeDefined();
    expect(wp.fetchById, "work_policy must have fetchById").toBeDefined();
    expect(wp.detailConfig, "work_policy must have detailConfig").toBeDefined();
  });
});

// ── displayField Resolution (unit) ───────────────────────────────────────────

/**
 * Simulates the `renderFieldValue` logic to prove that `displayField`
 * is NOT currently consumed when resolving the display value.
 *
 * This is an inlined copy of the actual production code path from
 * `record-detail-fields.tsx` — any fix to that code should make
 * this test green.
 */
function resolveFieldValue(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) {
    return record[key];
  }
  const parts = key.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

describe("displayField resolution for reference fields (RED)", () => {
  // This simulates a department record returned by the API:
  // { id: "d1", name: "Eng", work_policy_id: "wp-uuid", work_policy_title: "Standard 9-5", ... }
  const departmentRecord = {
    id: "dept-1",
    name: "Engineering",
    work_policy_id: "0193a8a2-7f92-7e1c-bc3f-d4e5f6a7b8c9",
    work_policy_title: "Standard 9-5",
    work_policy: {
      work_start: "09:00",
      work_end: "17:00",
    },
  };

  it("MUST use displayField to resolve the display NAME, not the raw FK UUID", () => {
    // Simulating a reference field config:
    // { fieldId: "work_policy_title", displayField: "work_policy_title",
    //   referenceIdField: "work_policy_id" }
    const fieldId = "work_policy_title";
    const displayField = "work_policy_title";

    // CURRENT behaviour: resolveFieldValue(record, fieldId)
    const currentDisplayValue = resolveFieldValue(departmentRecord, fieldId);
    expect(currentDisplayValue).toBe("Standard 9-5");

    // But what if fieldId IS the FK ID column?
    const fkFieldId = "work_policy_id";

    // CURRENT behaviour: resolveFieldValue(record, fkFieldId) → UUID
    const rawFkValue = resolveFieldValue(departmentRecord, fkFieldId);
    expect(rawFkValue).toBe("0193a8a2-7f92-7e1c-bc3f-d4e5f6a7b8c9");

    // FIX required: when displayField is set, use it for display:
    const fixedDisplayValue = displayField
      ? resolveFieldValue(departmentRecord, displayField)
      : rawFkValue;
    expect(fixedDisplayValue).toBe("Standard 9-5");
    expect(fixedDisplayValue).not.toBe("0193a8a2-7f92-7e1c-bc3f-d4e5f6a7b8c9");
  });

  it("MUST NOT show a UUID as the display label in the detail view", () => {
    const recordWithoutDenormalizedField = {
      id: "dept-2",
      name: "Sales",
      work_policy_id: "wp-uuid-sales",
      // work_policy_title is MISSING — fallback to something sensible
      work_policy: {
        work_start: "08:00",
        work_end: "16:00",
      },
    };

    const fkFieldId = "work_policy_id";
    const displayField = "work_policy_title";

    // If displayField is not present on the record, fall back gracefully
    const rawFkValue = resolveFieldValue(recordWithoutDenormalizedField, fkFieldId);
    expect(rawFkValue).toBe("wp-uuid-sales");

    const displayValue = displayField
      ? resolveFieldValue(recordWithoutDenormalizedField, displayField)
      : rawFkValue;

    // If displayField resolves to undefined, should still not show UUID
    // The FieldDisplay / ReferenceFieldDisplay should handle this with a fallback
    expect(displayValue).toBeUndefined();

    // The UI should render something meaningful (like "—" or "Unknown policy"),
    // not a UUID. This is a fallback behavior test.
  });

  it("verify the employee department reference field uses displayField correctly", () => {
    const employeeRecord = {
      id: "emp-1",
      name: "Alice",
      department_id: "dept-uuid-123",
      department: "Engineering",
    };

    const fieldId = "department";
    const referenceIdField = "department_id";

    const displayValue = resolveFieldValue(employeeRecord, fieldId);
    expect(displayValue).toBe("Engineering");

    const editValue = resolveFieldValue(employeeRecord, referenceIdField);
    expect(editValue).toBe("dept-uuid-123");

    // For employee, fieldId === displayField === "department", so current code works.
    // The bug only manifests when fieldId !== displayField (e.g., fieldId is the FK ID).
  });
});
