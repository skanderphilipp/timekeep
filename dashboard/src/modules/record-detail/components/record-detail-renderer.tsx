import type { EntityType } from "@/types/entities";
import { RecordDetailProvider } from "../states/record-detail-context";
import { useRecordDetail } from "../hooks/use-record-detail";
import { RecordDetailShell } from "./record-detail-shell";
import { RecordDetailHeader } from "./record-detail-header";
import { RecordDetailFields } from "./record-detail-fields";
import { RecordDetailStates } from "./record-detail-states";
import { RecordDetailActions } from "./record-detail-actions";
import { DETAIL_VIEW_CONFIGS } from "../types";
import { useMemo, type ReactNode } from "react";

// Entity-specific hooks for auto-fetched content
import { useEmployeeSummary } from "@/modules/employees/hooks/use-employee-summary";
import { useEmployeeWorkDays } from "@/modules/employees/hooks/use-employee-work-days";
import { EmployeeAttendanceLog } from "@/modules/employees/components/employee-attendance-log";
import { DepartmentEmployeesList } from "@/modules/departments/components/department-employees-list";
import { fetchDepartments } from "@/lib/api/departments";
import { useQuery } from "@tanstack/react-query";
import type { ComboboxOption } from "@/types/options";
import type { DetailViewConfig } from "../types";

// ── Public Props ───────────────────────────────────────────────────────────

type RecordDetailRendererProps = {
  entity: EntityType;
  entityId: string;
  isInSidePanel: boolean;
  /** Custom actions (main panel only). */
  actions?: ReactNode;
  /**
   * Custom children rendered after auto-fetched entity extras.
   * For complex entities (device) that need tabs, charts, etc.
   */
  children?: ReactNode;
  /**
   * Custom React content keyed by tab key. Rendered after each tab's
   * declarative sections inside the `<TabPanel>`.
   *
   * Use this for complex tab content that can't be expressed as field
   * configs (forms, lists, charts, action buttons).
   *
   * @example
   * tabChildren={{ config: <DeviceForm embedded onSaved={refresh} /> }}
   */
  tabChildren?: Record<string, ReactNode>;
  /**
   * Optional KPI data override. If not provided, the renderer fetches
   * entity-specific KPIs automatically (e.g., employee attendance summary
   * for both main panel and side panel).
   */
  kpiData?: Record<string, unknown> | null;
};

// ── Main Component ────────────────────────────────────────────────────────

export function RecordDetailRenderer({
  entity,
  entityId,
  isInSidePanel,
  actions,
  children,
  tabChildren,
  kpiData: externalKpiData,
}: RecordDetailRendererProps) {
  const config = DETAIL_VIEW_CONFIGS[entity];

  if (!config) {
    return (
      <RecordDetailProvider
        value={{ entityType: entity, entityId, isInSidePanel }}
      >
        <RecordDetailShell>
          <div style={{ padding: "24px"}}>
            <p>
              Detail view for {entity} is not yet configured. Add an entry to{" "}
              <code>modules/record-detail/types.ts</code>.
            </p>
          </div>
        </RecordDetailShell>
      </RecordDetailProvider>
    );
  }
  return (
    <RecordDetailProvider
      value={{ entityType: entity, entityId, isInSidePanel }}
    >
      <RecordDetailRendererInner
        entity={entity}
        entityId={entityId}
        config={config}
        actions={actions}
        children={children}
        tabChildren={tabChildren}
        externalKpiData={externalKpiData}
      />
    </RecordDetailProvider>
  );
}
// ── Internal — fetches entity-specific extras automatically ───────────────

type RecordDetailRendererInnerProps = {
  entity: EntityType;
  entityId: string;
  config: NonNullable<(typeof DETAIL_VIEW_CONFIGS)[EntityType]>;
  actions?: ReactNode;
  children?: ReactNode;
  tabChildren?: Record<string, ReactNode>;
  externalKpiData?: Record<string, unknown> | null;
};

