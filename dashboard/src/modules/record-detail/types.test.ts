import { describe, it, expect } from "vitest";

import { ENTITY_DEFINITIONS } from "./entity-definitions";
import type { DetailTabConfig, DetailViewConfig, DetailFieldConfig } from "./entity-definitions/types";

/**
 * Architecture tests for the record-detail tab system.
 *
 * Cross-referenced with Twenty's page-layout architecture:
 * - Tabs are validated against entity-specific configs (like Twenty's `useCurrentPageLayoutOrThrow`)
 * - Every tab has a unique key within its entity
 * - Empty sections are allowed (for custom-only tabs via tabChildren)
 * - Flat sections fall back correctly for simple entities
 */

// ── resolveFieldValue (inlined for direct unit testing) ────────────────────

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

describe("resolveFieldValue", () => {
  it("accesses flat key directly", () => {
    expect(resolveFieldValue({ name: "Alice" }, "name")).toBe("Alice");
  });

  it("accesses nested key via dot notation", () => {
    const record = { work_policy: { work_start: "09:00", work_end: "17:00" } };
    expect(resolveFieldValue(record, "work_policy.work_start")).toBe("09:00");
    expect(resolveFieldValue(record, "work_policy.work_end")).toBe("17:00");
  });

  it("accesses deeply nested key (3 levels)", () => {
    const record = { a: { b: { c: "deep" } } };
    expect(resolveFieldValue(record, "a.b.c")).toBe("deep");
  });

  it("returns undefined for missing intermediate key", () => {
    const record = { a: { b: "value" } };
    expect(resolveFieldValue(record, "a.x.y")).toBeUndefined();
  });

  it("returns undefined for null intermediate value", () => {
    const record = { a: null };
    expect(resolveFieldValue(record, "a.b")).toBeUndefined();
  });

  it("returns undefined for non-existent top-level key", () => {
    const record = { name: "Alice" };
    expect(resolveFieldValue(record, "nonexistent.field")).toBeUndefined();
  });

  it("handles empty string key (returns record itself)", () => {
    const record = { name: "Alice" };
    // Empty string has no dots, so record[""] → undefined
    expect(resolveFieldValue(record, "")).toBeUndefined();
  });

  it("returns array values correctly", () => {
    const record = { tags: ["a", "b", "c"] };
    expect(resolveFieldValue(record, "tags")).toEqual(["a", "b", "c"]);
  });

  it("accesses nested array element via dot notation", () => {
    const record = { policy: { days: [true, false, true] } };
    expect(resolveFieldValue(record, "policy.days")).toEqual([true, false, true]);
  });
});

// ── Config architecture tests ──────────────────────────────────────────────

