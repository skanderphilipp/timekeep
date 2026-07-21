import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { fetchEmployeeEnrollments } from "@/lib/api/employees";

/** Stale time for enrollment data (milliseconds). */
const ENROLLMENT_STALE_TIME = 30_000;

/**
 * Fetch device enrollment status for an employee.
 * Returns an empty array while loading or on error.
 */
export function useEmployeeEnrollments(id: string | undefined) {
  return useQuery({
    queryKey: QueryKeys.employees.enrollments(id!),
    queryFn: () => fetchEmployeeEnrollments(id!),
    enabled: !!id,
    staleTime: ENROLLMENT_STALE_TIME,
  });
}
