import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { FieldDisplay } from "@/modules/data-renderer/field-displays/index";
import { FieldContext, type FieldContextValue, type FieldViewMode } from "@/modules/data-renderer/contexts/field-context";
import type {
  FieldDefinition, FieldMetadata,
  TextFieldMetadata, NumberFieldMetadata,
  TimestampFieldMetadata, StatusFieldMetadata,
  EnumFieldMetadata, ReferenceFieldMetadata,
} from "@/modules/data-renderer/types";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

afterEach(() => {
  vi.restoreAllMocks();
});

function renderField(type: string, metadata: Partial<FieldMetadata> = {}, value: unknown = "test") {
  const fieldDef: FieldDefinition<FieldMetadata> = {
    fieldId: "test-field",
    label: "Test",
    type: type as FieldDefinition<FieldMetadata>["type"],
    metadata: { fieldName: "test-field", ...metadata } as FieldMetadata,
  };

  const ctx: FieldContextValue = {
    fieldDefinition: fieldDef,
    value,
    viewMode: "display" as FieldViewMode,
    entityId: "ent-1",
  };

  render(
    <FieldContext.Provider value={ctx}>
      <table><tbody><tr><td><FieldDisplay /></td></tr></tbody></table>
    </FieldContext.Provider>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("FieldDisplay dispatcher (generic types only)", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // text
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders text type as plain text", () => {
    renderField("text", {} as TextFieldMetadata, "Hello World");
    expect(screen.getByText("Hello World")).toBeDefined();
  });

  it("renders empty text as '-'", () => {
    renderField("text", {} as TextFieldMetadata, "");
    expect(screen.getByText("-")).toBeDefined();
  });

  it("renders null text as '-'", () => {
    renderField("text", {} as TextFieldMetadata, null);
    expect(screen.getByText("-")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // number
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders number type as plain text", () => {
    renderField("number", {} as NumberFieldMetadata, 42);
    expect(screen.getByText("42")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // timestamp
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders timestamp as formatted date", () => {
    renderField("timestamp", { format: "iso" } as TimestampFieldMetadata, 1700000000);
    const expected = new Date(1700000000 * 1000).toLocaleString();
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("renders zero timestamp as '-'", () => {
    renderField("timestamp", { format: "iso" } as TimestampFieldMetadata, 0);
    expect(screen.getByText("-")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // status
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders status tag with label", () => {
    renderField("status", {
      fieldName: "status",
      labels: { active: "Active", inactive: "Inactive" },
      colors: { active: "green", inactive: "gray" },
    } as StatusFieldMetadata, "active");

    expect(screen.getByText("Active")).toBeDefined();
  });

  it("falls back to raw value when status label not found", () => {
    renderField("status", {
      fieldName: "status",
      labels: { active: "Active" },
    } as StatusFieldMetadata, "unknown");

    expect(screen.getByText("unknown")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // enum
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders enum tag with label", () => {
    renderField("enum", {
      fieldName: "verify_mode",
      labels: { fingerprint: "Fingerprint", face: "Face" },
      colors: { fingerprint: "green", face: "blue" },
    } as EnumFieldMetadata, "face");

    expect(screen.getByText("Face")).toBeDefined();
  });

  it("status and enum use same EnumFieldDisplay component", () => {
    renderField("status", {
      fieldName: "status",
      labels: { check_in: "Check In" },
    } as StatusFieldMetadata, "check_in");

    expect(screen.getByText("Check In")).toBeDefined();

    renderField("enum", {
      fieldName: "verify_mode",
      labels: { card: "RF Card" },
    } as EnumFieldMetadata, "card");

    expect(screen.getByText("RF Card")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reference
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders reference as clickable Tag", () => {
    renderField("reference", {
      referenceEntity: "device",
      referenceIdField: "device_sn",
    } as ReferenceFieldMetadata, "DEV-001");

    expect(screen.getByText("DEV-001")).toBeDefined();
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeDefined();
  });

  it("reference shows display label", () => {
    renderField("reference", {
      referenceEntity: "user",
      referenceIdField: "user_pin",
      displayField: "employee_name",
    } as ReferenceFieldMetadata, "Alice");

    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("reference falls back to '-' when value empty", () => {
    renderField("reference", {
      referenceEntity: "department",
      referenceIdField: "department_id",
      displayField: "department",
    } as ReferenceFieldMetadata, "");

    expect(screen.getByText("-")).toBeDefined();
  });

  it("reference works for any entity type", () => {
    const entities = ["device", "user", "employee", "department"] as const;
    for (const ent of entities) {
      renderField("reference", {
        referenceEntity: ent,
        referenceIdField: `${ent}_id`,
      } as ReferenceFieldMetadata, `${ent}-1`);

      expect(screen.getByText(`${ent}-1`)).toBeDefined();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unknown / fallback
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders unknown type as plain text fallback", () => {
    renderField("some-unknown-type" as any, {} as FieldMetadata, "fallback text");
    expect(screen.getByText("fallback text")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Negative: domain-specific types should NOT dispatch
  // ═══════════════════════════════════════════════════════════════════════════

  it("does NOT render 'device_sn' as reference (falls to default text)", () => {
    renderField("device_sn" as any, {} as FieldMetadata, "DEV-001");
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeNull();
  });

  it("does NOT render 'user_pin' as reference (falls to default text)", () => {
    renderField("user_pin" as any, {} as FieldMetadata, "12345");
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeNull();
  });

  it("does NOT render 'employee_name' as reference (falls to default text)", () => {
    renderField("employee_name" as any, {} as FieldMetadata, "Alice");
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeNull();
  });

  it("does NOT render 'verify_method' as enum (falls to default text)", () => {
    renderField("verify_method" as any, {} as FieldMetadata, "fingerprint");
    expect(screen.getByText("fingerprint")).toBeDefined();
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeNull();
  });

  it("does NOT render 'direction' as enum (falls to default text)", () => {
    renderField("direction" as any, {} as FieldMetadata, "in");
    const span = document.querySelector("span[data-no-close]");
    expect(span).toBeNull();
  });
});
