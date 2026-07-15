import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useDashboard } from "./use-dashboard";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useCallback, useMemo } from "react";

/** Format seconds-since-update as a human-friendly label. */
function fmt(s: number | null, _: ReturnType<typeof useLingui>["_"]): string {
  if (s === null) return "";
  if (s < 30) return _(msg`Updated just now`);
  if (s < 60) return _(msg`Updated ${s}s ago`);
  const m = Math.floor(s / 60);
  return s < 3600 ? _(msg`Updated ${m}m ago`) : _(msg`Updated ${Math.floor(s / 3600)}h ago`);
}

/**
 * Dashboard page orchestration hook.
 *
 * Composes useDashboard (data) + useOpenDetailPanel (navigation) +
 * description formatting into a single consumable return for the page.
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

  const description = useMemo(() => {
    const base = _(msg`Attendance overview and device status.`);
    if (secondsSinceUpdate == null) return base;
    return `${base} ${fmt(secondsSinceUpdate, _)}`;
  }, [_, secondsSinceUpdate]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    description,
    handleRefresh,
    handleUserClick,
    handleDeviceClick,
  };
}