function RecordDetailRendererInner({
  entity,
  entityId,
  config,
  actions,
  children,
  tabChildren,
  externalKpiData,
}: RecordDetailRendererInnerProps) {
  /** Twenty pattern: derive isNewRecord from empty entityId, not a separate mode. */
  const isNewRecord = entityId.length === 0;

  // When creating, skip data fetching — render empty form
  const {
    data: record,
    isLoading,
    error,
  } = useRecordDetail(entity, isNewRecord ? "" : entityId);

  // ── Auto-fetched entity data ────────────────────────────────────────────
  // Both main panel and side panel get this data automatically.
  // Skip for new records (no existing record to derive from).

  const pin =
    !isNewRecord && entity === "employee" && record
      ? (record as Record<string, unknown>).pin as string | undefined
      : undefined;

  const employeeSummary = useEmployeeSummary(pin ?? "", {});
  const employeeWorkDays = useEmployeeWorkDays(pin ?? "", {});

  const kpiData =
    externalKpiData ??
    (!isNewRecord && entity === "employee" && employeeSummary.data
      ? (employeeSummary.data as unknown as Record<string, unknown>)
      : null);

  // ── Preload reference options for editable FK fields ──────────────────────

  const { data: departments, isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ["departments", "options"] as const,
    queryFn: fetchDepartments,
    enabled: entity === "employee" || entity === "device_group",
    staleTime: 5 * 60 * 1000,
  });

  /** Augment the config with dynamically-loaded reference options. */
  const augmentedConfig = useMemo((): DetailViewConfig => {
    if (entity !== "employee" && entity !== "device_group") return config;
    if (!departments) return config;

    const deptOptions: ComboboxOption[] = departments.map((d) => ({
      value: d.id,
      label: d.name,
    }));

    // Deep-clone the config and inject options into the department reference/array fields
    const cloned: DetailViewConfig = JSON.parse(JSON.stringify(config));
    const sections = cloned.sections ?? cloned.tabs?.flatMap((t) => t.sections) ?? [];
    for (const section of sections) {
      for (const field of section.fields) {
        // Single-select reference (e.g., employee.department_id)
        if (
          field.type === "reference" &&
          (field.metadata as { referenceEntity?: string }).referenceEntity === "department"
        ) {
          (field.metadata as { options?: ComboboxOption[] }).options = deptOptions;
          field._isLoadingOptions = isDepartmentsLoading;
        }
        // Multi-select array reference (e.g., device_group.department_ids)
        if (
          field.type === "array" &&
          (field.metadata as { referenceEntity?: string }).referenceEntity === "department"
        ) {
          (field.metadata as { options?: ComboboxOption[] }).options = deptOptions;
          field._isLoadingOptions = isDepartmentsLoading;
        }
      }
    }
    return cloned;
  }, [entity, departments, isDepartmentsLoading, config]);

  // ── Entity-specific extras (children slot) ────────────────────────────────

  let extras: ReactNode = null;

  if (!isNewRecord && entity === "employee" && employeeWorkDays.data) {
    extras = <EmployeeAttendanceLog workDays={employeeWorkDays.data} />;
  }
  // ── Entity-specific tab children (auto-injected) ──────────────────────────

  const mergedTabChildren: Record<string, ReactNode> = { ...tabChildren };

  if (!isNewRecord && entity === "department" && record) {
    // Inject department employees list into the "details" tab
    mergedTabChildren.details = (
      <>
        {mergedTabChildren.details}
        <DepartmentEmployeesList />
      </>
    );
  }
  // ── New record: render empty form with all editable fields ───────────────

  if (isNewRecord) {
    return (
      <RecordDetailShell>
        <RecordDetailHeader record={{}} config={augmentedConfig} />
        <RecordDetailFields record={{}} config={augmentedConfig} kpiData={null} tabChildren={mergedTabChildren}>
          {children}
        </RecordDetailFields>
        <RecordDetailActions>{actions}</RecordDetailActions>
      </RecordDetailShell>
    );
  }
  // ── View mode: standard detail rendering ─────────────────────────────────

  return (
    <RecordDetailStates isLoading={isLoading} error={error} record={record}>
      <RecordDetailShell>
        <RecordDetailHeader record={record!} config={augmentedConfig} />
        <RecordDetailFields record={record!} config={augmentedConfig} kpiData={kpiData} tabChildren={mergedTabChildren}>
          {extras}
          {children}
        </RecordDetailFields>
        <RecordDetailActions>{actions}</RecordDetailActions>
      </RecordDetailShell>
    </RecordDetailStates>
  );
}
