import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Card, Text, Badge, ListItem, EmptyState, ClickableListItem } from "@/components/ui";
import type { CurrentlyCheckedIn } from "@/lib/api";
import styles from "./checked-in-list.module.scss";

type CheckedInListProps = {
  employees: CurrentlyCheckedIn[];
  onUserClick: (userPin: string, name?: string | null) => void;
};

/** Format elapsed seconds into a human-readable string. */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * "Currently Checked In" list — shows employees who are still on-site.
 *
 * Each row: employee name, check-in time, device label, elapsed time.
 * Clicking opens the employee's punch history in the side panel.
 */
export function CheckedInList({ employees, onUserClick }: CheckedInListProps) {
  const { _ } = useLingui();

  if (employees.length === 0) {
    return (
      <Card>
        <Card.Content>
          <EmptyState
            title={_(msg`No one currently checked in`)}
            description={_(msg`All employees have checked out for the day.`)}
          />
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header
        title={_(msg`Currently Checked In`)}
        action={<Badge variant="success">{employees.length}</Badge>}
      />
      <Card.Content>
        {employees.slice(0, 8).map((emp) => (
          <ClickableListItem
            key={emp.user_pin}
            id={emp.user_pin}
            onClick={() => onUserClick(emp.user_pin, emp.employee_name)}
          >
            <ListItem.Leading>
              <Text variant="body" weight="medium">
                {emp.employee_name ?? emp.user_pin}
              </Text>
              <Text variant="caption" color="tertiary">
                {new Date(emp.check_in_time * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · "}
                {emp.device_label ?? emp.device_sn}
              </Text>
            </ListItem.Leading>
            <ListItem.Trailing>
              <Text variant="body" color="secondary">
                {formatElapsed(emp.elapsed_seconds)}
              </Text>
            </ListItem.Trailing>
          </ClickableListItem>
        ))}
        {employees.length > 8 && (
          <Text variant="caption" color="tertiary" className={styles.overflowHint}>
            {_(msg`+ ${employees.length - 8} more employees`)}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}
