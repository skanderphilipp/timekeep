import { useQuery } from "@tanstack/react-query";

import { fetchHealth, type Health } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/** Poll health every 30s for live status. */
const HEALTH_REFETCH_INTERVAL_MS = 30_000;

export function useSystemHealth() {
  const { data, isLoading, isError, error, refetch } = useQuery<Health>({
    queryKey: QueryKeys.health.system(),
    queryFn: fetchHealth,
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
    // Health data is useful even when stale — show it but refetch in background
    staleTime: 10_000,
  });

  /** Format uptime seconds into human-readable duration. */
  function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
  }

  return {
    health: data,
    isLoading,
    isError,
    error,
    refetch,
    formatUptime,
  } as const;
}
