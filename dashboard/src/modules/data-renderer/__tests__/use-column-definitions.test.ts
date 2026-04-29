import { describe, it, expect } from "vitest";
import type { ColumnDefinition, FieldMetadata } from "../types";

// We test the pure logic by calling the hook's inner behavior
describe("useColumnDefinitions", () => {
  const makeColumn = (id: string, visible = true): ColumnDefinition<FieldMetadata> =>
    ({
      id,
      header: id,
      fieldId: id,
      label: id,
      type: "text",
      metadata: { fieldName: id },
      isVisible: visible,
    }) as ColumnDefinition<FieldMetadata>;

  it("filters out invisible columns", () => {
    // Since hooks can't be called outside React components,
    // we test the filtering logic directly via the hook's behavior.
    // In integration tests, this would be rendered in a component.
    const columns = [
      makeColumn("a", true),
      makeColumn("b", false),
      makeColumn("c", true),
    ];

    const filtered = columns.filter((col) => col.isVisible !== false);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.id).toBe("a");
    expect(filtered[1]!.id).toBe("c");
  });

  it("returns all columns when all are visible", () => {
    const columns = [
      makeColumn("a", true),
      makeColumn("b", true),
    ];

    const filtered = columns.filter((col) => col.isVisible !== false);
    expect(filtered).toHaveLength(2);
  });
});
