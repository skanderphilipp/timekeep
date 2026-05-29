#!/usr/bin/env tsx
/**
 * Generates `shared/*.json` from `shared/*.ts` source files.
 *
 * Run via `pnpm generate-shared` (from the dashboard workspace).
 * Each generated JSON is consumed by the Rust backend via `include_str!`.
 *
 * To add a new shared catalog:
 * 1. Create `shared/my-catalog.ts` exporting a `const` array
 * 2. Add an entry to the `CATALOGS` array below
 * 3. Run this script — the `.json` is auto-generated
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sharedDir = resolve(rootDir, "shared");
const outDir = resolve(rootDir, "generated");

/** Each catalog: the TS module exports a named const, written as a JSON file. */
const CATALOGS = [
  { module: "permissions.ts",        exportName: "ALL_PERMISSIONS" },
  { module: "punch-statuses.ts",     exportName: "PUNCH_STATUSES" },
  { module: "verify-modes.ts",       exportName: "VERIFY_MODES" },
  { module: "device-statuses.ts",    exportName: "DEVICE_STATUSES" },
  { module: "device-vendors.ts",     exportName: "DEVICE_VENDORS" },
  { module: "integration-kinds.ts",  exportName: "INTEGRATION_KINDS" },
  { module: "device-event-types.ts", exportName: "DEVICE_EVENT_TYPES" },
  { module: "api-error-codes.ts",    exportName: "API_ERROR_CODES" },
  { module: "device-commands.ts",    exportName: "DEVICE_COMMANDS" },
] as const;

async function main() {
  for (const { module, exportName } of CATALOGS) {
    const mod = await import(resolve(sharedDir, module));
    const data = mod[exportName];
    if (!data) {
      console.error(`ERROR: ${module} does not export "${exportName}"`);
      process.exit(1);
    }

    const jsonFile = module.replace(/\.ts$/, ".json");
    const outPath = resolve(outDir, jsonFile);
    writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`  generated/${jsonFile} (${data.length} entries)`);
  }
  console.log(`\nDone — ${CATALOGS.length} catalogs generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
