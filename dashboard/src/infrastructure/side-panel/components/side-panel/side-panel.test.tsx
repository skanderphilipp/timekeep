import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";

import { SidePanel } from "./side-panel";

/**
 * Minimal test: renders SidePanel directly with children prop.
 * Verifies that the children prop correctly renders inside the content area.
 */
describe("SidePanel (direct children)", () => {
  it("renders children inside the content area", () => {
    const store = createStore();

    render(
      <JotaiProvider store={store}>
        <I18nProvider i18n={i18n}>
          <MemoryRouter>
            <div style={{ width: 1200, height: 800, display: "flex" }}>
              <div style={{ flex: 1 }} />
              <SidePanel open={true} onClose={() => {}} title="Test">
                <div data-testid="child-content">Hello from child</div>
              </SidePanel>
            </div>
          </MemoryRouter>
        </I18nProvider>
      </JotaiProvider>,
    );

    // The panel should be open
    const panel = document.querySelector('[data-slot="side-panel"]');
    expect(panel?.getAttribute("data-open")).toBe("true");

    // The child content should be visible
    expect(screen.getByTestId("child-content")).toBeTruthy();
    expect(screen.getByText("Hello from child")).toBeTruthy();
  });
});
