import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs, type AuditFilter } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Audit log query hook.
 *
 * Fetches audit events from the audit endpoint with optional filters.
 * Filter changes trigger automatic refetch via the query key.
 */
export function useAuditLog(filter: AuditFilter) {
  return useQuery({
    queryKey: QueryKeys.audit.list(filter),
    queryFn: () => fetchAuditLogs(filter),
  });
}
