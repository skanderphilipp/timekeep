import { describe, it, expect } from "vitest";
import { IconDashboard } from "@tabler/icons-react";

import { resolveCommands } from "./use-commands";
import type { CommandRegistry, Command } from "./command-types";
import type { PageContext } from "./use-commands";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCmd(id: string, scope: Command["scope"]): Command {
  return {
    id,
    label: `Cmd ${id}`,
    icon: IconDashboard,
    keywords: [],
    scope,
    action: () => {},
  };
}

function mockPageContext(pageId: string | null): PageContext {
  return {
    pageId,
    matchesPrefix: (_prefix: string) => false,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("resolveCommands", () => {
  it("should return global commands for any page", () => {
    const registry: CommandRegistry = {
      global: [makeCmd("g1", { type: "global" }), makeCmd("g2", { type: "global" })],
    };
    const result = resolveCommands(registry, mockPageContext("dashboard"));
    expect(result.global).toHaveLength(2);
    expect(result.global.map((c) => c.id)).toEqual(["g1", "g2"]);
  });

  it("should return page-scoped commands only on matching page", () => {
    const registry: CommandRegistry = {
      global: [],
      dashboard: [makeCmd("d1", { type: "page", pageId: "dashboard" })],
      "devices.list": [makeCmd("dev1", { type: "page", pageId: "devices.list" })],
    };
    const result = resolveCommands(registry, mockPageContext("dashboard"));
    expect(result.contextual).toHaveLength(1);
    expect(result.contextual[0].id).toBe("d1");
  });

  it("should return contextual commands before global in all", () => {
    const registry: CommandRegistry = {
      global: [makeCmd("global-cmd", { type: "global" })],
      dashboard: [makeCmd("dash-cmd", { type: "page", pageId: "dashboard" })],
    };
    const result = resolveCommands(registry, mockPageContext("dashboard"));
    expect(result.all.map((c) => c.id)).toEqual(["dash-cmd", "global-cmd"]);
  });

  it("should return empty contextual when page does not match", () => {
    const registry: CommandRegistry = {
      global: [makeCmd("g", { type: "global" })],
      "devices.list": [makeCmd("dev", { type: "page", pageId: "devices.list" })],
    };
    const result = resolveCommands(registry, mockPageContext("reports"));
    expect(result.contextual).toHaveLength(0);
    expect(result.global).toHaveLength(1);
  });

  it("should match pattern-scoped commands via matchesPrefix", () => {
    const registry: CommandRegistry = {
      global: [],
      "devices.list": [
        makeCmd("dev-any", { type: "pattern", pattern: "/devices" }),
      ],
    };
    const result = resolveCommands(registry, {
      pageId: "devices.detail",
      matchesPrefix: (prefix: string) => prefix === "/devices",
    });
    expect(result.contextual).toHaveLength(1);
    expect(result.contextual[0].id).toBe("dev-any");
  });

  it("should handle empty registry", () => {
    const result = resolveCommands({}, mockPageContext("dashboard"));
    expect(result.contextual).toEqual([]);
    expect(result.global).toEqual([]);
    expect(result.all).toEqual([]);
  });

  it("should handle null pageId (unmapped page)", () => {
    const registry: CommandRegistry = {
      global: [makeCmd("g", { type: "global" })],
      dashboard: [makeCmd("d", { type: "page", pageId: "dashboard" })],
    };
    const result = resolveCommands(registry, mockPageContext(null));
    expect(result.contextual).toHaveLength(0);
    expect(result.global).toHaveLength(1);
  });
});
