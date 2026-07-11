import { setupWorker } from "msw/browser";
import { createHandlers } from "../msw/handlers";

/**
 * MSW browser worker for Storybook.
 *
 * Intercepts fetch/ky calls at the service-worker level so pages and
 * molecules run their real data-fetching code (useQuery, ky.get, etc.)
 * and receive mock responses that match the Rust API envelope format.
 *
 * Usage in .storybook/preview.tsx:
 *   await worker.start({ onUnhandledRequest: "bypass" });
 *
 * Per-story overrides (e.g., error/empty states):
 *   worker.use(...createHandlers({ todaySummary: emptySummary }));
 */
export const worker = setupWorker(...createHandlers());

export { createHandlers };
