import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { IconDashboard } from "@tabler/icons-react";

import { SidePanelShell } from "./side-panel-shell";
import { SidePanelCmdk } from "./components/side-panel-cmdk";
import { commandRegistryAtom } from "@/infrastructure/commands/command-registry";
import {
  sidePanelOpenAtom,
  sidePanelTitleAtom,
  sidePanelContentAtom,
} from "@/infrastructure/state";
import type { Command } from "@/infrastructure/commands/command-types";

import {
  sidePanelStackAtom,
  sidePanelActiveIndexAtom,
} from "./side-panel-navigation-stack";
import {
  sidePanelSubPageStackAtom,
} from "./side-panel-sub-page-stack";
import type { SidePanelEntry } from "./side-panel-navigation-stack";
import type { SubPageEntry } from "./side-panel-sub-page-stack";

/**
 * Integration test: SidePanelShell reads atoms and renders SidePanelCmdk.
 */

function makeSetup() {
  const store = createStore();
  store.set(commandRegistryAtom, {
    global: [
      {
        id: "cmd-dashboard",
        label: "Dashboard",
        description: "Attendance overview",
        icon: IconDashboard,
        keywords: ["home"],
        scope: { type: "global" },
        action: () => {},
      },
    ] as Command[],
  });

  const renderResult = render(
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <div style={{ width: 1200, height: 800, display: "flex" }}>
            <div style={{ flex: 1 }} />
            <SidePanelShell />
          </div>
        </MemoryRouter>
      </I18nProvider>
    </JotaiProvider>,
  );

  return { store, ...renderResult };
}

describe("SidePanelShell", () => {
  it("panel should be closed by default (no commands visible)", () => {
    makeSetup();
    const panel = document.querySelector('[data-slot="side-panel"]');
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("data-open")).toBeFalsy();
  });

  it("opens and renders SidePanelCmdk when atoms are set (simulating Cmd+K)", async () => {
    const { store } = makeSetup();

    await act(async () => {
      store.set(sidePanelTitleAtom, "Commands");
      store.set(sidePanelContentAtom, () => (
        <SidePanelCmdk onClose={() => {}} />
      ));
      store.set(sidePanelOpenAtom, true);
    });

    const panel = document.querySelector('[data-slot="side-panel"]');
    expect(panel?.getAttribute("data-open")).toBe("true");
    expect(screen.getByText("Commands")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search commands…")).toBeTruthy();
    expect(screen.getByText("All commands")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Attendance overview")).toBeTruthy();
  });

  it("closes when sidePanelOpenAtom is set to false", async () => {
    const { store } = makeSetup();

    await act(async () => {
      store.set(sidePanelTitleAtom, "Commands");
      store.set(sidePanelContentAtom, () => (
        <SidePanelCmdk onClose={() => {}} />
      ));
      store.set(sidePanelOpenAtom, true);
    });

    expect(screen.getByText("Commands")).toBeTruthy();

    await act(async () => {
      store.set(sidePanelOpenAtom, false);
    });

    const panel = document.querySelector('[data-slot="side-panel"]');
    expect(panel?.getAttribute("data-open")).toBeFalsy();
  });
});

// ── Sub-page cleanup tests ──────────────────────────────────────────────────

function makeEntry(overrides: Partial<SidePanelEntry> = {}): SidePanelEntry {
  return {
    instanceId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    entityType: "audit",
    entityId: "audit-1",
    title: "Edit Audit Entry",
    mode: "edit",
    ...overrides,
  };
}

function makeSubPage(overrides: Partial<SubPageEntry> = {}): SubPageEntry {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    step: "scan",
    title: "Scan Devices",
    ...overrides,
  };
}

/**
 * Push an entry and allow the effect to flush, THEN push sub-pages.
 * Simulates the real flow where an entry is opened first, then wizard
 * steps are pushed as sub-pages.
 */
async function setupEntryWithSubPages(
  store: ReturnType<typeof createStore>,
  entry: SidePanelEntry,
  pages: SubPageEntry[],
) {
  // First, push the entry and set active index (simulates pushEntry)
  await act(async () => {
    store.set(sidePanelStackAtom, [entry]);
    store.set(sidePanelActiveIndexAtom, 0);
  });

  // Sub-pages should be empty after the entry opens
  expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(0);

  // Now push sub-pages (entry is already established, no more clearing)
  await act(async () => {
    store.set(sidePanelSubPageStackAtom, pages);
  });

  expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(pages.length);
}

