/**
 * DevTools — loaded only in development mode.
 *
 * Includes:
 *  - react-scan: Component inspector toolbar (shows component names, re-renders, FPS)
 *  - TanStack Query Devtools: Query cache inspector, status viewer, refetch controls
 *
 * Also available (no React mount needed):
 *  - code-inspector-plugin: Option+Click any element → opens source in Zed
 *    (configured in vite.config.ts, active in `pnpm dev`)
 *
 * Suppressed when:
 *  - Running in production (import.meta.env.PROD)
 *  - DISABLE_DEVTOOLS env var is set (used by E2E tests and screenshot capture)
 */

import { scan } from "react-scan";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// ── react-scan: Component Inspector ──────────────────────────────────────────
//
// Shows a floating toolbar with:
//   - Component name of the currently hovered/inspected element
//   - Re-render counts per component
//   - FPS meter
//   - Outline overlays around re-rendering components
//
// Toolbar appears at top-left. Toggle inspection mode to click on any element
// and see exactly which component renders it.

const isDev = import.meta.env.DEV && !import.meta.env.VITE_DISABLE_DEVTOOLS;

if (isDev) {
  scan({
    enabled: true,
    showToolbar: true,
    log: false,
    animationSpeed: "fast",
    showFPS: true,
    showNotificationCount: true,
  });
}

// ── DevTools Component ───────────────────────────────────────────────────────
//
// Mount inside <QueryClientProvider> to inspect the query cache.

export function DevTools() {
  if (!isDev) return null;

  return (
    <ReactQueryDevtools
      initialIsOpen={false}
      buttonPosition="bottom-left"
      position="bottom"
    />
  );
}
