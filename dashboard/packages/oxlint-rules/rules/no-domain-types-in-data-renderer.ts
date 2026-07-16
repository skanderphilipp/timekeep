import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-domain-types-in-data-renderer";

/**
 * Prevents domain-specific field types and components from leaking into
 * the data-renderer infrastructure module.
 *
 * The data-renderer is a framework module that must remain generic.
 * It knows about 6 abstract field types:
 *   text, number, timestamp, status, enum, reference
 *
 * Domain-specific concepts like "device_sn", "user_pin", "employee_name",
 * "verify_method", and "direction" are NOT valid field types. They are
 * `reference` or `enum` fields configured via REFERENCE_CONFIG in
 * @/types/metadata.ts.
 *
 * This rule bans:
 *   - Using domain-specific string literals as FieldType values
 *   - Importing domain-specific field display components
 *   - Importing domain-specific field metadata types
 *
 * Applies only to files in modules/data-renderer/.
 * Test and story files are exempt.
 */

// ── Configuration ───────────────────────────────────────────────────────────

/** Domain-specific field type names that must NOT appear in data-renderer. */
const BANNED_FIELD_TYPES = [
  "device_sn",
  "user_pin",
  "employee_name",
  "verify_method",
  "direction",
];

/** Domain-specific field display component names banned from data-renderer imports. */
const BANNED_DISPLAY_IMPORTS = [
  "DeviceSnFieldDisplay",
  "UserPinFieldDisplay",
  "DirectionFieldDisplay",
  "VerifyMethodFieldDisplay",
  "StatusFieldDisplay",
];

/** Domain-specific field metadata type names banned from data-renderer imports. */
const BANNED_METADATA_IMPORTS = [
  "DeviceSnFieldMetadata",
  "UserPinFieldMetadata",
  "EmployeeNameFieldMetadata",
  "VerifyMethodFieldMetadata",
  "DirectionFieldMetadata",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const isDataRendererFile = (filename: string): boolean =>
  /(?:^|\/)modules\/data-renderer\//.test(filename);

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

// ── Rule ────────────────────────────────────────────────────────────────────

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Data-renderer module must not reference domain-specific field types. " +
        "Use generic types (text, number, timestamp, status, enum, reference) with " +
        "REFERENCE_CONFIG metadata for FK navigation.",
    },
    messages: {
      bannedFieldType:
        'Domain-specific field type "{{ value }}" is not allowed in the data-renderer module. ' +
        'Use type "reference" with ReferenceFieldMetadata (referenceEntity, referenceIdField) from REFERENCE_CONFIG instead. ' +
        'Use type "enum" with EnumFieldMetadata (labels, colors) for verify_mode/direction-like fields.',
      bannedImport:
        'Domain-specific import "{{ name }}" is not allowed in the data-renderer module. ' +
        "This module must remain generic. Use the generic ReferenceFieldDisplay, EnumFieldDisplay, " +
        "or ReferenceFieldMetadata instead.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    // Only check data-renderer files
    if (!isDataRendererFile(filename)) return {};
    // Exempt test and story files
    if (isTestOrStory(filename)) return {};

    return {
      // ── AST visitors ──────────────────────────────────────────────────

      /**
       * Catch string literals that match banned field type names.
       * These appear in ColumnDefinition objects, switch cases, if conditions, etc.
       *
       *   type: "device_sn"     ← BANNED
       *   case "user_pin":      ← BANNED
       */
      Literal: (node: any) => {
        if (typeof node.value !== "string") return;
        if (BANNED_FIELD_TYPES.indexOf(node.value) === -1) return;

        // Skip string literals that appear in import/export declarations
        // (e.g., import specifiers referencing file paths that happen to match)
        if (node.parent?.type === "ImportDeclaration") return;
        if (node.parent?.type === "ExportNamedDeclaration") return;
        if (node.parent?.type === "ExportAllDeclaration") return;

        context.report({
          node,
          messageId: "bannedFieldType",
          data: { value: node.value },
        });
      },

      /**
       * Catch named imports of banned domain-specific components/types.
       *
       *   import { DeviceSnFieldDisplay }  ← BANNED
       *   import { UserPinFieldMetadata }   ← BANNED
       */
      ImportDeclaration: (node: any) => {
        for (const spec of node.specifiers ?? []) {
          const importedName = spec.imported?.name ?? spec.local?.name;
          if (!importedName) continue;

          const isBannedImport =
            BANNED_DISPLAY_IMPORTS.indexOf(importedName) !== -1 ||
            BANNED_METADATA_IMPORTS.indexOf(importedName) !== -1;

          if (isBannedImport) {
            context.report({
              node: spec,
              messageId: "bannedImport",
              data: { name: importedName },
            });
          }
        }
      },
    };
  },
});
