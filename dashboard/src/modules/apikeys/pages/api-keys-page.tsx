import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  PageLayout,
  PageBody,
  PageHeader,
  Section,
  Spinner,
  EmptyState,
  Button,
  PageError,
} from "@/components/ui";
import { useApiKeys } from "../hooks/use-api-keys";
import { useToast } from "@/infrastructure/toast/toast";
import { CreateApiKeyDialog } from "../components/create-api-key-dialog";
import { ApiKeyCard } from "../components/api-key-card";

export function ApiKeysPage() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, createKey, revokeKey } = useApiKeys();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleRevoke = useCallback(
    async (id: string, name: string) => {
      if (
        !window.confirm(
          _(msg`Revoke API key "${name}"? This cannot be undone.`),
        )
      )
        return;
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
      <PageLayout>
        <PageBody>
          <PageHeader title={_(msg`API Keys`)} />
          <Section>
            <Spinner />
          </Section>
        </PageBody>
      </PageLayout>
    );
  }

  if (query.error) {
    return (
      <PageLayout>
        <PageBody>
          <PageHeader
            title={_(msg`API Keys`)}
            description={_(msg`Manage integration API keys for Odoo, Zapier, and other partners.`)}
          />
          <PageError onRetry={() => query.refetch()} />
        </PageBody>
      </PageLayout>
    );
  }

  const keys = query.data ?? [];

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`API Keys`)}
          description={_(msg`Manage integration API keys for Odoo, Zapier, and other partners.`)}
          actions={<Button onClick={() => setShowCreateDialog(true)}>{_(msg`Create API Key`)}</Button>}
        />

        <Section>
          {keys.length === 0 ? (
            <EmptyState
              title={_(msg`No API keys`)}
              description={_(msg`Create an API key to allow external integrations to query attendance data.`)}
            />
          ) : (
            keys.map((key) => (
              <ApiKeyCard key={key.id} key_={key} onRevoke={handleRevoke} />
            ))
          )}
        </Section>

        <CreateApiKeyDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateKey={(req) => createKey.mutateAsync(req)}
          isCreating={createKey.isPending}
        />
      </PageBody>
    </PageLayout>
  );
}
