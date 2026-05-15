import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import type { DateRangePreset } from "@/components/ui/date-picker";

/**
 * Shared date range presets for attendance filtering.
 *
 * Extracted from punch-query-page (R1: no logic in pages).
 */
export function useAttendancePresets(): DateRangePreset[] {
  const { _ } = useLingui();

  return useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    return [
      {
        key: "today",
        label: () => _(msg`Today`),
        getRange: () => ({ from: todayStart, to: new Date(todayStart.getTime() + 86_399_999) }),
      },
      {
        key: "yesterday",
        label: () => _(msg`Yesterday`),
        getRange: () => ({ from: yesterdayStart, to: new Date(todayStart.getTime() - 1) }),
      },
      {
        key: "last7",
        label: () => _(msg`Last 7 days`),
        getRange: () => ({ from: new Date(todayStart.getTime() - 6 * 86_400_000), to: todayStart }),
      },
      {
        key: "last30",
        label: () => _(msg`Last 30 days`),
        getRange: () => ({ from: new Date(todayStart.getTime() - 29 * 86_400_000), to: todayStart }),
      },
      {
        key: "thisMonth",
        label: () => _(msg`This Month`),
        getRange: () => ({
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59),
        }),
      },
    ];
  }, [_]);
}
