import { useQuery } from "@tanstack/react-query";
import { fetchWorkPolicyTemplates, type WorkPolicyTemplate } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Work policy template list hook — fetches all work policy templates.
 */
export function useWorkPolicyTemplates() {
  return useQuery<WorkPolicyTemplate[]>({
    queryKey: QueryKeys.workPolicies.list(),
    queryFn: fetchWorkPolicyTemplates,
  });
}
