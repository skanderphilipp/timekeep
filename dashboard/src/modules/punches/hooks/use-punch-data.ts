import { useQuery } from "@tanstack/react-query";

import { fetchPunches, type Punch, type PunchFilter } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Shared punch data hook used by both the AttendanceChart and
 * the punch query page.  Eliminates duplicate query definitions.
 *
 * `PunchFilter` drives the query key, so changing filters
 * automatically refetches.
 */
export function usePunchData(filter: PunchFilter) {
  return useQuery({
    queryKey: QueryKeys.punches.list(filter),
    queryFn: () => fetchPunches(filter),
  });
}

export type { Punch, PunchFilter };
