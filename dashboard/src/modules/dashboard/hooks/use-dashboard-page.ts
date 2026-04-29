import { useLingui } from "@lingui/react";

import { useDashboard } from "./use-dashboard";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useCallback } from "react";

/**
 * Dashboard page orchestration hook.
 *
 * Composes useDashboard (data) + useOpenDetailPanel (navigation) into
 * a single consumable return for the page. This is the ONE hook the page calls.
 */
export function useDashboardPage() {
  const { data, isLoading, isFetching, error, refetch, secondsSinceUpdate } = useDashboard();
  const openDetail = useOpenDetailPanel();
  const { _ } = useLingui();

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const handleUserClick = useCallback(
    (userPin: string, name?: string | null) => openDetail("user", userPin, name ?? userPin),
    [openDetail],
  );

  const handleDeviceClick = useCallback(
    (sn: string, label: string) => openDetail("device", sn, label),
    [openDetail],
  );

  return {
    _,
    data,
    isLoading,
    isFetching,
    error,
    secondsSinceUpdate,
    handleRefresh,
    handleUserClick,
    handleDeviceClick,
  };
}
