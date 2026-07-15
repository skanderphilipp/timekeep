import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Provider as JotaiProvider, createStore } from "jotai";
import { messages as enMessages } from "@/locales/en";

import { SidePanelSubPageRouter } from "./side-panel-sub-page-router";
import { sidePanelSubPageStackAtom } from "../../side-panel-sub-page-stack";
import type { SubPageEntry } from "../../side-panel-sub-page-stack";

// ── Lingui setup ────────────────────────────────────────────────────────────

i18n.load({ en: enMessages });
i18n.activate("en");

// ── Helpers ─────────────────────────────────────────────────────────────────

type StepComponentProps = {
  params?: Record<string, unknown>;
  pushStep: (step: string, title: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
};

function makeStepComponent(label: string) {
  return function StepComponent({ params, pushStep, goBack }: StepComponentProps) {
    return (
      <div data-testid={`step-${label}`}>
        <span>{label}</span>
        {params && <span data-testid="params">{JSON.stringify(params)}</span>}
        <button data-testid={`push-${label}`} onClick={() => pushStep("next", "Next Step")}>
          Push
        </button>
        <button data-testid={`back-${label}`} onClick={goBack}>
          Back
        </button>
      </div>
    );
  };
}

function renderRouter(
  props: Partial<React.ComponentProps<typeof SidePanelSubPageRouter>> = {},
  store = createStore(),
) {
  return render(
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <SidePanelSubPageRouter
          stepMap={{
            scan: makeStepComponent("scan"),
            configure: makeStepComponent("configure"),
          }}
          {...props}
        >
          <div data-testid="root-content">Root Content</div>
        </SidePanelSubPageRouter>
      </I18nProvider>
    </JotaiProvider>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SidePanelSubPageRouter", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  // ── Root content ───────────────────────────────────────────────────────

  it("renders children when no sub-page is active", () => {
    renderRouter({}, store);
    expect(screen.getByTestId("root-content")).toBeInTheDocument();
    expect(screen.getByText("Root Content")).toBeInTheDocument();
  });

  it("does not render children when a sub-page is active", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
    ]);
    renderRouter({}, store);
    expect(screen.queryByTestId("root-content")).not.toBeInTheDocument();
  });

  // ── Step rendering ──────────────────────────────────────────────────────

  it("renders the matching step component from stepMap", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
    ]);
    renderRouter({}, store);
    expect(screen.getByTestId("step-scan")).toBeInTheDocument();
    expect(screen.getByText("scan")).toBeInTheDocument();
  });

  it("passes params to the step component", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices", params: { ip: "10.0.1.5" } },
    ]);
    renderRouter({}, store);
    const paramsEl = screen.getByTestId("params");
    expect(paramsEl.textContent).toContain("10.0.1.5");
  });

  it("passes pushStep to the step component", async () => {
    const user = userEvent.setup();
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
    ]);
    renderRouter({}, store);

    // Click pushStep from within the step
    await user.click(screen.getByTestId("push-scan"));
    // After push, the stack should have 2 entries and the "next" step should render
    const stack = store.get(sidePanelSubPageStackAtom);
    expect(stack).toHaveLength(2);
    expect(stack[1].step).toBe("next");
  });

  it("passes goBack to the step component", async () => {
    const user = userEvent.setup();
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
      { id: "2", step: "configure", title: "Configure" },
    ]);
    renderRouter({}, store);

    // Click goBack from within the step
    await user.click(screen.getByTestId("back-configure"));
    const stack = store.get(sidePanelSubPageStackAtom);
    expect(stack).toHaveLength(1);
    expect(stack[0].step).toBe("scan");
  });

  // ── Navigation header / back button ─────────────────────────────────────

  it("renders a back button when a sub-page is active", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
    ]);
    renderRouter({}, store);
    const backButton = screen.getByRole("button", { name: /go back/i });
    expect(backButton).toBeInTheDocument();
  });

  it("back button label shows current step title when canGoBack", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
      { id: "2", step: "configure", title: "Configure" },
    ]);
    renderRouter({}, store);
    // When canGoBack (stack > 1), the label shows the current step title
    expect(screen.getByText("Configure")).toBeInTheDocument();
  });

  it("back button label shows 'Back' when there is only one step (can't go back further)", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan Devices" },
    ]);
    renderRouter({}, store);
    // When at the root of the sub-stack, the back label is generic "Back"
    // Use the back button's aria-label to scope the query, then check its content
    const backButton = screen.getByRole("button", { name: /go back/i });
    expect(backButton.textContent).toContain("Back");
  });

  it("remounts the step component on step change (via key prop)", async () => {
    // Step 1: render "scan"
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan" },
    ]);
    const { rerender } = renderRouter({}, store);

    expect(screen.getByTestId("step-scan")).toBeInTheDocument();

    // Step 2: push to "configure" — wrap in act to avoid React warning
    await act(async () => {
      store.set(sidePanelSubPageStackAtom, [
        { id: "1", step: "scan", title: "Scan" },
        { id: "2", step: "configure", title: "Configure" },
      ]);
    });

    // Re-render with the same store (atom values updated)
    rerender(
      <JotaiProvider store={store}>
        <I18nProvider i18n={i18n}>
          <SidePanelSubPageRouter
            stepMap={{
              scan: makeStepComponent("scan"),
              configure: makeStepComponent("configure"),
            }}
          >
            <div data-testid="root-content">Root Content</div>
          </SidePanelSubPageRouter>
        </I18nProvider>
      </JotaiProvider>,
    );

    expect(screen.getByTestId("step-configure")).toBeInTheDocument();
    expect(screen.queryByTestId("step-scan")).not.toBeInTheDocument();
  });

  // ── Unknown step ────────────────────────────────────────────────────────

  it("shows placeholder when step is not in stepMap", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "unknown-step", title: "Unknown" },
    ]);
    renderRouter({}, store);
    expect(
      screen.getByText((content) => content.includes('"unknown-step" not found in stepMap')),
    ).toBeInTheDocument();
  });

  // ── Empty stepMap (optional prop) ──────────────────────────────────────

  it("works when stepMap is undefined — renders children as root", () => {
    render(
      <JotaiProvider store={store}>
        <I18nProvider i18n={i18n}>
          <SidePanelSubPageRouter>
            <div data-testid="root">Root</div>
          </SidePanelSubPageRouter>
        </I18nProvider>
      </JotaiProvider>,
    );
    expect(screen.getByTestId("root")).toBeInTheDocument();
  });

  it("shows placeholder when stepMap is undefined and a sub-page is active", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "orphan", title: "Orphan Step" },
    ]);
    render(
      <JotaiProvider store={store}>
        <I18nProvider i18n={i18n}>
          <SidePanelSubPageRouter>
            <div data-testid="root">Root</div>
          </SidePanelSubPageRouter>
        </I18nProvider>
      </JotaiProvider>,
    );
    expect(
      screen.getByText((content) => content.includes('"orphan" not found in stepMap')),
    ).toBeInTheDocument();
  });

  // ── Multiple steps on the stack ─────────────────────────────────────────

  it("renders the topmost step (currentStep)", () => {
    store.set(sidePanelSubPageStackAtom, [
      { id: "1", step: "scan", title: "Scan", params: { ip: "10.0.1.1" } },
      { id: "2", step: "configure", title: "Configure", params: { ip: "10.0.1.2" } },
    ]);
    renderRouter({}, store);

    // Should render the "configure" step (top of stack)
    expect(screen.getByTestId("step-configure")).toBeInTheDocument();
    // The params should be from the "configure" step
    const paramsEl = screen.getByTestId("params");
    expect(paramsEl.textContent).toContain("10.0.1.2");
  });
});
