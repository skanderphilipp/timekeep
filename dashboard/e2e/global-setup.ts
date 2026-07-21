/**
 * Global setup for Playwright E2E tests.
 *
 * Seeds the E2E database (`timekeep-e2e.db`) before tests run.
 * Uses `make seed-e2e` which generates deterministic test data:
 * - 120 employees, 8 devices, 2 years of attendance history
 * - Dashboard users: admin / admin123, operator / operator123, viewer / viewer123
 *
 * The seed is idempotent — running it again regenerates the same data (seed 42).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve workspace root (two levels up from e2e/)
const workspaceRoot = path.resolve(__dirname, "..", "..");

export default function globalSetup(): void {
  const e2eDb = path.join(workspaceRoot, "timekeep-e2e.db");

  // Check if DB already exists — skip seeding to save time on local re-runs
  if (existsSync(e2eDb)) {
    console.log("✓ E2E database already exists, skipping seed");
    return;
  }

  console.log("🌱 Seeding E2E database...");

  execSync("make seed-e2e", {
    cwd: workspaceRoot,
    stdio: "inherit",
    timeout: 120_000,
  });

  console.log("✓ E2E database seeded");
}
