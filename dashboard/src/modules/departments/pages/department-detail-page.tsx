import { useParams } from "react-router-dom";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconBuilding } from "@tabler/icons-react";

import { PageShell, PageBar } from "@/components/layout";
import { RecordDetailRenderer } from "@/modules/record-detail";
import { useQuery } from "@tanstack/react-query";
import { fetchDepartment } from "@/lib/api/departments";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Department detail page — thin composite.
 *
 * Delegates all detail rendering to {@link RecordDetailRenderer} (ADR-008).
 * Only the page shell (breadcrumb, page bar) stays here.
 */
export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { _ } = useLingui();

  const { data: department } = useQuery({
    queryKey: QueryKeys.departments.detail(id!),
    queryFn: () => fetchDepartment(id!),
    enabled: !!id,
  });

  const title = department?.name || _(msg`Department`);
  const pageLabel = department?.name;

  return (
    <PageShell
      pageLabel={pageLabel}
      header={
        <PageBar title={title} icon={IconBuilding} />
      }
    >
      <RecordDetailRenderer
        entity="department"
        entityId={id!}
        isInSidePanel={false}
      />
    </PageShell>
  );
}