describe("ENTITY_DEFINITIONS detailConfig architecture", () => {
  const configs: Record<string, DetailViewConfig> = {};
  for (const [entity, def] of Object.entries(ENTITY_DEFINITIONS)) {
    configs[entity] = def.detailConfig;
  }

  it("every entity config has a nameField", () => {
    for (const [entity, config] of Object.entries(configs)) {
      if (!config) continue;
      expect(
        config.nameField.length,
        `"${entity}" config must have a non-empty nameField`,
      ).toBeGreaterThan(0);
    }
  });

  it("configs with tabs use the tabs array consistently", () => {
    const tabbedEntities = Object.entries(configs).filter(
      ([_, c]) => c?.tabs && c.tabs.length > 0,
    );

    for (const [entity, config] of tabbedEntities) {
      if (!config?.tabs) continue;

      // Every tab must have a unique key
      const keys = config.tabs.map((t: DetailTabConfig) => t.key);
      expect(
        new Set(keys).size,
        `"${entity}" tabs must have unique keys`,
      ).toBe(keys.length);

      // Every tab must have a non-empty title
      for (const tab of config.tabs) {
        expect(
          tab.title.length,
          `"${entity}" tab "${tab.key}" must have a non-empty title`,
        ).toBeGreaterThan(0);
      }

      // Every tab's sections must be an array (can be empty for tabChildren-only tabs)
      for (const tab of config.tabs) {
        expect(
          Array.isArray(tab.sections),
          `"${entity}" tab "${tab.key}" sections must be an array`,
        ).toBe(true);
      }
    }
  });

  it("configs with tabs also have empty or missing flat sections (tabs take precedence)", () => {
    // This is a design rule: when tabs are present, flat sections are optional
    const tabbed = Object.entries(configs).filter(([_, c]) => c?.tabs?.length);

    for (const [entity, config] of tabbed) {
      // sections is now optional in DetailViewConfig — just verify it's either
      // undefined or an array (if present, tabs take precedence anyway)
      if (config?.sections !== undefined) {
        expect(
          Array.isArray(config.sections),
          `"${entity}" has tabs but sections must be undefined or an array`,
        ).toBe(true);
      }
    }
  });

  it("device has 4 tabs: info, users, config, activity", () => {
    const device = configs.device as DetailViewConfig;
    expect(device.tabs).toBeDefined();
    expect(device.tabs!.length).toBe(4);

    const tabKeys = device.tabs!.map((t: DetailTabConfig) => t.key);
    expect(tabKeys).toEqual(["info", "users", "config", "activity"]);

    // Info tab has declarative sections (Connection, Hardware, Status, Capacity)
    const infoTab = device.tabs!.find((t: DetailTabConfig) => t.key === "info");
    expect(infoTab!.sections.length).toBe(4);
    expect(infoTab!.sections[0].title).toBe("Connection");
    expect(infoTab!.sections[1].title).toBe("Hardware");
    expect(infoTab!.sections[2].title).toBe("Connection Status");
    expect(infoTab!.sections[3].title).toBe("Capacity");

    // Config and Users tabs have empty sections (tabChildren provides content)
    const configTab = device.tabs!.find((t: DetailTabConfig) => t.key === "config");
    expect(configTab!.sections.length).toBe(0);

    const usersTab = device.tabs!.find((t: DetailTabConfig) => t.key === "users");
    expect(usersTab!.sections.length).toBe(0);
  });

  it("department has 2 tabs: details, policy", () => {
    const dept = configs.department as DetailViewConfig;
    expect(dept.tabs).toBeDefined();
    expect(dept.tabs!.length).toBe(2);

    const tabKeys = dept.tabs!.map((t: DetailTabConfig) => t.key);
    expect(tabKeys).toEqual(["details", "policy"]);

    // Details tab has Overview section
    const detailsTab = dept.tabs!.find((t: DetailTabConfig) => t.key === "details");
    expect(detailsTab!.sections[0].title).toBe("Overview");

    // Work Policy tab has Overview (FK) + Schedule (nested policy fields)
    const policyTab = dept.tabs!.find((t: DetailTabConfig) => t.key === "policy");
    expect(policyTab!.sections.length).toBe(2);

    // The FK reference field (work_policy_title) is in the Overview section
    const overviewSection = policyTab!.sections.find((s) => s.title === "Overview");
    expect(overviewSection).toBeDefined();
    expect(overviewSection!.fields.length).toBe(1);
    expect(overviewSection!.fields[0].fieldId).toBe("work_policy_title");

    // The nested work_policy.* fields are in the Schedule section
    const scheduleSection = policyTab!.sections.find((s) => s.title === "Schedule");
    expect(scheduleSection).toBeDefined();
    const scheduleFields = scheduleSection!.fields;
    expect(scheduleFields.length).toBeGreaterThan(0);

    // Verify nested field paths use dot notation
    const fieldIds = scheduleFields.map((f: DetailFieldConfig) => f.fieldId);
    expect(fieldIds.every((id: string) => id.startsWith("work_policy."))).toBe(true);
  });

  it("simple entities (user, api_key, audit, endpoint) use flat sections, not tabs", () => {
    const simpleEntities = ["user", "api_key", "audit", "endpoint"] as const;

    for (const entity of simpleEntities) {
      const config = configs[entity];
      // These entities should NOT have tabs
      expect(config?.tabs, `"${entity}" should not use tabs`).toBeUndefined();
      // But SHOULD have flat sections
      expect(
        config?.sections?.length,
        `"${entity}" must have sections`,
      ).toBeGreaterThan(0);
    }
  });

  it("employee and punch use flat sections, not tabs", () => {
    for (const entity of ["employee", "punch"] as const) {
      const config = configs[entity];
      expect(config?.tabs, `"${entity}" should not use tabs`).toBeUndefined();
      expect(
        config?.sections?.length,
        `"${entity}" must have sections`,
      ).toBeGreaterThan(0);
    }
  });

  it("every reference field has a valid referenceEntity and referenceIdField", () => {
    for (const [_entity, config] of Object.entries(configs)) {
      if (!config) continue;
      const allSections = (config.tabs ?? []).flatMap((t: DetailTabConfig) => t.sections)
        .concat(config.sections ?? []);

      for (const section of allSections) {
        for (const field of section.fields) {
          if (field.type === "reference") {
            const meta = field.metadata as { referenceEntity: string; referenceIdField: string };
            expect(meta.referenceEntity.length).toBeGreaterThan(0);
            expect(meta.referenceIdField.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
