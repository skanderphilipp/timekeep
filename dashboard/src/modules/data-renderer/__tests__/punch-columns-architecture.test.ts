import { describe, it, expect } from "vitest";

import { createPunchColumns } from "@/modules/data-renderer/column-definitions/punch-columns";
import type { ReferenceFieldMetadata, StatusFieldMetadata, EnumFieldMetadata, TimestampFieldMetadata } from "@/modules/data-renderer/types";

/**
 * Architecture test: hardcoded fallback columns must only use generic types.
 */
describe("createPunchColumns (hardcoded fallback)", () => {
  const _ = (descriptor: { id?: string; message?: string }) =>
    descriptor.message ?? descriptor.id ?? "";

  const columns = createPunchColumns(_);

  it("produces 6 columns", () => {
    expect(columns).toHaveLength(6);
  });

  it("all columns use only generic types", () => {
    const validTypes = new Set(["text", "number", "timestamp", "status", "enum", "reference"]);

    for (const col of columns) {
      expect(
        validTypes.has(col.type),
        `Column "${col.id}" has invalid type "${col.type}". Only generic types allowed.`,
      ).toBe(true);
    }
  });

  it("timestamp column has type 'timestamp' with iso format", () => {
    const col = columns.find((c: any) => c.id === "timestamp")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("timestamp");
    const meta = col.metadata as TimestampFieldMetadata;
    expect(meta.format).toBe("iso");
  });

  it("user_pin column has type 'reference' → employee", () => {
    const col = columns.find((c: any) => c.id === "user_pin")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("reference");
    const meta = col.metadata as ReferenceFieldMetadata;
    expect(meta.referenceEntity).toBe("employee");
    expect(meta.referenceIdField).toBe("user_pin");
  });

  it("employee_name column has type 'reference' → employee (via user_pin)", () => {
    const col = columns.find((c: any) => c.id === "employee_name")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("reference");
    const meta = col.metadata as ReferenceFieldMetadata;
    expect(meta.referenceEntity).toBe("employee");
    expect(meta.referenceIdField).toBe("user_pin");
    expect(meta.displayField).toBe("employee_name");
  });

  it("device_sn column has type 'reference' → device", () => {
    const col = columns.find((c: any) => c.id === "device_sn")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("reference");
    const meta = col.metadata as ReferenceFieldMetadata;
    expect(meta.referenceEntity).toBe("device");
    expect(meta.referenceIdField).toBe("device_sn");
    expect(meta.displayField).toBe("device_label");
  });

  it("status column has type 'status' with labels/colors", () => {
    const col = columns.find((c: any) => c.id === "status")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("status");
    const meta = col.metadata as StatusFieldMetadata;
    expect(meta.labels).toBeDefined();
    expect(Object.keys(meta.labels!).length).toBeGreaterThan(0);
    expect(meta.colors).toBeDefined();
  });

  it("verify_mode column has type 'enum' with labels/colors", () => {
    const col = columns.find((c: any) => c.id === "verify_mode")!;
    expect(col).toBeDefined();
    expect(col.type).toBe("enum");
    const meta = col.metadata as EnumFieldMetadata;
    expect(meta.labels).toBeDefined();
    expect(meta.colors).toBeDefined();
    expect(meta.labels!.fingerprint).toBeDefined();
    expect(meta.labels!.face).toBeDefined();
    expect(meta.colors!.fingerprint).toBe("green");
    expect(meta.colors!.face).toBe("blue");
  });

  // ── Negative: no domain-specific types ─────────────────────────────────

  it("does NOT use domain-specific type 'device_sn' as FieldType", () => {
    const domainTypes = columns.filter((c: any) => c.type === "device_sn");
    expect(domainTypes).toHaveLength(0);
  });

  it("does NOT use domain-specific type 'user_pin' as FieldType", () => {
    expect(columns.filter((c: any) => c.type === "user_pin")).toHaveLength(0);
  });

  it("does NOT use domain-specific type 'employee_name' as FieldType", () => {
    expect(columns.filter((c: any) => c.type === "employee_name")).toHaveLength(0);
  });

  it("does NOT use domain-specific type 'verify_method' as FieldType", () => {
    expect(columns.filter((c: any) => c.type === "verify_method")).toHaveLength(0);
  });

  it("does NOT use domain-specific type 'direction' as FieldType", () => {
    expect(columns.filter((c: any) => c.type === "direction")).toHaveLength(0);
  });
});
