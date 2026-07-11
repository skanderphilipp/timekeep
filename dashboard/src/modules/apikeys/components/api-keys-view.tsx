import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { PageHeader, Section, Spinner, EmptyState, Button, PageError } from "@/components/ui";
import { useApiKeys } from "../hooks/use-api-keys";
import { useToast } from "@/infrastructure/toast/toast";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { ApiKeyCard } from "./api-key-card";

/**
 * API keys view — key list, create dialog, revoke flow.
 *
 * Owns all page state; the page composes this inside PageLayout.
 */
export function ApiKeysView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, createKey, revokeKey } = useApiKeys();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleRevoke = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(_(msg`Revoke API key "${name}"? This cannot be undone.`))) return;
      try {
        await revokeKey.mutateAsync(id);
        toast.success(_(msg`API key revoked.`));
      } catch {
        toast.error(_(msg`Failed to revoke API key.`));
      }
    },
    [revokeKey, toast, _],
  );

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={_(msg`API Keys`)} />
        <Section>
          <Spinner />
        </Section>
      </>
    );
  }

  if (query.error) {
    return (
      <>
        <PageHeader
          title={_(msg`API Keys`)}
          description={_(msg`Manage integration API keys for Odoo, Zapier, and other partners.`)}
        />
        <PageError onRetry={() => query.refetch()} />
      </>
    );
  }

  const keys = query.data ?? [];

  return (
    <>
      <PageHeader
        title={_(msg`API Keys`)}
        description={_(msg`Manage integration API keys for Odoo, Zapier, and other partners.`)}
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>{_(msg`Create API Key`)}</Button>
        }
      />

      <Section>
        {keys.length === 0 ? (
          <EmptyState
            title={_(msg`No API keys`)}
            description={_(
              msg`Create an API key to allow external integrations to query attendance data.`,
            )}
          />
        ) : (
          keys.map((key) => <ApiKeyCard key={key.id} key_={key} onRevoke={handleRevoke} />)
        )}
      </Section>

      <CreateApiKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateKey={(req) => createKey.mutateAsync(req)}
        isCreating={createKey.isPending}
      />
    </>
  );
}
