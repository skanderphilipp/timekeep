import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import type { DateRangePreset } from "@/components/ui";

/** Creates date range presets with fresh dates on every call. */
export function useReportPresets() {
  const { _ } = useLingui();
  return useMemo<DateRangePreset[]>(
    () => [
      {
        key: "today",
        label: () => _(msg`Today`),
        getRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return { from: start, to: new Date(start.getTime() + 86_399_999) };
        },
      },
      {
        key: "thisWeek",
        label: () => _(msg`This Week`),
        getRange: () => {
          const now = new Date();
          const day = now.getDay();
          const monday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - (day === 0 ? 6 : day - 1),
          );
          return { from: monday, to: now };
        },
      },
      {
        key: "thisMonth",
        label: () => _(msg`This Month`),
        getRange: () => {
          const now = new Date();
          return {
            from: new Date(now.getFullYear(), now.getMonth(), 1),
            to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
          };
        },
      },
      {
        key: "lastMonth",
        label: () => _(msg`Last Month`),
        getRange: () => {
          const now = new Date();
          return {
            from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
          };
        },
      },
    ],
    [_],
  );
}
