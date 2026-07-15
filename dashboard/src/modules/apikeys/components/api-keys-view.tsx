import { useState, useCallback, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, Button, ConfirmDialog } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { TopBar } from "@/modules/shared/components";
import { DataBoundary } from "@/modules/shared/components";
import { SearchInput } from "@/components/ui";
import { useApiKeys } from "../hooks/use-api-keys";
import { useToast } from "@/infrastructure/toast/toast";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { ApiKeyCard } from "./api-key-card";
import { ApiKeyListLoading, ApiKeyListError, ApiKeyListEmpty } from "../states";
import type { ApiKey } from "@/lib/api";

/**
 * API keys view — card-based layout with consistent TopBar.
 *
 * API keys are rendered as cards (not a table) because each key has
 * rich metadata (prefix, permissions, status, expiry) that doesn't
 * fit well in a table row. The TopBar provides search and consistent
 * toolbar appearance with other list pages.
 *
 * TODO(ENTERPRISE): Consider a table layout if more keys need bulk management.
 * Phase: API key management scaling
 * Impact: Card layout won't scale past ~20 keys.
 * Fix: Add a `layout` prop to switch between cards and table via DataListView.
 */
export function ApiKeysView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, revokeKey } = useApiKeys();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

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

  // ── Client-side search ──────────────────────────────────────────
  const keys = query.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return keys;
    return keys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.prefix?.toLowerCase().includes(q),
    );
  }, [keys, search]);

  const hasActiveFilters = search.length > 0;
  const handleClearFilters = useCallback(() => setSearch(""), []);

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
        <TopBar
          center={
            <SearchInput
              placeholder={_(msg`Search by name or prefix…`)}
              value={search}
              onChange={setSearch}
              debounceMs={300}
            />
          }
          resultCount={filtered.length}
          hasActiveFilters={hasActiveFilters}
          onClear={handleClearFilters}
        />

        <DataBoundary<ApiKey>
          data={filtered.length > 0 || !hasActiveFilters ? filtered : undefined}
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
