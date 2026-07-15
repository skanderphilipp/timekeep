import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading, Text, ListItem } from "@/components/ui";
import { type CalendarDayData } from "@/modules/shared/components";
import { type Punch } from "@/modules/punches/hooks/use-punch-data";

type DayDetailPanelProps = {
  day: CalendarDayData;
  punches: Punch[];
};

function formatDateTitle(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Side panel content for a single calendar day's punch records.
 *
 * Shows the date heading + a list of punch entries with time, status, and employee.
 * Composes from UI primitives only — no raw elements.
 */
export function DayDetailPanel({ day, punches }: DayDetailPanelProps) {
  const { _ } = useLingui();

  const title = formatDateTitle(day.date);

  if (punches.length === 0) {
    return (
      <>
        <Heading level="h3">{title}</Heading>
        <Text variant="body" color="tertiary">
          {_(msg`No punch records for this day.`)}
        </Text>
      </>
    );
  }

  return (
    <>
      <Heading level="h3">{title}</Heading>
      {punches.map((p) => (
        <ListItem key={p.id}>
          <ListItem.Leading>
            <Text variant="body" weight="medium">
              {new Date(p.timestamp * 1000).toLocaleTimeString()}
            </Text>
            <Text variant="caption" color="secondary">
              {p.status}
            </Text>
          </ListItem.Leading>
          <ListItem.Trailing>
            <Text variant="caption" color="tertiary">
              {p.employee_name ?? p.user_pin}
            </Text>
          </ListItem.Trailing>
        </ListItem>
      ))}
    </>
  );
}
