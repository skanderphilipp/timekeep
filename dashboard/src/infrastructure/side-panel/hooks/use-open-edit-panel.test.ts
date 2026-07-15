import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";

import { useOpenEditPanel } from "./use-open-edit-panel";
import {
  sidePanelStackAtom,
  sidePanelActiveIndexAtom,
} from "../side-panel-navigation-stack";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper(store = createStore()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(JotaiProvider, { store }, children);
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useOpenEditPanel", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  // ── Edit mode (default) ─────────────────────────────────────────────────

  it("pushes an entry with edit mode by default", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("department", "dept-123", "Edit Engineering");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack).toHaveLength(1);
    expect(stack[0].entityType).toBe("department");
    expect(stack[0].entityId).toBe("dept-123");
    expect(stack[0].title).toBe("Edit Engineering");
    expect(stack[0].mode).toBe("edit");
  });

  it("pushes an entry with create mode when specified", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("department", "", "Add Department", "create");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack).toHaveLength(1);
    expect(stack[0].entityType).toBe("department");
    expect(stack[0].entityId).toBe("");
    expect(stack[0].title).toBe("Add Department");
    expect(stack[0].mode).toBe("create");
  });

  it("pushes an entry with explicit edit mode", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("user", "user-456", "Edit User", "edit");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack).toHaveLength(1);
    expect(stack[0].mode).toBe("edit");
  });

  // ── Navigation stack behavior ──────────────────────────────────────────

  it("sets the active index to the last entry", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("department", "dept-1", "Edit Dept 1");
    });

    const activeIndex = store.get(sidePanelActiveIndexAtom);
    expect(activeIndex).toBe(0);

    act(() => {
      result.current("department", "dept-2", "Edit Dept 2");
    });

    const updatedIndex = store.get(sidePanelActiveIndexAtom);
    expect(updatedIndex).toBe(1);
  });

  it("generates unique instanceId for each entry", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("department", "dept-1", "Dept 1");
    });
    act(() => {
      result.current("department", "dept-2", "Dept 2");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack).toHaveLength(2);
    expect(stack[0].instanceId).not.toBe(stack[1].instanceId);
    expect(stack[0].instanceId).toContain("side-panel-");
  });

  it("pushes entries with different entity types", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("department", "dept-1", "Edit Dept");
    });
    act(() => {
      result.current("user", "user-1", "Edit User");
    });
    act(() => {
      result.current("api_key", "key-1", "Edit API Key");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack).toHaveLength(3);
    expect(stack.map((e) => e.entityType)).toEqual(["department", "user", "api_key"]);
  });

  // ── Empty entityId (create mode) ───────────────────────────────────────

  it("accepts empty string as entityId for create mode", () => {
    const { result } = renderHook(() => useOpenEditPanel(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      result.current("endpoint", "", "New Endpoint", "create");
    });

    const stack = store.get(sidePanelStackAtom);
    expect(stack[0].entityId).toBe("");
    expect(stack[0].mode).toBe("create");
  });
});
