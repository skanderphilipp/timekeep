import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";

import { useSidePanelSubPage } from "./use-side-panel-sub-page";
import { sidePanelSubPageStackAtom } from "../side-panel-sub-page-stack";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper(store = createStore()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(JotaiProvider, { store }, children);
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useSidePanelSubPage", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  it("returns null currentStep when stack is empty", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current.currentStep).toBeNull();
  });

  it("returns empty stack initially", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current.stack).toEqual([]);
  });

  it("returns canGoBack as false initially", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });
    expect(result.current.canGoBack).toBe(false);
  });

  // ── pushStep ───────────────────────────────────────────────────────────

  it("adds a step to the stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan Devices");
    });

    expect(result.current.stack).toHaveLength(1);
    expect(result.current.stack[0].step).toBe("scan");
    expect(result.current.stack[0].title).toBe("Scan Devices");
  });

  it("sets currentStep to the pushed step", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan Devices");
    });

    expect(result.current.currentStep).not.toBeNull();
    expect(result.current.currentStep?.step).toBe("scan");
    expect(result.current.currentStep?.title).toBe("Scan Devices");
  });

  it("includes params in the pushed step", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("configure", "Configure", { ip: "10.0.1.5" });
    });

    expect(result.current.currentStep?.params).toEqual({ ip: "10.0.1.5" });
  });

  it("generates unique IDs for each step", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan");
    });
    const firstId = result.current.stack[0].id;

    act(() => {
      result.current.pushStep("configure", "Configure");
    });
    const secondId = result.current.stack[1].id;

    expect(firstId).not.toBe(secondId);
    expect(firstId).toContain("sub-page-");
    expect(secondId).toContain("sub-page-");
  });

  it("pushes multiple steps onto the stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan");
    });
    act(() => {
      result.current.pushStep("configure", "Configure");
    });
    act(() => {
      result.current.pushStep("test", "Test Connection");
    });

    expect(result.current.stack).toHaveLength(3);
    expect(result.current.stack.map((s) => s.step)).toEqual(["scan", "configure", "test"]);
  });

  // ── goBack ─────────────────────────────────────────────────────────────

  it("removes the top step from the stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan");
    });
    act(() => {
      result.current.pushStep("configure", "Configure");
    });

    expect(result.current.stack).toHaveLength(2);

    act(() => {
      result.current.goBack();
    });

    expect(result.current.stack).toHaveLength(1);
    expect(result.current.currentStep?.step).toBe("scan");
  });

  it("does not error when going back on empty stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    // Should not throw
    act(() => {
      result.current.goBack();
    });

    expect(result.current.stack).toEqual([]);
    expect(result.current.currentStep).toBeNull();
  });

  it("does not error when going back on single-item stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("scan", "Scan");
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.stack).toHaveLength(0);
    expect(result.current.currentStep).toBeNull();
  });

  // ── canGoBack ──────────────────────────────────────────────────────────

  it("returns canGoBack: true when stack has more than one entry", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("step1", "Step 1");
    });
    expect(result.current.canGoBack).toBe(false);

    act(() => {
      result.current.pushStep("step2", "Step 2");
    });
    expect(result.current.canGoBack).toBe(true);
  });

  it("returns canGoBack: false after going back to root", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("step1", "Step 1");
    });
    act(() => {
      result.current.pushStep("step2", "Step 2");
    });
    expect(result.current.canGoBack).toBe(true);

    act(() => {
      result.current.goBack();
    });
    expect(result.current.canGoBack).toBe(false);
  });

  // ── reset ──────────────────────────────────────────────────────────────

  it("clears all steps from the stack", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("step1", "Step 1");
    });
    act(() => {
      result.current.pushStep("step2", "Step 2");
    });
    act(() => {
      result.current.pushStep("step3", "Step 3");
    });

    expect(result.current.stack).toHaveLength(3);

    act(() => {
      result.current.reset();
    });

    expect(result.current.stack).toEqual([]);
    expect(result.current.currentStep).toBeNull();
    expect(result.current.canGoBack).toBe(false);
  });

  // ── currentStep reflects top of stack ──────────────────────────────────

  it("updates currentStep when pushing", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("first", "First");
    });
    expect(result.current.currentStep?.step).toBe("first");

    act(() => {
      result.current.pushStep("second", "Second");
    });
    expect(result.current.currentStep?.step).toBe("second");
  });

  it("updates currentStep when popping", () => {
    const { result } = renderHook(() => useSidePanelSubPage(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current.pushStep("first", "First");
    });
    act(() => {
      result.current.pushStep("second", "Second");
    });
    expect(result.current.currentStep?.step).toBe("second");

    act(() => {
      result.current.goBack();
    });
    expect(result.current.currentStep?.step).toBe("first");
  });
});
