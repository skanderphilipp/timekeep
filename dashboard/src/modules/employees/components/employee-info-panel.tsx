import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { MetadataGrid } from "@/components/ui";
import type { MetadataField } from "@/components/ui";
import type { Employee } from "@/lib/api";

type EmployeeInfoPanelProps = {
  employee: Employee;
};

/**
 * Derive identity metadata fields from the employee record.
 */
function employeeInfoFields(
  employee: Employee,
  _: ReturnType<typeof useLingui>["_"],
): MetadataField[] {
  return [
    { key: "pin", label: _(msg`PIN`), value: employee.pin },
    { key: "name", label: _(msg`Name`), value: employee.name },
    {
      key: "department",
      label: _(msg`Department`),
      value: employee.department || "—",
    },
    {
      key: "external_id",
      label: _(msg`External ID`),
      value: employee.external_id || "—",
      hideIf: !employee.external_id,
    },
    {
      key: "created",
      label: _(msg`Created`),
      value: new Date(employee.created_at * 1000).toLocaleDateString(),
    },
  ];
}

/**
 * Employee info panel — identity metadata grid.
 *
 * Renders PIN, Name, Department, External ID, and creation date
 * using {@link MetadataGrid}. No conditional JSX.
 */
export function EmployeeInfoPanel({ employee }: EmployeeInfoPanelProps) {
  const { _ } = useLingui();
  const fields = employeeInfoFields(employee, _);

  return <MetadataGrid fields={fields} />;
}
