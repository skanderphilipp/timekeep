import { useQuery } from "@tanstack/react-query";
import { fetchEmployee, type Employee } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Single employee detail hook.
 */
export function useEmployeeDetail(id: string) {
  return useQuery<Employee>({
    queryKey: QueryKeys.employees.detail(id),
    queryFn: () => fetchEmployee(id),
    enabled: id.length > 0,
  });
}
