import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeMonthly, type MonthlyTrendPoint } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Employee monthly trend hook — present/absent/late over months.
 */
export function useEmployeeMonthly(pin: string) {
  return useQuery<MonthlyTrendPoint[]>({
    queryKey: QueryKeys.employees.monthly(pin),
    queryFn: () => fetchEmployeeMonthly(pin),
    enabled: pin.length > 0,
  });
}
