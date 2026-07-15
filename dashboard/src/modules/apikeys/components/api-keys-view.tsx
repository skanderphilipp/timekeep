import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, Button, ConfirmDialog } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { useApiKeys } from "../hooks/use-api-keys";
import { useToast } from "@/infrastructure/toast/toast";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { ApiKeyCard } from "./api-key-card";
import { ApiKeyListLoading, ApiKeyListError, ApiKeyListEmpty } from "../states";
import type { ApiKey } from "@/lib/api";

/**
 * API keys view — key list, create dialog, revoke flow via ConfirmDialog.
 *
 * Uses `DataBoundary` for the data pipeline. Local UI state (create dialog,
 * revoke confirmation) stays via `useState` — no cross-component coordination needed.
 */
export function ApiKeysView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, createKey, revokeKey } = useApiKeys();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const handleRevokeRequest = useCallback((id: string, name: string) => {
    setRevokeTarget({ id, name });
  }, []);

  const handleRevokeConfirm = useCallback(async () => {
    if (!revokeTarget) return;
    try {
      await revokeKey.mutateAsync(revokeTarget.id);
      toast.success(_(msg`API key revoked.`));
    } catch {
      toast.error(_(msg`Failed to revoke API key.`));
    } finally {
      setRevokeTarget(null);
    }
  }, [revokeTarget, revokeKey, toast, _]);

  return (
    <>
      <PageHeader
        title={_(msg`API Keys`)}
        description={_(msg`Manage integration API keys for Odoo, Zapier, and other partners.`)}
        actions={
          !query.isLoading && !query.error ? (
            <Button onClick={() => setShowCreateDialog(true)}>{_(msg`Create API Key`)}</Button>
          ) : undefined
        }
      />

      <Section>
        <DataBoundary<ApiKey>
          data={query.data ? query.data : undefined}
          isLoading={query.isLoading}
          error={query.error ?? null}
          onRetry={() => query.refetch()}
          loadingFallback={<ApiKeyListLoading />}
          errorFallback={<ApiKeyListError onRetry={() => query.refetch()} />}
          emptyFallback={<ApiKeyListEmpty />}
        >
          {(keys) =>
            keys.map((key) => (
              <ApiKeyCard key={key.id} key_={key} onRevoke={handleRevokeRequest} />
            ))
          }
        </DataBoundary>
      </Section>

      <CreateApiKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateKey={(req) => createKey.mutateAsync(req)}
        isCreating={createKey.isPending}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title={_(msg`Revoke API Key`)}
        message={revokeTarget ? _(msg`Revoke API key "${revokeTarget.name}"? This cannot be undone.`) : ""}
        confirmLabel={_(msg`Revoke`)}
        cancelLabel={_(msg`Cancel`)}
        variant="danger"
        isPending={revokeKey.isPending}
        onConfirm={handleRevokeConfirm}
      />
    </>
  );
}
