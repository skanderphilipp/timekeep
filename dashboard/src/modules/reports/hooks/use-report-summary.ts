import { useQuery } from "@tanstack/react-query";
import { fetchReportSummary, type ReportSummaryFilter } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Report summary query hook.
 *
 * Fetches aggregated punch summary for a date range.
 * Filter changes trigger automatic refetch via the query key.
 */
export function useReportSummary(filter: ReportSummaryFilter) {
  return useQuery({
    queryKey: QueryKeys.reports.summary(filter),
    queryFn: () => fetchReportSummary(filter),
    enabled: true,
  });
}
