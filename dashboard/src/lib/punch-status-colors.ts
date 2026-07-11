/**
 * UI color mappings for punch statuses — thin wrapper over the shared catalog.
 *
 * Colors are a presentation concern (not domain logic), so they live here
 * in the dashboard layer rather than in `shared/punch-statuses.ts`.
 *
 * The canonical status definitions come from `@shared/punch-statuses`.
 */

import { PUNCH_STATUSES, type PunchStatusValue } from "@shared/punch-statuses";
import type { StatusColor as TagColor } from "@/types/status-color";

/** Color mapping for punch status → Tag color. */
const STATUS_COLORS: Record<PunchStatusValue, TagColor> = {
  check_in: "green",
  check_out: "red",
  break_out: "amber",
  break_in: "amber",
  overtime_in: "blue",
  overtime_out: "blue",
};

/** Get the Tag color for a punch status value. */
export function getPunchStatusColor(value: string): TagColor {
  return STATUS_COLORS[value as PunchStatusValue] ?? "gray";
}

export { PUNCH_STATUSES, type PunchStatusValue };
