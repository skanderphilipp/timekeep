import { createState } from "@/infrastructure/state/jotai";

/** Currently selected employee ID for the detail view. */
export const selectedEmployeeIdState = createState<string | null>({
  key: "selectedEmployeeId",
  defaultValue: null,
});

/** Current search term in the employee list. */
export const employeeSearchState = createState<string>({
  key: "employeeSearch",
  defaultValue: "",
});

/** Current department filter in the employee list. */
export const employeeDepartmentFilterState = createState<string | null>({
  key: "employeeDepartmentFilter",
  defaultValue: null,
});


