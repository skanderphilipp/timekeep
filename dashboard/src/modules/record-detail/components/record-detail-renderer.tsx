import type { EntityType } from "@/types/entities";
import { RecordDetailProvider, CreateProvider } from "../states/record-detail-context";
import { useRecordDetail } from "../hooks/use-record-detail";
import { RecordDetailShell } from "./record-detail-shell";
import { RecordDetailHeader } from "./record-detail-header";
import { RecordDetailFields } from "./record-detail-fields";
import { RecordDetailStates } from "./record-detail-states";
import { RecordDetailActions } from "./record-detail-actions";
import { ENTITY_DEFINITIONS } from "../entity-definitions";
import { useMemo, type ReactNode } from "react";

// Entity-specific hooks for auto-fetched content
import { useEmployeeSummary } from "@/modules/employees/hooks/use-employee-summary";
import { useEmployeeWorkDays } from "@/modules/employees/hooks/use-employee-work-days";
import { EmployeeAttendanceLog } from "@/modules/employees/components/employee-attendance-log";
import { DepartmentEmployeesList } from "@/modules/departments/components/department-employees-list";
import { getDeviceDetailContent } from "@/modules/devices/components/device-detail-auto-content";
import type { DeviceDetailResponse } from "@/lib/api";
import { fetchDepartments } from "@/lib/api/departments";
import { useQuery } from "@tanstack/react-query";
import type { ComboboxOption } from "@/types/options";
import type { DetailViewConfig } from "../entity-definitions/types";

// ── Public Props ───────────────────────────────────────────────────────────

