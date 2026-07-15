import { atom } from "jotai";

/** Currently selected employee ID for the detail view. */
export const selectedEmployeeIdAtom = atom<string | null>(null);

/** Current search term in the employee list. */
export const employeeSearchAtom = atom<string>("");

/** Current department filter in the employee list. */
export const employeeDepartmentFilterAtom = atom<string | null>(null);
