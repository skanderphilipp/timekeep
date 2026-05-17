import { atom } from "jotai";

/**
 * Report module state atoms.
 *
 * - `reportDateRangeAtom` — the currently active date range for reports.
 */

export type ReportDateRange = {
  dateFrom: string | null;
  dateTo: string | null;
};

/** Active report date range. `null` values = no filter applied. */
export const reportDateRangeAtom = atom<ReportDateRange>({
  dateFrom: null,
  dateTo: null,
});
