/**
 * Schema type helper — bridges generated OpenAPI types to domain API modules.
 *
 * Usage:
 *   import type { Schema } from "@/lib/api/schema";
 *   export type Employee = Schema<"EmployeeResponse">;
 *
 * This avoids the noisy `components["schemas"]["EmployeeResponse"]` syntax
 * while keeping types sourced from the auto-generated OpenAPI spec — guaranteed
 * to never drift from the backend.
 */
import type { components } from "@generated/api-types";

/** Lookup a schema type by its exact name in the OpenAPI `components.schemas` map. */
export type Schema<K extends keyof components["schemas"]> = components["schemas"][K];
