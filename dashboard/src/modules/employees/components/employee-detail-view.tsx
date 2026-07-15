import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconArrowLeft, IconPencil, IconUsersPlus } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { useEmployeeDetail } from "../hooks/use-employee-detail";
import { useEmployeeSummary } from "../hooks/use-employee-summary";
import { useEmployeeWorkDays } from "../hooks/use-employee-work-days";
import { employeeStatCards } from "../lib/employee-stats";
import { Section, ActionGroup, Card, ListLoading, EmptyState, Button, Badge, Grid, StatCard, Heading } from "@/components/ui";
import { PageError } from "@/modules/shared/components";
import { EmployeeInfoPanel } from "./employee-info-panel";
import { EmployeeAttendanceLog } from "./employee-attendance-log";
import styles from "./employee-detail-view.module.scss";

type EmployeeDetailViewProps = {
  employeeId: string;
};

/**
 * Employee detail view — identity, attendance KPIs, and daily punch log.
 *
 * Composes exclusively from existing UI primitives and metadata-driven
 * molecules ({@link Grid}, {@link StatCard}, {@link MetadataGrid}).
 */
export function EmployeeDetailView({ employeeId }: EmployeeDetailViewProps) {
  const { _ } = useLingui();

  const employeeQuery = useEmployeeDetail(employeeId);
  const employee = employeeQuery.data;
  const pin = employee?.pin ?? "";

  const summaryQuery = useEmployeeSummary(pin);
  const workDaysQuery = useEmployeeWorkDays(pin);

  // ── States ──────────────────────────────────────────────────────────

  if (employeeQuery.error) {
    return (
      <Section>
        <PageError
          onRetry={() => employeeQuery.refetch()}
          message={_(msg`Could not load employee information.`)}
        />
      </Section>
    );
  }

  if (employeeQuery.isLoading) {
    return <ListLoading />;
  }

  if (!employee) {
    return (
      <Section>
        <EmptyState
          title={_(msg`Employee not found`)}
          description={_(msg`This employee may have been removed.`)}
          action={
            <Button to={AppRoute.employees.list} variant="secondary">
              {_(msg`Back to Employees`)}
            </Button>
          }
        />
      </Section>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────

  const summary = summaryQuery.data;
  const workDays = workDaysQuery.data;

  return (
    <>
      {/* Actions bar */}
      <Section>
        <ActionGroup>
        <Button to={AppRoute.employees.list} variant="secondary" size="sm" icon={<IconArrowLeft size={16} />}>
          {_(msg`All Employees`)}
        </Button>
        <Button to={AppRoute.employees.edit(employeeId)} variant="secondary" size="sm" icon={<IconPencil size={16} />}>
          {_(msg`Edit`)}
        </Button>
        <Button variant="secondary" size="sm" icon={<IconUsersPlus size={16} />}>
          {_(msg`Sync to Devices`)}
        </Button>
        </ActionGroup>
      </Section>

      {/* Identity panel */}
      <Section>
        <Card>
          <Card.Content>
            <section data-slot="employee-name-row" className={styles.headerRow}>
              <Heading level="h2">
                {employee.name}
              </Heading>
              <Badge variant={employee.active ? "success" : "neutral"} size="md">
                {employee.active ? _(msg`Active`) : _(msg`Inactive`)}
              </Badge>
            </section>
            <EmployeeInfoPanel employee={employee} />
          </Card.Content>
        </Card>
      </Section>

      {/* Attendance KPI cards */}
      {summary && (
        <Section>
          <Grid>
            {employeeStatCards(summary, _).map((stat, i) => (
              <StatCard key={i} {...stat} />
            ))}
          </Grid>
        </Section>
      )}

      {/* Daily attendance log */}
      {workDays && (
        <Section>
          <EmployeeAttendanceLog workDays={workDays} />
        </Section>
      )}
    </>
  );
}
