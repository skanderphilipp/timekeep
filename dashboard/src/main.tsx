import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Provider as JotaiProvider } from "jotai";

import { detectAndActivateLocale } from "@/infrastructure/locale/locale";
import { ToastProvider } from "@/infrastructure/toast/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ThemeProvider } from "@/infrastructure/theme";
import { DevTools } from "@/devtools/DevTools";
import { AuthProvider } from "@/modules/auth/components/auth-provider";
import { App } from "./App";
import { LS_THEME } from "@/lib/constants";

// ── Fonts ───────────────────────────────────────────────────────────────────

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

// ── Styles ─────────────────────────────────────────────────────────────────

import "./styles/generated-tokens.css";
import "./styles/global.scss";

// ── Theme (FOUC prevention) ──────────────────────────────────────────────────

/**
 * Applies the initial theme class to <html> before React renders.
 * This prevents a flash of unstyled content (FOUC) on page load.
 *
 * Subsequent theme toggles are handled by `ThemeProvider` which reads
 * the Jotai `themeState` and syncs the DOM class via useLayoutEffect.
 */
function initTheme() {
  const stored = localStorage.getItem(LS_THEME);
  if (stored === "dark" || stored === "light") {
    document.documentElement.classList.add(stored);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.add("light");
  }
}

// ── React Query ──────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  initTheme();
  await detectAndActivateLocale();

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");

  createRoot(root).render(
    <StrictMode>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18n}>
            <BrowserRouter>
              <ToastProvider>
                <ThemeProvider>
                  <DevTools />
                  <ErrorBoundary>
                    <AuthProvider>
                      <App />
                    </AuthProvider>
                  </ErrorBoundary>
                </ThemeProvider>
              </ToastProvider>
            </BrowserRouter>
          </I18nProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </StrictMode>,
  );
}

bootstrap();
