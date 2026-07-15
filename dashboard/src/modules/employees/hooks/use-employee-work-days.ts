import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeWorkDays, type EmployeeWorkDays, type WorkDayQuery } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Employee work days hook — daily attendance log.
 */
export function useEmployeeWorkDays(pin: string, query?: WorkDayQuery) {
  return useQuery<EmployeeWorkDays>({
    queryKey: QueryKeys.employees.workDays(pin),
    queryFn: () => fetchEmployeeWorkDays(pin, query),
    enabled: pin.length > 0,
  });
}
