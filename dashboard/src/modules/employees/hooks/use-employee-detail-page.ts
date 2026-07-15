import { useParams } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useEmployeeDetail } from "./use-employee-detail";

/**
 * Employee detail page orchestration hook.
 *
 * Extracts route params, fetches employee data, and derives
 * breadcrumb/page-bar values so the page component stays thin.
 */
export function useEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: employee } = useEmployeeDetail(id!);
  const { _ } = useLingui();

  return {
    id: id!,
    employee,
    title: employee?.name || _(msg`Employee`),
    pageLabel: employee?.name,
  } as const;
}
