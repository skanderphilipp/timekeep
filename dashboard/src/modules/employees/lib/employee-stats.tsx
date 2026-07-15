import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconUsers, IconUserX, IconClockExclamation, IconClockCheck } from "@tabler/icons-react";
import type { StatCardProps } from "@/components/ui";
import type { EmployeeSummary } from "@/lib/api";

/**
 * Derive attendance KPI stat cards from the employee summary response.
 *
 * Uses the horizontal StatCard layout with color-coded
 * icon accents: green = good, red = absent, amber = late, accent = on-time.
 *
 * The returned array has a stable order — use the index as the React `key`.
 */
export function employeeStatCards(
  summary: EmployeeSummary,
  _: ReturnType<typeof useLingui>["_"],
): StatCardProps[] {
  return [
    {
      icon: <IconUsers size={24} />,
      label: _(msg`Present`),
      value: summary.present_days,
      subtitle: `${_(msg`of`)} ${summary.total_days}`,
      layout: "horizontal",
      color: "green",
    },
    {
      icon: <IconUserX size={24} />,
      label: _(msg`Absent`),
      value: summary.absent_days,
      subtitle: `${_(msg`of`)} ${summary.total_days}`,
      layout: "horizontal",
      color: "red",
    },
    {
      icon: <IconClockExclamation size={24} />,
      label: _(msg`Late`),
      value: summary.late_days,
      subtitle: `${_(msg`of`)} ${summary.total_days}`,
      layout: "horizontal",
      color: "amber",
    },
    {
      icon: <IconClockCheck size={24} />,
      label: _(msg`On Time`),
      value: summary.present_days - summary.late_days,
      subtitle: `${_(msg`of`)} ${summary.total_days}`,
      layout: "horizontal",
      color: "accent",
    },
  ];
}
