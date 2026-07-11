import { type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider, createStore } from "jotai";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────────────────────

type WrapperOptions = {
  /** Initial route (default: "/"). */
  route?: string;
  /** QueryClient instance (default: new QueryClient with retry: false). */
  queryClient?: QueryClient;
};

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a wrapper component with all providers needed for rendering
 * timekeep components in tests.
 *
 * Usage:
 *   const { render } = createRenderWrapper();
 *   render(<LoginForm />);
 *
 * Or with options:
 *   const { render } = createRenderWrapper({ route: "/devices" });
 */
export function createRenderWrapper(opts: WrapperOptions = {}) {
  const { route = "/" } = opts;
  const queryClient =
    opts.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  const jotaiStore = createStore();

  // Set initial route
  window.history.pushState({}, "", route);

  function AllProviders({ children }: { children: ReactNode }) {
    return (
      <JotaiProvider store={jotaiStore}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18n}>
            <BrowserRouter>{children}</BrowserRouter>
          </I18nProvider>
        </QueryClientProvider>
      </JotaiProvider>
    );
  }

  function renderWithProviders(ui: ReactNode, renderOptions?: Omit<RenderOptions, "wrapper">) {
    return render(ui, { wrapper: AllProviders, ...renderOptions });
  }

  return { render: renderWithProviders, jotaiStore, queryClient };
}
