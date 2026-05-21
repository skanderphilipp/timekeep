import { setupServer, type SetupServer } from "msw/node";
import { createHandlers, type HandlerOptions } from "./handlers";

/**
 * Returns a fresh MSW server with the given handler options.
 *
 * Call in `beforeAll`:
 *   server = createServer();
 *   server.listen({ onUnhandledRequest: "error" });
 *
 * Then customize per-test via `server.use(...createHandlers({ devices: [...] }))`.
 */
export function createServer(opts: HandlerOptions = {}): SetupServer {
  return setupServer(...createHandlers(opts));
}
