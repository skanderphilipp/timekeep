import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import {
  IconDashboard,
  IconDevices,
} from "@tabler/icons-react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";

import { SidePanelCmdk } from "./side-panel-cmdk";
import { commandRegistryAtom } from "@/infrastructure/commands/command-registry";
import type { Command } from "@/infrastructure/commands/command-types";

/**
 * Tests for SidePanelCmdk — the command palette view rendered inside the side panel.
 *
 * Verifies:
 * 1. The search input is always rendered (even with no commands)
 * 2. Global commands are displayed when registered
 * 3. Empty state shows "No results found."
 */

function makeStore(commands: Command[]) {
  const store = createStore();
  store.set(commandRegistryAtom, { global: commands });
  return store;
}

function renderCmdk(commands: Command[] = []) {
  const store = makeStore(commands);
  return render(
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <div style={{ width: 400, height: 500 }}>
            <SidePanelCmdk onClose={() => {}} />
          </div>
        </MemoryRouter>
      </I18nProvider>
    </JotaiProvider>,
  );
}

const DEMO_COMMANDS: Command[] = [
  {
    id: "cmd-dashboard",
    label: "Dashboard",
    description: "Attendance overview",
    icon: IconDashboard,
    keywords: ["home"],
    scope: { type: "global" },
    action: () => {},
  },
  {
    id: "cmd-devices",
    label: "Devices",
    description: "Manage biometric scanners",
    icon: IconDevices,
    keywords: ["scanner"],
    scope: { type: "global" },
    action: () => {},
  },
];

describe("SidePanelCmdk", () => {
  it("renders the search input even with no commands", () => {
    renderCmdk([]);
    const searchInput = screen.getByPlaceholderText("Search commands…");
    expect(searchInput).toBeTruthy();
  });

  it("shows 'No results found.' when registry is empty", () => {
    renderCmdk([]);
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("renders global commands with group header", () => {
    renderCmdk(DEMO_COMMANDS);
    // Group header
    expect(screen.getByText("All commands")).toBeTruthy();
    // Commands
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Attendance overview")).toBeTruthy();
    expect(screen.getByText("Devices")).toBeTruthy();
    expect(screen.getByText("Manage biometric scanners")).toBeTruthy();
  });

  it("filters commands when typing in search input", () => {
    const { container } = renderCmdk(DEMO_COMMANDS);
    const input = container.querySelector<HTMLInputElement>(
      '[data-slot="cmdk-search"] input',
    );
    expect(input).toBeTruthy();

    // Type "Dash" via React Testing Library's fireEvent
    fireEvent.change(input!, { target: { value: "Dash" } });

    // Only "Dashboard" should remain
    expect(screen.getByText("Dashboard")).toBeTruthy();
    // "Devices" should be filtered out
    expect(screen.queryByText("Devices")).toBeNull();
  });
});
