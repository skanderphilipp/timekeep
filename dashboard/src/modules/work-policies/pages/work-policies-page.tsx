import { PageShell } from "@/components/layout";
import { WorkPoliciesView } from "../components/work-policies-view";

/**
 * Work policies list page — thin composite.
 */
export function WorkPoliciesPage() {
  return (
    <PageShell>
      <WorkPoliciesView />
    </PageShell>
  );
}
