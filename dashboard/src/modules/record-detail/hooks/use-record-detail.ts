import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { fetchEmployee, fetchEmployees } from "@/lib/api/employees";
import { fetchDepartment } from "@/lib/api/departments";
import { fetchDeviceGroup } from "@/lib/api/device-groups";
import { fetchDeviceDetail } from "@/lib/api/devices";
import { fetchPunch } from "@/lib/api/punches";
import { fetchWorkPolicyTemplate } from "@/lib/api/work-policies";
import { fetchApiKey } from "@/lib/api/apikeys";
import { fetchAuditEvent } from "@/lib/api/audit";
import { fetchEndpoint } from "@/lib/api/integrations";

/**
 * Unified data fetching hook for any entity detail view.
 *
 * Routes to the correct API endpoint based on entity type.
 * Replaces the per-entity hooks (`useEmployeeDetail`, `useDepartmentDetail`)
 * and the side-panel generic `useEntityDetail`.
 *
 * Pattern: twenty's `useRecordShowPage` — takes entity type + ID, returns
 * the record with proper typing.
 *
 * @example
 * const { data: employee } = useRecordDetail("employee", "abc-123");
 * const { data: department } = useRecordDetail("department", "xyz-456");
 */
export function useRecordDetail(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: QueryKeys.entityDetail.detail(entityType, entityId),
    queryFn: async () => {
      switch (entityType) {
        case "employee":
          return fetchEmployee(entityId) as Promise<Record<string, unknown>>;
        case "department":
          return fetchDepartment(entityId) as Promise<Record<string, unknown>>;
        case "device":
          return fetchDeviceDetail(entityId) as Promise<Record<string, unknown>>;
        case "user":
          // entityId for user is a PIN — look up employee by PIN
          const allEmployees = await fetchEmployees();
          const empByPin = allEmployees.find((e) => e.pin === entityId);
          return (empByPin ?? null) as Record<string, unknown> | null;
        case "punch":
          return fetchPunch(entityId) as Promise<Record<string, unknown>>;
        case "device_group":
          return fetchDeviceGroup(entityId) as Promise<Record<string, unknown>>;
        case "work_policy":
          return fetchWorkPolicyTemplate(entityId) as Promise<Record<string, unknown>>;
        case "api_key":
          return fetchApiKey(entityId) as Promise<Record<string, unknown>>;
        case "audit":
          return fetchAuditEvent(entityId) as Promise<Record<string, unknown>>;
        case "endpoint":
          return fetchEndpoint(entityId) as Promise<Record<string, unknown>>;
        default:
          return null;
      }
    },
    enabled: entityId.length > 0,
  });
}
