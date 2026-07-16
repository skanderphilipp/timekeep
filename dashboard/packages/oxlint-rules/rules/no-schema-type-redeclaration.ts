import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "no-schema-type-redeclaration";

// ── Generated schema type names ──────────────────────────────────────────
//
// These are ALL type names from `components["schemas"]` in
// `generated/api-types.ts`. The OpenAPI generator produces these as the
// single source of truth for backend wire types.
//
// If the backend adds new schema types, the OpenAPI generator will add
// them here. Run this command to refresh the list:
//
//   python3 << 'EOF'
//   import re
//   with open('generated/api-types.ts') as f:
//       lines = f.readlines()
//   in_schemas = False
//   depth = 0
//   for line in lines:
//       if not in_schemas:
//           if 'schemas:' in line and '{' in line:
//               in_schemas = True
//               depth = len(line) - len(line.lstrip())
//           continue
//       indent = len(line) - len(line.lstrip())
//       stripped = line.strip()
//       if indent <= depth and stripped.startswith('}'): break
//       if indent == depth + 4 and ':' in stripped and not stripped.startswith('//'):
//           key = stripped.split(':')[0].strip().strip('"').strip("'")
//           if key and not key.startswith('*'): print(f'  "{key}",')
//   EOF
//
// How to use:
//   python3 extract_schema_names.py > /tmp/names.txt
//   # paste the output into this array and sort alphabetically

const GENERATED_SCHEMA_NAMES = new Set([
  "AddDeviceRequest",
  "ApiError",
  "ApiKeyCreatedResponse",
  "ApiKeyResponse",
  "AttendanceDistribution",
  "AuditEventResponse",
  "BatchActionRequest",
  "BatchActionResponse",
  "CalendarDayResponse",
  "ChangePasswordRequest",
  "ClientConfigResponse",
  "ColumnMeta",
  "CorrectPunchRequest",
  "CreateApiKeyRequest",
  "CreateDashboardUserRequest",
  "CreateDepartmentRequest",
  "CreateDeviceGroupRequest",
  "CreateEmployeeRequest",
  "CreateEndpointRequest",
  "CreateWorkPolicyTemplateRequest",
  "CurrentlyCheckedIn",
  "CursorValueType",
  "DailyBreakdown",
  "DailyHoursBreakdown",
  "DashboardDeviceHealth",
  "DashboardHourlyBreakdown",
  "DashboardRecentEvent",
  "DashboardUserResponse",
  "DepartmentResponse",
  "DeviceActivityEntry",
  "DeviceDetailResponse",
  "DeviceDiscoverResponse",
  "DeviceEventListQuery",
  "DeviceEventResponse",
  "DeviceGroupResponse",
  "DeviceHealthEntry",
  "DeviceHealthInfo",
  "DeviceHealthSummaryResponse",
  "DeviceResponse",
  "DeviceSearchQuery",
  "DeviceSummary",
  "DiscoverDeviceRequest",
  "DistributorHealthEntry",
  "EmployeeListQuery",
  "EmployeeReportKpi",
  "EmployeeResponse",
  "EmployeeSummaryResponse",
  "EmployeeWorkDaysResponse",
  "EndpointResponse",
  "EngineHealthStats",
  "EnqueueCommandRequest",
  "EnrollEmployeeRequest",
  "EntitySchema",
  "ExportFormat",
  "FacetKind",
  "FieldError",
  "HealthResponse",
  "IntegrationKind",
  "ListParams",
  "LoginRequest",
  "LoginResponse",
  "MonthlyTrendResponse",
  "NetworkScanResponse",
  "PageMeta",
  "ProviderCapabilitiesResponse",
  "ProviderResponse",
  "ProvisionDeviceRequest",
  "PunchCorrectedResponse",
  "PunchIntegrationListResponse",
  "PunchIntegrationResponse",
  "PunchListQuery",
  "PunchListResponse",
  "PunchResponse",
  "QuickStatsResponse",
  "ReportSummaryQuery",
  "ReportSummaryResponse",
  "ScanNetworkRequest",
  "SearchHit",
  "SearchResults",
  "SetDeviceGroupRequest",
  "SetUserRequest",
  "SetupCompletedResponse",
  "SetupRequest",
  "SetupStatusResponse",
  "SortOrder",
  "StatusResponse",
  "SyncedUserResponse",
  "SystemSettingsResponse",
  "TodaySummaryResponse",
  "TransferTemplatesRequest",
  "UpdateDashboardUserRequest",
  "UpdateDepartmentRequest",
  "UpdateDeviceGroupRequest",
  "UpdateDeviceRequest",
  "UpdateEmployeeRequest",
  "UpdateEndpointRequest",
  "UpdateSystemSettingsRequest",
  "UpdateWorkPolicyRequest",
  "UpdateWorkPolicyTemplateRequest",
  "UserProfileResponse",
  "WeeklyHours",
  "WorkDayResponse",
  "WorkPeriodResponse",
  "WorkPolicyInput",
  "WorkPolicyResponse",
  "WorkPolicyTemplateResponse",
]);

