import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "jotai";
import { IconDashboard } from "@tabler/icons-react";

import {
  commandRegistryAtom,
  registerCommandsAtom,
  unregisterCommandsAtom,
} from "./command-registry";
import type { Command } from "./command-types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCommand(id: string, scope: Command["scope"] = { type: "global" }): Command {
  return {
    id,
    label: `Test ${id}`,
    icon: IconDashboard,
    keywords: ["test"],
    scope,
    action: () => {},
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("command-registry", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("should start with empty global commands", () => {
    const registry = store.get(commandRegistryAtom);
    expect(registry.global).toEqual([]);
  });

  it("should register global commands", () => {
    const cmd = makeCommand("test-cmd");
    store.set(registerCommandsAtom, { key: "global", commands: [cmd] });

    const registry = store.get(commandRegistryAtom);
    expect(registry.global).toHaveLength(1);
    expect(registry.global[0].id).toBe("test-cmd");
  });

  it("should register page-specific commands", () => {
    const cmd = makeCommand("page-cmd", { type: "page", pageId: "dashboard" });
    store.set(registerCommandsAtom, { key: "dashboard", commands: [cmd] });

    const registry = store.get(commandRegistryAtom);
    expect(registry.dashboard).toHaveLength(1);
    expect(registry.dashboard[0].id).toBe("page-cmd");
  });

  it("should unregister commands by key", () => {
    store.set(registerCommandsAtom, {
      key: "devices.list",
      commands: [makeCommand("tmp")],
    });

    store.set(unregisterCommandsAtom, "devices.list");

    const registry = store.get(commandRegistryAtom);
    expect(registry["devices.list"]).toBeUndefined();
  });

  it("should replace commands on re-registration", () => {
    store.set(registerCommandsAtom, { key: "global", commands: [makeCommand("v1")] });
    store.set(registerCommandsAtom, { key: "global", commands: [makeCommand("v2")] });

    const registry = store.get(commandRegistryAtom);
    expect(registry.global).toHaveLength(1);
    expect(registry.global[0].id).toBe("v2");
  });

  it("should not affect other keys when unregistering", () => {
    store.set(registerCommandsAtom, { key: "global", commands: [makeCommand("g")] });
    store.set(registerCommandsAtom, {
      key: "dashboard",
      commands: [makeCommand("d", { type: "page", pageId: "dashboard" })],
    });

    store.set(unregisterCommandsAtom, "dashboard");

    const registry = store.get(commandRegistryAtom);
    expect(registry.global).toHaveLength(1);
    expect(registry["dashboard"]).toBeUndefined();
  });

  it("should preserve existing keys when registering a new key", () => {
    store.set(registerCommandsAtom, { key: "global", commands: [makeCommand("g")] });
    store.set(registerCommandsAtom, {
      key: "reports",
      commands: [makeCommand("r", { type: "page", pageId: "reports" })],
    });

    const registry = store.get(commandRegistryAtom);
    expect(registry.global).toHaveLength(1);
    expect(registry.reports).toHaveLength(1);
  });
});