type RecordDetailRendererProps = {
  entity: EntityType;
  entityId: string;
  /**
   * Whether rendered inside the side panel. Used by the navigation
   * hook to choose between side panel stack and full-page routes.
   * NOT used for visual branching.
   */
  isInSidePanel: boolean;
  /**
   * Custom actions passed from the page (legacy).
   *
   * TODO(ENTERPRISE): Remove when all pages use entity definition actions
   *                    (Phase 3 complete). Entity actions now come from
   *                    {@link RecordDetailActions} via the entity definition.
   */
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
  const def = ENTITY_DEFINITIONS[entity];
  const config = def?.detailConfig;

  if (!config) {
    return (
      <RecordDetailProvider value={{ entityType: entity, entityId, isInSidePanel }}>
        <RecordDetailShell>
          <div style={{ padding: "24px" }}>
            <p>
              Detail view for {entity} is not yet configured. Add an entry to{" "}
              <code>modules/record-detail/entity-definitions/registry.ts</code>.
            </p>
          </div>
        </RecordDetailShell>
      </RecordDetailProvider>
    );
  }
  return (
    <RecordDetailProvider value={{ entityType: entity, entityId, isInSidePanel }}>
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
  config: DetailViewConfig;
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

  const pin =
    !isNewRecord && entity === "employee" && record
      ? (record as Record<string, unknown>).pin as string | undefined
      : undefined;

  // Current month date range so the attendance log shows a full month, not just today.
  const monthDateRange = useMemo(() => {
    const now = new Date();
    const from = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
    );
    const to = Math.floor(
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000,
    );
    return { from, to };
  }, []);

  const employeeSummary = useEmployeeSummary(pin ?? "", monthDateRange);
  const employeeWorkDays = useEmployeeWorkDays(pin ?? "", monthDateRange);

  const kpiData =
    externalKpiData ??
    (!isNewRecord && entity === "employee" && employeeSummary.data
      ? (employeeSummary.data as unknown as Record<string, unknown>)
      : null);

  // ── Preload reference options for editable FK fields (generalized) ─────

  /**
   * Collect unique referenceEntity values from the entity's detail config.
   * This drives which option lists need preloading — no hardcoded entity checks.
   */
  const referenceEntities = useMemo(() => {
    const entities = new Set<string>();
    const allSections = config.tabs?.flatMap((t) => t.sections) ?? config.sections ?? [];
    for (const section of allSections) {
      for (const field of section.fields) {
        if (field.type === "reference" || field.type === "array") {
          const refEntity = (field.metadata as { referenceEntity?: string }).referenceEntity;
          if (refEntity) entities.add(refEntity);
        }
      }
    }
    return [...entities];
  }, [config]);

  // Preload department options
  const { data: departments, isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ["departments", "options"] as const,
    queryFn: fetchDepartments,
    enabled: referenceEntities.includes("department"),
    staleTime: 5 * 60 * 1000,
  });

  // Preload work policy options
  const { data: workPolicyTemplates, isLoading: isWorkPoliciesLoading } = useQuery({
    queryKey: ["work_policies", "options"] as const,
    queryFn: () =>
      import("@/lib/api/work-policies").then((m) => m.fetchWorkPolicyTemplates()),
    enabled: referenceEntities.includes("work_policy"),
    staleTime: 5 * 60 * 1000,
  });

  // Preload device group options
  const { data: deviceGroups, isLoading: isDeviceGroupsLoading } = useQuery({
    queryKey: ["device_groups", "options"] as const,
    queryFn: () =>
      import("@/lib/api/device-groups").then((m) => m.fetchDeviceGroups()),
    enabled: referenceEntities.includes("device_group"),
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Augment the config with dynamically-loaded reference options.
   * Scans all reference/array fields and injects preloaded options
   * for each known referenceEntity (department, work_policy, etc.).
   */
  const augmentedConfig = useMemo((): DetailViewConfig => {
    if (referenceEntities.length === 0) return config;

    // Build options map: referenceEntity → { options, isLoading }
    const optionsMap = new Map<string, { options: ComboboxOption[]; isLoading: boolean }>();

    if (departments) {
      optionsMap.set("department", {
        options: departments.map((d) => ({ value: d.id, label: d.name })),
        isLoading: isDepartmentsLoading,
      });
    }
    if (workPolicyTemplates) {
      optionsMap.set("work_policy", {
        options: workPolicyTemplates.map((wp) => ({ value: wp.id, label: wp.title })),
        isLoading: isWorkPoliciesLoading,
      });
    }
    if (deviceGroups) {
      optionsMap.set("device_group", {
        options: deviceGroups.map((g) => ({ value: g.id, label: g.name })),
        isLoading: isDeviceGroupsLoading,
      });
    }

    if (optionsMap.size === 0) return config;

    const cloned: DetailViewConfig = JSON.parse(JSON.stringify(config));
    const sections = cloned.sections ?? cloned.tabs?.flatMap((t) => t.sections) ?? [];
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.type !== "reference" && field.type !== "array") continue;
        const refEntity = (field.metadata as { referenceEntity?: string }).referenceEntity;
        if (!refEntity) continue;
        const opts = optionsMap.get(refEntity);
        if (!opts) continue;

        if (field.type === "reference") {
          (field.metadata as { options?: ComboboxOption[] }).options = opts.options;
          field._isLoadingOptions = opts.isLoading;
        } else if (field.type === "array") {
          // Convert ComboboxOption[] -> Record<string, string> for multi-select labels
          const labels: Record<string, string> = {};
          for (const opt of opts.options) {
            labels[opt.value] = opt.label;
          }
          (field.metadata as { labels?: Record<string, string> }).labels = labels;
          field._isLoadingOptions = opts.isLoading;
        }
      }
    }
    return cloned;
  }, [config, referenceEntities, departments, isDepartmentsLoading, workPolicyTemplates, isWorkPoliciesLoading, deviceGroups, isDeviceGroupsLoading]);

  // ── Entity-specific extras ──────────────────────────────────────────────

  let extras: ReactNode = null;

  if (!isNewRecord && entity === "employee" && employeeWorkDays.data) {
    extras = <EmployeeAttendanceLog workDays={employeeWorkDays.data} />;
  }

  // Device: auto-inject status bar, health cards, activity feed
  if (!isNewRecord && entity === "device" && record) {
    const deviceRecord = record as unknown as DeviceDetailResponse;
    const deviceContent = getDeviceDetailContent(deviceRecord);
    extras = deviceContent.children;
  }

  // ── Entity-specific tab children (auto-injected) ────────────────────────

  const mergedTabChildren: Record<string, ReactNode> = { ...tabChildren };

  if (!isNewRecord && entity === "department" && record) {
    mergedTabChildren.details = (
      <>
        {mergedTabChildren.details}
        <DepartmentEmployeesList />
      </>
    );
  }

  // Device: auto-inject all tab content (Overview, Config, Users, Activity)
  if (!isNewRecord && entity === "device" && record) {
    const deviceRecord = record as unknown as DeviceDetailResponse;
    const deviceContent = getDeviceDetailContent(deviceRecord);
    // Merge all device tab children with any externally-provided tab children
    // (externally-provided ones take precedence)
    for (const [key, content] of Object.entries(deviceContent.tabChildren)) {
      mergedTabChildren[key] = mergedTabChildren[key] ?? content;
    }
    // Also merge the extras if not already set above
    if (!extras) {
      extras = deviceContent.children;
    }
  }

  // ── New record: render empty form with create support ───────────────

  if (isNewRecord) {
    return (
      <CreateProvider>
        <RecordDetailShell>
          <RecordDetailHeader record={{}} config={augmentedConfig} />
          <RecordDetailFields record={{}} config={augmentedConfig} kpiData={null} tabChildren={mergedTabChildren}>
            {children}
          </RecordDetailFields>
          <RecordDetailActions>{actions}</RecordDetailActions>
        </RecordDetailShell>
      </CreateProvider>
    );
  }

  // ── View mode: standard detail rendering ───────────────────────────────

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
