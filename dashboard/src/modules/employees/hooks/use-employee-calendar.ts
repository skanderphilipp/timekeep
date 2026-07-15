import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeCalendar, type CalendarDay, type WorkDayQuery } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Employee calendar hook — daily status for the calendar heatmap.
 */
export function useEmployeeCalendar(pin: string, query?: WorkDayQuery) {
  return useQuery<CalendarDay[]>({
    queryKey: QueryKeys.employees.calendar(pin),
    queryFn: () => fetchEmployeeCalendar(pin, query),
    enabled: pin.length > 0,
  });
}
