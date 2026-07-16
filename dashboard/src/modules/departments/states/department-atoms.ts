import { createState } from "@/infrastructure/state/jotai";

/** Currently selected department ID for the detail view. */
export const selectedDepartmentIdState = createState<string | null>({
  key: "selectedDepartmentId",
  defaultValue: null,
});

/** Current search term in the department list. */
export const departmentSearchState = createState<string>({
  key: "departmentSearch",
  defaultValue: "",
});
