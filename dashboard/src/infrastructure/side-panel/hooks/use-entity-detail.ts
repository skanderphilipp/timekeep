import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";
import { QueryKeys } from "@/lib/query-keys";
import { PUNCHES_STALE_TIME_MS } from "@/lib/constants";
import { fetchDeviceDetail, type DeviceDetailResponse } from "@/lib/api/devices";
import { fetchEmployees, type Employee } from "@/lib/api/employees";

/**
 * Hook to fetch a single entity's detail for the side panel.
 *
 * Routes to the correct API endpoint based on entity type.
 *
 * @example
 * const { data: device } = useEntityDetail("device", "DEV001");
 * const { data: employee } = useEntityDetail("user", "12345");
 */
export function useEntityDetail(entityType: EntityType, entityId: string) {
	return useQuery({
		queryKey: QueryKeys.entityDetail.detail(entityType, entityId),
		queryFn: async () => {
			switch (entityType) {
				case "device":
					return fetchDeviceDetail(entityId) as Promise<unknown>;
				case "user":
					// entityId for user is a PIN — look up employee by PIN
					const employees = await fetchEmployees();
					const employee = employees.find((e) => e.pin === entityId);
					return employee ?? null;
				case "punch":
					// PunchDetailView handles this from TanStack Query cache
					return null;
				case "api_key":
				case "audit":
					/**
					 * TODO(ENTERPRISE): Add single-entity fetch for api_key and audit.
					 * Phase: Side panel detail views
					 * Impact: Clicking api_key/audit rows shows placeholder text.
					 * Fix: Add fetchApiKey(id) / fetchAuditEvent(id) to @/lib/api.
					 */
					return null;
				default:
					return null;
			}
		},
		enabled: entityId.length > 0,
		staleTime: PUNCHES_STALE_TIME_MS,
	});
}

// Re-export types for convenience
export type { DeviceDetailResponse, Employee };
