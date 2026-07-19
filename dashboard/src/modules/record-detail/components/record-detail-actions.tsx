import { Section, Button } from "@/components/ui";
import { useRecordDetailContext, useCreateContext } from "../states/record-detail-context";
import { useRecordActions } from "../hooks/use-record-actions";
import { ENTITY_DEFINITIONS } from "../entity-definitions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useToast } from "@/infrastructure/toast/toast";
import { useNavigate } from "react-router-dom";
import { AppRoute } from "@/lib/navigation";
import { useSidePanelNavigation } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import type { ReactNode } from "react";
import styles from "./record-detail.module.scss";

type RecordDetailActionsProps = {
  /** Optional children injected from outside (legacy — for backward compatibility). */
  children?: ReactNode;
};

/**
 * Actions area — rendered identically in both main panel and side panel.
 *
 * In **view mode**: renders entity actions from the definition's
 * {@link ActionFactory}. In **create mode** (entityId is empty): renders
 * a "Create" button that calls the entity's {@link EntityDefinition.createFn}
 * with accumulated field data.
 *
 * The `children` prop is for legacy page-level actions passed as
 * ReactNode. TODO(ENTERPRISE): Remove children prop when all pages
 * use entity definition actions (Phase 3 complete).
 */
export function RecordDetailActions({ children }: RecordDetailActionsProps) {
  const { entityType, entityId } = useRecordDetailContext();
  const createCtx = useCreateContext();
  const isCreating = createCtx !== null;

  const viewActions = useRecordActions({ entityType, entityId });

  // ── Create mode ────────────────────────────────────────────────────

  if (isCreating) {
    return (
      <Section data-slot="record-detail-actions" className={styles.actionsRow}>
        <CreateButton entityType={entityType} />
        {children}
      </Section>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────

  const hasEntityActions = viewActions.length > 0;
  const hasChildren = !!children;

  if (!hasEntityActions && !hasChildren) {
    return null;
  }

  return (
    <Section data-slot="record-detail-actions" className={styles.actionsRow}>
      {viewActions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={action.variant ?? "secondary"}
          onClick={() => action.action()}
          disabled={action.disabled}
          loading={action.loading}
          icon={action.icon ? <action.icon size={14} /> : undefined}
        >
          {action.label}
        </Button>
      ))}
      {children}
    </Section>
  );
}

// ── Create Button ────────────────────────────────────────────────────────

type CreateButtonProps = {
  entityType: import("@/types/entities").EntityType;
};

function CreateButton({ entityType }: CreateButtonProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createCtx = useCreateContext();
  const { activeEntry, replaceActiveEntityId } = useSidePanelNavigation();

  const def = ENTITY_DEFINITIONS[entityType];
  const hasCreateFn = !!def?.createFn;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!hasCreateFn || !createCtx) {
        throw new Error(`Create not supported for entity: ${entityType}`);
      }
      return def.createFn!(createCtx.accumulatedData.current);
    },
    onSuccess: (result) => {
      toast.success(_(msg`Created successfully`));
      queryClient.invalidateQueries({ queryKey: def.listQueryKey() });

      const newId = (result as Record<string, unknown>)[def.idField] as string;
      if (!newId) return;

      // Derive a display title from the name field
      const nameField = def.detailConfig.nameField;
      const nameValue = (result as Record<string, unknown>)[nameField];
      const title = typeof nameValue === "string" ? nameValue : `${entityType} ${newId}`;

      if (activeEntry) {
        // Side panel: replace the create entry with the new record's detail view
        replaceActiveEntityId({ entityId: newId, title });
      } else {
        // Main panel: navigate to the new record's detail page
        switch (entityType) {
          case "employee":
            navigate(AppRoute.employees.detail(newId));
            break;
          case "department":
            navigate(AppRoute.departments.detail(newId));
            break;
          case "device_group":
            navigate(AppRoute.devices.groups);
            break;
          default:
            break;
        }
      }
    },
    onError: () => {
      toast.error(_(msg`Create failed`));
    },
  });

  if (!hasCreateFn) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="primary"
      onClick={() => createMutation.mutate()}
      loading={createMutation.isPending}
    >
      {_(msg`Create`)}
    </Button>
  );
}
