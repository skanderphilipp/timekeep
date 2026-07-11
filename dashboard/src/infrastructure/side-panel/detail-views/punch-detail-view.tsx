import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailGrid, DetailItem } from "@/components/ui/detail-grid";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryKeys } from "@/lib/query-keys";
import type { Punch } from "@/lib/api";
import { PUNCH_STATUSES } from "@shared/punch-statuses";
import { VERIFY_MODES } from "@shared/verify-modes";

type PunchDetailViewProps = {
  punchId: string;
};

/**
 * Punch detail view — rendered inside the SidePanel when a punch record
 * needs detailed inspection.
 *
 * Looks up the punch from the existing TanStack Query cache (infinite punch
 * query). If found, renders all punch fields + anomaly flags. If not found
 * (e.g., the punch was scrolled off the infinite list), shows a message
 * suggesting the user search by ID.
 */
export function PunchDetailView({ punchId }: PunchDetailViewProps) {
  const { _ } = useLingui();
  const queryClient = useQueryClient();

  // Search all punch query caches for this punch ID
  const punch = useMemo(() => {
    const caches = queryClient.getQueriesData<Punch[]>({ queryKey: QueryKeys.punches.all });
    for (const [, data] of caches) {
      if (!data) continue;
      const found = data.find((p: Punch) => p.id === punchId);
      if (found) return found;
    }
    return null;
  }, [queryClient, punchId]);

  if (!punch) {
    return (
      <EmptyState
        title={_(msg`Punch Not Found`)}
        description={_(
          msg`This punch record may have been scrolled out of view. Try searching by the punch ID.`,
        )}
      />
    );
  }

  const statusLabel = PUNCH_STATUSES.find((s) => s.value === punch.status);
  const verifyLabel = VERIFY_MODES.find((m) => m.value === punch.verify_mode);
  const time = new Date(punch.timestamp * 1000);

  return (
    <>
      <DetailGrid>
        <DetailItem label={_(msg`Employee`)}>
          <Text variant="body">{punch.employee_name ?? punch.user_pin}</Text>
          {punch.employee_name && (
            <Text variant="caption" color="tertiary">
              PIN: {punch.user_pin}
            </Text>
          )}
        </DetailItem>

        <DetailItem label={_(msg`Time`)}>
          <Text variant="body">{time.toLocaleTimeString()}</Text>
          <Text variant="caption" color="tertiary">
            {time.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </DetailItem>

        <DetailItem label={_(msg`Status`)}>
          <Badge
            variant={
              punch.status === "check_in" ||
              punch.status === "overtime_in" ||
              punch.status === "break_in"
                ? "success"
                : punch.status === "break_out" || punch.status === "overtime_out"
                  ? "warning"
                  : "danger"
            }
          >
            {statusLabel?.label ?? punch.status}
          </Badge>
        </DetailItem>

        <DetailItem label={_(msg`Method`)}>
          <Text variant="body">{verifyLabel?.label ?? punch.verify_mode}</Text>
        </DetailItem>

        <DetailItem label={_(msg`Device`)}>
          <Text variant="body">{punch.device_label ?? punch.device_sn}</Text>
          {punch.device_label && (
            <Text variant="caption" color="tertiary">
              SN: {punch.device_sn}
            </Text>
          )}
        </DetailItem>

        {punch.work_code && (
          <DetailItem label={_(msg`Work Code`)}>
            <code>{punch.work_code}</code>
          </DetailItem>
        )}
      </DetailGrid>

      {punch.is_anomaly && (
        <>
          <Separator />
          <ListItem>
            <ListItem.Leading>
              <Text variant="body" weight="medium" color="danger">
                ⚠️ {_(msg`Anomaly Detected`)}
              </Text>
              {punch.anomaly_type && (
                <Text variant="caption" color="secondary">
                  {punch.anomaly_type}
                </Text>
              )}
            </ListItem.Leading>
          </ListItem>
        </>
      )}

      <Separator />

      <dl style={{ padding: "8px 0", margin: 0 }}>
        <dt>
          <Text variant="caption" color="tertiary">
            {_(msg`Punch ID`)}
          </Text>
        </dt>
        <dd style={{ margin: "2px 0 0 0" }}>
          <code>{punchId}</code>
        </dd>
      </dl>
    </>
  );
}