// ── Helpers ─────────────────────────────────────────────────────────────

const isGeneratedFile = (filename: string): boolean =>
  filename.includes("/generated/");

const isTestOrStory = (filename: string): boolean =>
  /\.(test|spec|stories)\.tsx?$/.test(filename);

/**
 * Checks whether a type alias is a safe re-export (not a manual redeclaration).
 *
 * Allowed patterns:
 *   export type ColumnMeta = Schema<"ColumnMeta">;         // generated re-export
 *   export type ColumnMeta = Schema<"ColumnMeta"> & {...};  // extension
 *   export type FacetKind = FacetFilterKind;                 // alias to another type
 *
 * Blocked patterns (these reintroduce the original shape and can drift):
 *   export type FacetKind = "enum" | "reference";           // literal union
 *   export interface PageMeta { ... }                        // interface
 */
function isSafeReexport(node: any): boolean {
  // Must be a type alias (not an interface)
  if (node.type !== "TSTypeAliasDeclaration") return false;

  const typeAnn = node.typeAnnotation;
  if (!typeAnn) return false;

  // Pattern 1: alias to another named type (e.g., `type X = SomeOtherType`)
  // This includes Schema<> re-exports and backward-compat aliases.
  if (typeAnn.type === "TSTypeReference") {
    return true;
  }

  // Pattern 2: intersection with Schema<> → Schema<"Name"> & { ... }
  if (
    typeAnn.type === "TSIntersectionType" &&
    typeAnn.types?.length > 0 &&
    typeAnn.types[0]?.type === "TSTypeReference" &&
    typeAnn.types[0]?.typeName?.name === "Schema"
  ) {
    return true;
  }

  // Pattern 3: union extending Schema<> → Schema<"Name"> | "literal"
  // (e.g. ExportFormat = Schema<"ExportFormat"> | "pdf")
  if (
    typeAnn.type === "TSUnionType" &&
    typeAnn.types?.length > 0 &&
    typeAnn.types.some(
      (t: any) =>
        t.type === "TSTypeReference" && t.typeName?.name === "Schema",
    )
  ) {
    return true;
  }

  // Anything else (literal unions, object types, etc.) is a manual redeclaration
  return false;
}

// ── Rule ────────────────────────────────────────────────────────────────

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Schema types that exist in generated/api-types.ts must not be " +
        "manually redeclared. Use `Schema<\"TypeName\">` re-exports or " +
        "`Schema<\"TypeName\"> & { ... }` extensions instead. " +
        "This prevents silent type drift between the OpenAPI spec and hand-written types.",
    },
    messages: {
      redeclaredSchemaType:
        '"{{ name }}" is a schema type defined in generated/api-types.ts. ' +
        "Manual redeclaration causes silent type drift — the hand-written type may " +
        "diverge from the generated source of truth. " +
        'Replace with: `export type {{ name }} = Schema<"{{ name }}">` (re-export) ' +
        'or `export type {{ name }} = Schema<"{{ name }}"> & { ... }` (extension). ' +
        "See types/metadata.ts for examples of correct Schema<> re-exports.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    // Exempt generated/ files (they ARE the source of truth)
    if (isGeneratedFile(filename)) return {};
    // Exempt test and story files
    if (isTestOrStory(filename)) return {};

    return {
      ExportNamedDeclaration(node: any) {
        const decl = node.declaration;
        if (!decl) return;

        // Only check type alias and interface declarations
        const isTypeAlias = decl.type === "TSTypeAliasDeclaration";
        const isInterface = decl.type === "TSInterfaceDeclaration";
        if (!isTypeAlias && !isInterface) return;

        const name = decl.id?.name;
        if (!name) return;

        // Not a generated schema type — nothing to check
        if (!GENERATED_SCHEMA_NAMES.has(name)) return;

        // Type aliases: check if it's a safe re-export (Schema<>, alias, extension)
        if (isTypeAlias) {
          if (isSafeReexport(decl)) return;
          // Falls through to error
        }

        // Interface declarations: always an error (interfaces can't re-export Schema<>)
        // Type aliases that aren't Schema<> re-exports: error

        context.report({
          node: decl.id,
          messageId: "redeclaredSchemaType",
          data: { name },
        });
      },
    };
  },
});