describe("SidePanelShell — sub-page cleanup", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    store.set(commandRegistryAtom, {
      global: [
        {
          id: "cmd-dashboard",
          label: "Dashboard",
          description: "Attendance overview",
          icon: IconDashboard,
          keywords: ["home"],
          scope: { type: "global" },
          action: () => {},
        },
      ] as Command[],
    });

    render(
      <JotaiProvider store={store}>
        <I18nProvider i18n={i18n}>
          <MemoryRouter>
            <div style={{ width: 1200, height: 800, display: "flex" }}>
              <div style={{ flex: 1 }} />
              <SidePanelShell />
            </div>
          </MemoryRouter>
        </I18nProvider>
      </JotaiProvider>,
    );
  });

  it("clears sub-pages when the navigation entry changes (different instanceId)", async () => {
    const entry1 = makeEntry({ instanceId: "entry-1" });
    await setupEntryWithSubPages(store, entry1, [
      makeSubPage({ id: "sub-1", step: "scan" }),
      makeSubPage({ id: "sub-2", step: "configure" }),
    ]);

    // Change to a different entry — simulates navigating to another entity
    const entry2 = makeEntry({ instanceId: "entry-2" });
    await act(async () => {
      store.set(sidePanelStackAtom, [entry2]);
      store.set(sidePanelActiveIndexAtom, 0);
    });

    // Sub-pages should be cleared because the active entry instanceId changed
    expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(0);
  });

  it("does NOT clear sub-pages when the same entry is set again (same instanceId)", async () => {
    const entry1 = makeEntry({ instanceId: "entry-1" });
    await setupEntryWithSubPages(store, entry1, [
      makeSubPage({ id: "sub-1", step: "scan" }),
    ]);

    // Set the same entry again — simulates a re-render
    await act(async () => {
      store.set(sidePanelStackAtom, [entry1]);
      store.set(sidePanelActiveIndexAtom, 0);
    });

    // Sub-pages should NOT be cleared (same instanceId)
    expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(1);
  });

  it("clears sub-pages when the navigation stack is emptied", async () => {
    const entry1 = makeEntry({ instanceId: "entry-1" });
    await setupEntryWithSubPages(store, entry1, [
      makeSubPage({ id: "sub-1", step: "scan" }),
      makeSubPage({ id: "sub-2", step: "configure" }),
    ]);

    // Clear the navigation stack — simulates closing the panel
    await act(async () => {
      store.set(sidePanelStackAtom, []);
      store.set(sidePanelActiveIndexAtom, 0);
    });

    // Sub-pages should be cleared when active entry becomes null
    expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(0);
  });

  it("clears sub-pages when pushing a second entry onto the navigation stack", async () => {
    const entry1 = makeEntry({ instanceId: "entry-1" });
    await setupEntryWithSubPages(store, entry1, [
      makeSubPage({ id: "wiz-1", step: "scan" }),
    ]);

    // Push a second entry and set active index to point to it
    const entry2 = makeEntry({ instanceId: "entry-2" });
    await act(async () => {
      store.set(sidePanelStackAtom, [entry1, entry2]);
      store.set(sidePanelActiveIndexAtom, 1); // active = entry2
    });

    // Sub-pages should be cleared because active entry changed to entry2
    expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(0);
  });

  it("does not clear sub-pages when pushing onto the sub-page stack (no entry change)", async () => {
    const entry = makeEntry({ instanceId: "entry-1" });
    await setupEntryWithSubPages(store, entry, [
      makeSubPage({ id: "sub-1", step: "scan" }),
    ]);

    // Push another sub-page — wizard advances, entry unchanged
    await act(async () => {
      store.set(sidePanelSubPageStackAtom, [
        makeSubPage({ id: "sub-1", step: "scan" }),
        makeSubPage({ id: "sub-2", step: "configure" }),
      ]);
    });

    // Sub-pages should still be present (entry didn't change)
    expect(store.get(sidePanelSubPageStackAtom)).toHaveLength(2);
  });
});
