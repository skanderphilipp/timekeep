import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeSummary, type EmployeeSummary, type WorkDayQuery } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Employee attendance summary hook — KPI data (present, absent, late, etc.).
 */
export function useEmployeeSummary(pin: string, query?: WorkDayQuery) {
  return useQuery<EmployeeSummary>({
    queryKey: QueryKeys.employees.summary(pin),
    queryFn: () => fetchEmployeeSummary(pin, query),
    enabled: pin.length > 0,
  });
}
