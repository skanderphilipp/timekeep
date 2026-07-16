import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { RecordDetailProvider } from "../states/record-detail-context";
import { useRecordNavigation } from "./use-record-navigation";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockOpenDetailPanel = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/infrastructure/side-panel/hooks/use-side-panel-navigation", () => ({
  useOpenDetailPanel: () => mockOpenDetailPanel,
  useOpenRecordInSidePanel: () => vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper(isInSidePanel: boolean) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <RecordDetailProvider
        value={{
          entityType: "employee",
          entityId: "emp-1",
          isInSidePanel,
        }}
      >
        {children}
      </RecordDetailProvider>
    );
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useRecordNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("in side panel", () => {
    it("navigateToEntity opens nested detail panel", () => {
      const { result } = renderHook(() => useRecordNavigation(), {
        wrapper: makeWrapper(true),
      });

      act(() => {
        result.current.navigateToEntity("department", "dept-1", "Engineering");
      });

      expect(mockOpenDetailPanel).toHaveBeenCalledWith(
        "department",
        "dept-1",
        "Engineering",
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("in main panel", () => {
    it("navigateToEntity navigates to full page for employee", () => {
      const { result } = renderHook(() => useRecordNavigation(), {
        wrapper: makeWrapper(false),
      });

      act(() => {
        result.current.navigateToEntity("employee", "emp-2", "Bob");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-2");
      expect(mockOpenDetailPanel).not.toHaveBeenCalled();
    });

    it("navigateToEntity navigates to full page for department", () => {
      const { result } = renderHook(() => useRecordNavigation(), {
        wrapper: makeWrapper(false),
      });

      act(() => {
        result.current.navigateToEntity("department", "dept-2", "Sales");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/departments/dept-2");
    });

    it("navigateToEntity navigates to full page for device", () => {
      const { result } = renderHook(() => useRecordNavigation(), {
        wrapper: makeWrapper(false),
      });

      act(() => {
        result.current.navigateToEntity("device", "SN123", "Front Desk");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/devices/SN123");
    });
  });

  describe("navigateToEdit", () => {
    it("is a no-op — inline editing replaces edit navigation", () => {
      const { result } = renderHook(() => useRecordNavigation(), {
        wrapper: makeWrapper(false),
      });

      act(() => {
        // Should not throw, should not cause side effects
        result.current.navigateToEdit("employee", "emp-1", "Edit Alice");
      });

      // No navigation should occur — editing is inline
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
