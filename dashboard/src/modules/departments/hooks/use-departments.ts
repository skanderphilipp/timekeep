import { useQuery } from "@tanstack/react-query";
import { fetchDepartments, type Department } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Department list hook — fetches all departments.
 */
export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: QueryKeys.departments.list(),
    queryFn: fetchDepartments,
  });
}
