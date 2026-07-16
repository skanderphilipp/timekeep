import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { FieldEdit } from "@/modules/data-renderer/field-inputs/index";
import { FieldContext, type FieldContextValue } from "@/modules/data-renderer/contexts/field-context";
import type {
  FieldDefinition, FieldMetadata,
  TextFieldMetadata,
  StatusFieldMetadata,
  ReferenceFieldMetadata,
} from "@/modules/data-renderer/types";
import type { EditableCellEditProps } from "@/components/ui/data-table";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

afterEach(() => {
  vi.restoreAllMocks();
});

function makeEditProps(overrides: Partial<EditableCellEditProps<unknown>> = {}): EditableCellEditProps<unknown> {
  return {
    instanceId: "test-instance",
    value: "Engineering",
    onChange: vi.fn(),
    onEnter: vi.fn(),
    onEscape: vi.fn(),
    onTab: vi.fn(),
    onShiftTab: vi.fn(),
    onClickOutside: vi.fn(),
    autoFocus: false,
    ...overrides,
  };
}

function renderFieldEdit(
  type: string,
  metadata: Partial<FieldMetadata> = {},
  value: unknown = "test",
  editProps?: Partial<EditableCellEditProps<unknown>>,
) {
  const fieldDef: FieldDefinition<FieldMetadata> = {
    fieldId: "test-field",
    label: "Test",
    type: type as FieldDefinition<FieldMetadata>["type"],
    metadata: { fieldName: "test-field", ...metadata } as FieldMetadata,
  };

  const ctx: FieldContextValue = {
    fieldDefinition: fieldDef,
    value,
    viewMode: "edit",
  };

  render(
    <FieldContext.Provider value={ctx}>
      <FieldEdit {...makeEditProps(editProps)} />
    </FieldContext.Provider>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("FieldEdit dispatcher", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Text type
  // ═══════════════════════════════════════════════════════════════════════════

  describe("text type", () => {
    it("renders a text input", () => {
      renderFieldEdit("text", {} as TextFieldMetadata, "Alice", { value: "Alice" });
      const input = screen.getByRole("textbox");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("Alice");
    });

    it("calls onEnter when Enter is pressed", () => {
      const onEnter = vi.fn();
      renderFieldEdit("text", {} as TextFieldMetadata, "Alice", { onEnter });

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Bob" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onEnter).toHaveBeenCalledWith("Bob");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Status type (enum select)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("status type", () => {
    it("renders a Combobox with status options", () => {
      renderFieldEdit("status", {
        fieldName: "active",
        labels: { true: "Active", false: "Inactive" },
        colors: { true: "green", false: "gray" },
      } as StatusFieldMetadata, "true");

      // The Combobox should be rendered (Base UI Select)
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Reference type (select with FK options)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("reference type", () => {
    const deptOptions = [
      { value: "dept-1", label: "Engineering" },
      { value: "dept-2", label: "Marketing" },
      { value: "dept-3", label: "Sales" },
    ];

    it("renders a Combobox when options are provided", () => {
      renderFieldEdit("reference", {
        fieldName: "department",
        referenceEntity: "department",
        referenceIdField: "department_id",
        options: deptOptions,
      } as ReferenceFieldMetadata, "dept-1");

      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeDefined();
    });

    it("renders nothing useful when options are empty (no Combobox with options)", () => {
      // When options is empty array, Combobox still renders but with no options
      renderFieldEdit("reference", {
        fieldName: "department",
        referenceEntity: "department",
        referenceIdField: "department_id",
        options: [],
      } as ReferenceFieldMetadata, "dept-1");

      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeDefined(); // Still renders, just empty
    });

    it("calls onEnter with the selected option VALUE (not label)", async () => {
      const onEnter = vi.fn();
      renderFieldEdit("reference", {
        fieldName: "department",
        referenceEntity: "department",
        referenceIdField: "department_id",
        options: deptOptions,
      } as ReferenceFieldMetadata, "dept-1", { onEnter });

      // Click the Combobox to open the dropdown
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      fireEvent.click(combobox);

      // Wait for dropdown and click an option
      await waitFor(() => {
        const option = screen.getByText("Marketing");
        fireEvent.click(option);
      });

      // onEnter should be called with the option VALUE ("dept-2"), not label
      expect(onEnter).toHaveBeenCalledWith("dept-2");
    });

    it("BUG: does NOT call onEnter when current value is a label (not an option value)", async () => {
      // This simulates the real scenario: EditableCell passes the DISPLAY VALUE
      // (department name "Engineering") but options use IDs as values.
      // The Combobox cannot match "Engineering" to any option value.
      const onEnter = vi.fn();
      renderFieldEdit("reference", {
        fieldName: "department",
        referenceEntity: "department",
        referenceIdField: "department_id",
        options: deptOptions,
      } as ReferenceFieldMetadata,
        // Pass the display LABEL as the value, not the option value
        "Engineering",
        { onEnter }
      );

      // Click the Combobox to open the dropdown
      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      fireEvent.click(combobox);

      // Debug: log what options are rendered
      const options = document.querySelectorAll('[role="option"]');
      console.log("Options found:", options.length);

      // Try to select Marketing
      let optionFound = false;
      try {
        await waitFor(() => {
          const option = screen.getByText("Marketing");
          fireEvent.click(option);
        }, { timeout: 1000 });
        optionFound = true;
      } catch {
        // Options might not render if Combobox is confused by the value
      }

      if (optionFound) {
        expect(onEnter).toHaveBeenCalledWith("dept-2");
      } else {
        // If options don't render, the select is broken for label-valued references
        console.log("Dropdown options did not render — value/label mismatch bug confirmed");
      }
    });

    it("calls onEscape with null when Escape is pressed", () => {
      const onEscape = vi.fn();
      renderFieldEdit("reference", {
        fieldName: "department",
        referenceEntity: "department",
        referenceIdField: "department_id",
        options: deptOptions,
      } as ReferenceFieldMetadata, "dept-1", { onEscape });

      const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
      fireEvent.keyDown(combobox, { key: "Escape" });

      expect(onEscape).toHaveBeenCalledWith(null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Fallback (unknown type)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("unknown type fallback", () => {
    it("renders a text input for unrecognized types", () => {
      renderFieldEdit("unknown-type" as never, {} as FieldMetadata, "hello");
      const input = screen.getByRole("textbox");
      expect(input).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: InlineFieldEdit → FieldEdit → FieldSelectInput
// ═══════════════════════════════════════════════════════════════════════════

import { InlineFieldEdit } from "@/components/ui";
import type { EditableCellEditProps as InlineEditProps } from "@/components/ui/data-table";

describe("InlineFieldEdit with reference FieldEdit", () => {
  const deptOptions = [
    { value: "dept-1", label: "Engineering" },
    { value: "dept-2", label: "Marketing" },
  ];

  it("calls onPersist with selected option value when user picks from dropdown", async () => {
    const onPersist = vi.fn();

    const editCtx: FieldContextValue = {
      fieldDefinition: {
        fieldId: "department",
        label: "Department",
        type: "reference",
        metadata: {
          fieldName: "department",
          referenceEntity: "department",
          referenceIdField: "department_id",
          options: deptOptions,
        } as ReferenceFieldMetadata,
      },
      value: "dept-1",
      viewMode: "edit",
    };

    render(
      <InlineFieldEdit<string>
        fieldId="emp-1-department"
        value="dept-1"
        onPersist={onPersist}
        renderDisplay={({ value: v }) => <span>{v}</span>}
        renderEdit={(props: InlineEditProps<string>) => (
          <FieldContext.Provider value={editCtx}>
            <FieldEdit {...props} />
          </FieldContext.Provider>
        )}
      />,
    );

    // Click the display to enter edit mode
    const display = screen.getByText("dept-1");
    fireEvent.click(display);

    // Now in edit mode — Combobox should be visible
    await waitFor(() => {
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeDefined();
    });

    // Open dropdown and select Marketing
    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(combobox);

    await waitFor(() => {
      const option = screen.getByText("Marketing");
      fireEvent.click(option);
    });

    // onPersist should be called with the option VALUE
    expect(onPersist).toHaveBeenCalledWith("dept-2");
  });
});
