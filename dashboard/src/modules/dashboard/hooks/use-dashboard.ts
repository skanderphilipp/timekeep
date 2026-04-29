import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchTodaySummary } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/constants";

/**
 * Dashboard summary query hook with "last updated" tracking.
 *
 * Polls the today-summary endpoint for real-time attendance metrics.
 * Tracks when data was last successfully fetched.
 */
export function useDashboard() {
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const query = useQuery({
    queryKey: QueryKeys.dashboard.today(),
    queryFn: fetchTodaySummary,
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  // Track last successful data fetch time
  useEffect(() => {
    if (query.data && !query.isFetching) {
      setLastUpdated(Date.now());
    }
  }, [query.data, query.isFetching]);

  // Re-render every second for the "X seconds ago" display
  const { data: _tick } = useQuery({
    queryKey: ["dashboard-tick"],
    queryFn: () => Date.now(),
    refetchInterval: 1000,
    enabled: !!query.data,
  });

  const secondsSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated) / 1000)
    : null;

  return {
    ...query,
    lastUpdated,
    secondsSinceUpdate,
  };
}
