import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDeviceEnrollments,
  enrollEmployee,
  type DeviceEnrollment,
  type EnrollEmployeeRequest,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device enrollment query + mutation hook.
 *
 * Fetches the list of enrolled employees on a device and provides
 * a mutation to enroll a new employee. Invalidates the enrollment
 * list and device detail on success.
 */
export function useEnrollments(deviceSn: string) {
  const queryClient = useQueryClient();

  const enrollmentsQuery = useQuery({
    queryKey: QueryKeys.devices.enrollments(deviceSn),
    queryFn: () => listDeviceEnrollments(deviceSn),
    enabled: deviceSn.length > 0,
    staleTime: 30_000,
  });

  const enrollMutation = useMutation({
    mutationFn: (req: EnrollEmployeeRequest) => enrollEmployee(deviceSn, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.enrollments(deviceSn) });
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    },
  });

  return {
    enrollments: enrollmentsQuery.data ?? ([] as DeviceEnrollment[]),
    isLoading: enrollmentsQuery.isLoading,
    error: enrollmentsQuery.error,
    refetch: enrollmentsQuery.refetch,
    enroll: enrollMutation,
  } as const;
}
