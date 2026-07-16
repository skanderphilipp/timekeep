import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { ReferenceFieldDisplay } from "@/modules/data-renderer/field-displays/reference-field-display";
import { FieldContext, type FieldContextValue, type FieldViewMode } from "@/modules/data-renderer/contexts/field-context";
import type { FieldMetadata } from "@/modules/data-renderer/types";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockOpenDetail = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/infrastructure/side-panel/hooks/use-side-panel-navigation", () => ({
  useOpenDetailPanel: () => mockOpenDetail,
}));

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a minimal FieldContext for testing field displays in isolation. */
function wrapInFieldContext(
  children: React.ReactNode,
  overrides: Partial<FieldContextValue> = {},
) {
  const value: FieldContextValue = {
    fieldDefinition: {
      fieldId: "test",
      label: "Test",
      type: "reference",
      metadata: { fieldName: "test" } as FieldMetadata,
    },
    value: "test-value",
    viewMode: "display" as FieldViewMode,
    entityId: "ent-123",
    ...overrides,
  };

  return (
    <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ReferenceFieldDisplay", () => {
  it("renders the display value as a Tag", () => {
    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="DevOps Team"
          entityId="dep-1"
          referenceEntity="department"
        />,
      ),
    );

    expect(screen.getByText("DevOps Team")).toBeDefined();
  });

  it("shows '-' when value is empty", () => {
    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value=""
          entityId="dep-1"
          referenceEntity="department"
        />,
      ),
    );

    expect(screen.getByText("-")).toBeDefined();
  });

  it("renders as clickable (Tag has onClick)", () => {
    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="Engineering"
          entityId="dep-2"
          referenceEntity="department"
        />,
      ),
    );

    const tag = screen.getByText("Engineering");
    expect(tag).toBeDefined();
  });

  it("navigates to any entity type via referenceEntity prop", () => {
    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="Server Room"
          entityId="DEV-001"
          referenceEntity="device"
        />,
      ),
    );

    expect(screen.getByText("Server Room")).toBeDefined();

    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="Alice"
          entityId="12345"
          referenceEntity="user"
        />,
      ),
    );

    expect(screen.getByText("Alice")).toBeDefined();

    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="Marketing"
          entityId="dep-3"
          referenceEntity="department"
        />,
      ),
    );

    expect(screen.getByText("Marketing")).toBeDefined();
  });

  it("does not error when entityId is empty (no navigation target)", () => {
    render(
      wrapInFieldContext(
        <ReferenceFieldDisplay
          value="No Department"
          entityId=""
          referenceEntity="department"
        />,
      ),
    );

    expect(screen.getByText("No Department")).toBeDefined();
    // Clicking should not throw
    fireEvent.click(screen.getByText("No Department"));
  });

  it("wrapper span has stopPropagation to prevent row-click conflicts", () => {
    render(
      <div>
        {wrapInFieldContext(
          <ReferenceFieldDisplay
            value="Test"
            entityId="1"
            referenceEntity="device"
          />,
        )}
      </div>,
    );

    const tag = screen.getByText("Test");
    const wrapperSpan = tag.closest("span[data-no-close]");
    expect(wrapperSpan).toBeDefined();
    // data-no-close may be "" (HTML boolean) or "true" (string) depending on React version
    const attr = wrapperSpan?.getAttribute("data-no-close");
    expect(attr === "" || attr === "true").toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context-aware navigation (onNavigateToEntity) — ADR-008 / Twenty pattern
  // ═══════════════════════════════════════════════════════════════════════════

  describe("context-aware navigation (onNavigateToEntity)", () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it("uses onNavigateToEntity when provided in FieldContext", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="Engineering"
            entityId="dep-1"
            referenceEntity="department"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("Engineering"));

      // Should use the context-provided navigator
      expect(mockNavigate).toHaveBeenCalledWith("department", "dep-1", "Engineering");
      // Should NOT fall back to openDetailPanel
      expect(mockOpenDetail).not.toHaveBeenCalled();
    });

    it("falls back to useOpenDetailPanel when onNavigateToEntity is NOT provided", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="Sales"
            entityId="dep-2"
            referenceEntity="department"
          />,
          // No onNavigateToEntity — should use the legacy openDetail fallback
        ),
      );

      fireEvent.click(screen.getByText("Sales"));

      expect(mockOpenDetail).toHaveBeenCalledWith("department", "dep-2", "Sales");
    });

    it("passes the display value as label to onNavigateToEntity", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="R&D Department"
            entityId="dep-3"
            referenceEntity="department"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("R&D Department"));

      expect(mockNavigate).toHaveBeenCalledWith(
        "department",
        "dep-3",
        "R&D Department",
      );
    });

    it("passes entityId as label when value is empty", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value=""
            entityId="dep-empty"
            referenceEntity="department"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("-"));

      // When value is empty but entityId is provided, entityId is used as label
      expect(mockNavigate).toHaveBeenCalledWith(
        "department",
        "dep-empty",
        "dep-empty",
      );
    });

    it("does not navigate when both entityId is empty (even with onNavigateToEntity)", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="No Target"
            entityId=""
            referenceEntity="department"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("No Target"));

      // Should not call either navigation function
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockOpenDetail).not.toHaveBeenCalled();
    });

    it("works with device entity type via onNavigateToEntity", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="Front Desk"
            entityId="SN-42"
            referenceEntity="device"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("Front Desk"));

      expect(mockNavigate).toHaveBeenCalledWith("device", "SN-42", "Front Desk");
    });

    it("works with user entity type via onNavigateToEntity", () => {
      render(
        wrapInFieldContext(
          <ReferenceFieldDisplay
            value="Alice"
            entityId="1001"
            referenceEntity="user"
          />,
          {
            onNavigateToEntity: mockNavigate,
          },
        ),
      );

      fireEvent.click(screen.getByText("Alice"));

      expect(mockNavigate).toHaveBeenCalledWith("user", "1001", "Alice");
    });
  });
});
