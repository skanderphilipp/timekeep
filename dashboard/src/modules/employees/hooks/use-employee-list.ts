import { useQuery } from "@tanstack/react-query";
import { fetchEmployees, type Employee } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Employee list hook — fetches all employees.
 *
 * Returns the raw query result. Filtering, searching, and sorting
 * are performed client-side in the view component.
 */
export function useEmployeeList() {
  return useQuery<Employee[]>({
    queryKey: QueryKeys.employees.list(),
    queryFn: () => fetchEmployees(),
  });
}
