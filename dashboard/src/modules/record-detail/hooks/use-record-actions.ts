import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import type { EntityType } from "@/types/entities";
import type { RecordAction, ActionFactoryContext } from "../entity-definitions/types";
import { ENTITY_DEFINITIONS } from "../entity-definitions";
import { useRecordDetailContext } from "../states/record-detail-context";
import { useToast } from "@/infrastructure/toast/toast";

type UseRecordActionsOptions = {
  entityType?: EntityType;
  entityId?: string;
};

/**
 * Returns entity-specific actions powered by the entity definition's
 * {@link ActionFactory}.
 *
 * When called inside `<RecordDetailProvider>`, reads entityType/entityId
 * from context. When called outside (SidePanelShell), pass explicit params.
 *
 * Architecture: timekeep/.notes/architecture/record-detail-enterprise-plan.md
 * — Action definitions live in `entity-definitions/action-factories.ts`,
 *   not in a massive switch statement.
 */
export function useRecordActions(options?: UseRecordActionsOptions): RecordAction[] {
  const { _ } = useLingui();
  const ctx = useRecordDetailContextSafe();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const entityType = options?.entityType ?? ctx?.entityType;
  const entityId = options?.entityId ?? ctx?.entityId ?? "";
  const isNewRecord = entityId.length === 0;

  return useMemo(() => {
    if (isNewRecord || !entityType) return [];

    const def = ENTITY_DEFINITIONS[entityType];
    if (!def?.actionFactory) return [];

    const factoryCtx: ActionFactoryContext = {
      entityId,
      _: _ as ActionFactoryContext["_"],
      toast: {
        success: (msg) => toast.success(msg),
        error: (msg) => toast.error(msg),
      },
      navigate: (path) => navigate(path),
      invalidateQueries: (key) =>
        queryClient.invalidateQueries({ queryKey: key }),
    };

    return def.actionFactory(factoryCtx);
  }, [entityType, entityId, isNewRecord, _, toast, navigate, queryClient]);
}

/** Safe context read — returns null when called outside RecordDetailProvider. */
function useRecordDetailContextSafe() {
  try { return useRecordDetailContext(); }
  catch { return null; }
}
