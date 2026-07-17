import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";

import {
  Section,
  Text,
  Separator,
  Spinner,
  EmptyState,
  ClickableListItem,
} from "@/components/ui";
import { fetchEmployees } from "@/lib/api/employees";
import { useRecordDetailContext } from "@/modules/record-detail";
import { useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";

import styles from "./department-employees-list.module.scss";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Mini-table listing employees assigned to a department.
 *
 * Rendered inside the department detail view's "Details" tab via
 * `tabChildren={{ details: <DepartmentEmployeesList /> }}`.
 *
 * Each row is clickable → opens the employee detail in the side panel.
 */
export function DepartmentEmployeesList() {
  const { _ } = useLingui();
  const { entityId } = useRecordDetailContext();
  const openRecord = useOpenRecordInSidePanel();

  const employeesQuery = useQuery({
    queryKey: ["employees", "by-department", entityId] as const,
    queryFn: () => fetchEmployees({ department_ids: [entityId] }),
    enabled: entityId.length > 0,
  });

  if (!entityId) return null;

  if (employeesQuery.isLoading) {
    return (
      <Section data-slot="department-employees-loading">
        <Separator />
        <Section data-slot="department-employees-header" className={styles.sectionTitle}>
          <Text variant="body" weight="medium">
            {_(msg`Employees`)}
          </Text>
        </Section>
        <Spinner />
      </Section>
    );
  }

  if (employeesQuery.isError) {
    return (
      <Section data-slot="department-employees-error">
        <Separator />
        <Text variant="body" color="secondary">
          {_(msg`Failed to load employees.`)}
        </Text>
      </Section>
    );
  }

  const employees = employeesQuery.data ?? [];

  if (employees.length === 0) {
    return (
      <Section data-slot="department-employees-empty">
        <Separator />
        <Section data-slot="department-employees-header" className={styles.sectionTitle}>
          <Text variant="body" weight="medium">
            {_(msg`Employees`)}
          </Text>
        </Section>
        <EmptyState
          title={_(msg`No employees`)}
          description={_(msg`This department has no employees assigned yet.`)}
        />
      </Section>
    );
  }

  return (
    <Section data-slot="department-employees-list">
      <Separator />
      <Section data-slot="department-employees-header" className={styles.sectionTitle}>
        <Text variant="body" weight="medium">
          {_(msg`Employees`)} ({employees.length})
        </Text>
      </Section>
      <Section data-slot="department-employees-rows">
        {employees.map((emp) => (
          <ClickableListItem
            key={emp.id}
            id={emp.id}
            onClick={() =>
              openRecord({
                entityType: "employee",
                entityId: emp.id,
                title: emp.name,
              })
            }
          >
            <Section data-slot="employee-row" className={styles.employeeRow}>
              <Text variant="body" weight="medium">
                {emp.name}
              </Text>
              <Text variant="body" color="secondary">
                {emp.pin}
              </Text>
            </Section>
          </ClickableListItem>
        ))}
      </Section>
    </Section>
  );
}

/**
 * Renders a `boolean[]` of working days as weekday tags.
 *
 * @example
 * renderWorkingDays([true, true, true, true, true, false, false])
 * // → Mon Tue Wed Thu Fri (Sat, Sun dimmed)
 */
export function WorkingDaysDisplay({ days }: { days: boolean[] }) {
  return (
    <Section data-slot="working-days-display" className={styles.workingDaysRow}>
      {DAY_NAMES.map((day, i) => {
        const isWorking = days[i] ?? false;
        return (
          <Text
            key={day}
            variant="caption"
            color={isWorking ? "primary" : "secondary"}
            weight={isWorking ? "medium" : "regular"}
          >
            {day}
          </Text>
        );
      })}
    </Section>
  );
}
