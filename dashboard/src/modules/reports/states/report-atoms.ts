import { createState } from "@/infrastructure/state/jotai";

/**
 * Report module state atoms.
 */

export type ReportDateRange = {
  dateFrom: string | null;
  dateTo: string | null;
};

/** Active report date range. `null` values = no filter applied. */
export const reportDateRangeState = createState<ReportDateRange>({
  key: "reportDateRange",
  defaultValue: {
    dateFrom: null,
    dateTo: null,
  },
});

/** Active report view type. */
export const reportViewState = createState<"summary" | "detailed">({
  key: "reportView",
  defaultValue: "summary",
});

/** Active employee filter for reports (by PIN). */
export const reportEmployeeFilterState = createState<string | null>({
  key: "reportEmployeeFilter",
  defaultValue: null,
});
