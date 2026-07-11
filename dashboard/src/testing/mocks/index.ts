/**
 * Re-exports the MSW handlers factory for Storybook browser worker use.
 *
 * This is a thin re-export so Storybook stories can do:
 *   import { createHandlers } from "@/testing/mocks";
 *   worker.use(...createHandlers({ todaySummary: emptyData }));
 */

export { createHandlers } from "../msw/handlers";
export { worker } from "./browser";
export * from "./data";
