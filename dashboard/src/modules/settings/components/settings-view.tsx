import { useLingui } from "@lingui/react";
import { useMemo, useState } from "react";
import { msg } from "@lingui/core/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Section, Card, Form, FormActions, Button, SchemaForm, DetailGrid, DetailItem, Badge, Text, Heading } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { useSettingsPage } from "../hooks/use-settings-page";
import { createSystemSettingsFormDef } from "../schemas/settings-form.schema";
import { SettingsLoading, SettingsError } from "../states";
import { updateSystemSettings } from "@/lib/api";
import type { Health, WorkPolicy as WorkPolicyType } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useToast } from "@/infrastructure/toast/toast";
import { WorkPolicyForm, DEFAULT_WORK_POLICY } from "./work-policy-form";

// ═══════════════════════════════════════════════════════════════════════
// Health status helpers
// ═══════════════════════════════════════════════════════════════════════

function healthVariant(status: string): {
  dot: "online" | "offline" | "warning";
  variant: "success" | "warning" | "danger" | "neutral";
} {
  if (status === "healthy" || status === "connected") return { dot: "online", variant: "success" };
  if (status === "degraded") return { dot: "warning", variant: "warning" };
  return { dot: "offline", variant: "neutral" };
}

function healthLabel(status: string, _: ReturnType<typeof useLingui>["_"]): string {
  switch (status) {
    case "healthy": return _(msg`Healthy`);
    case "degraded": return _(msg`Degraded`);
    case "connected": return _(msg`Connected`);
    default: return _(msg`Error`);
  }
}

function ProtocolIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge dot={active ? "online" : "offline"} variant={active ? "success" : "neutral"}>
      {label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

type HealthCardsProps = {
  health: Health;
  formatUptime: (seconds: number) => string;
  _: ReturnType<typeof useLingui>["_"];
};

function HealthCards({ health, formatUptime, _ }: HealthCardsProps) {
  return (
    <>
      <Card>
        <Card.Content>
          <DetailGrid title={_(msg`System Health`)}>
            <DetailItem label={_(msg`Status`)}>
              <Badge dot={healthVariant(health.status).dot} variant={healthVariant(health.status).variant}>
                {healthLabel(health.status, _)}
              </Badge>
            </DetailItem>
            <DetailItem label={_(msg`Version`)}>v{health.version}</DetailItem>
            <DetailItem label={_(msg`Database`)}>
              <Badge dot={healthVariant(health.db).dot} variant={healthVariant(health.db).variant}>
                {healthLabel(health.db, _)}
              </Badge>
            </DetailItem>
            <DetailItem label={_(msg`Uptime`)}>{formatUptime(health.uptime_seconds)}</DetailItem>
          </DetailGrid>
        </Card.Content>
      </Card>
      {health.engine && (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Engine Pipeline`)}>
              <DetailItem label={_(msg`Events Processed`)}>{health.engine.events_processed.toLocaleString()}</DetailItem>
              <DetailItem label={_(msg`Events Dropped`)}>{health.engine.events_dropped.toLocaleString()}</DetailItem>
              <DetailItem label={_(msg`Events Distributed`)}>{health.engine.events_distributed.toLocaleString()}</DetailItem>
              <DetailItem label={_(msg`Events Failed`)}>{health.engine.events_failed.toLocaleString()}</DetailItem>
            </DetailGrid>
          </Card.Content>
        </Card>
      )}
      {health.devices && health.devices.length > 0 && (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Devices`)}>
              {health.devices.map((d) => (
                <DetailItem key={d.serial_number} label={d.serial_number}>
                  <ProtocolIndicator active={d.adms_active} label="ADMS" />{" "}
                  <ProtocolIndicator active={d.sdk_active} label="SDK" />
                  {d.last_seen_secs_ago != null && (
                    <Text as="span" variant="caption" color="tertiary">
                      {_(msg`Last seen`)}: {d.last_seen_secs_ago}s ago
                    </Text>
                  )}
                </DetailItem>
              ))}
            </DetailGrid>
          </Card.Content>
        </Card>
      )}
      {health.distributors && health.distributors.length > 0 && (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Distributors`)}>
              {health.distributors.map((d) => (
                <DetailItem key={d.name} label={d.name}>
                  <Text as="span" variant="caption" color="success">{d.delivered} {_(msg`delivered`)}</Text>
                  {d.queued > 0 && <Text as="span" variant="caption" color="warning">{" · "}{d.queued} {_(msg`queued`)}</Text>}
                  {d.dead > 0 && <Text as="span" variant="caption" color="danger">{" · "}{d.dead} {_(msg`dead`)}</Text>}
                </DetailItem>
              ))}
            </DetailGrid>
          </Card.Content>
        </Card>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Work Policy Section (standalone, self-managed state)
// ═══════════════════════════════════════════════════════════════════════

function WorkPolicySection() {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [workPolicy, setWorkPolicy] = useState<WorkPolicyType>(DEFAULT_WORK_POLICY);

  /**
   * TODO(ENTERPRISE): Load existing work policy from system settings.
   *
   * Phase: Settings Work Policy tab
   * Impact: Form always starts with defaults, not persisted values.
   * Fix: Use `fetchSystemSettings()` to populate initial state, then
   *       update `setWorkPolicy` when data arrives.
   */

  const saveMutation = useMutation({
    mutationFn: () => updateSystemSettings({ work_policy: workPolicy }),
    onSuccess: () => {
      toast.success(_(msg`Work policy saved.`));
      queryClient.invalidateQueries({ queryKey: QueryKeys.settings.system() });
    },
    onError: (err: Error) => toast.error(_(msg`Failed to save work policy: ${err.message}`)),
  });

  return (
    <Section>
      <Card>
        <Card.Content>
          <Heading level="h2">{_(msg`Organization Default Work Policy`)}</Heading>
          <Text variant="body" color="tertiary" style={{ marginBottom: "var(--ao-spacing-4)" }}>
            {_(msg`This policy applies to all departments that do not have a custom work policy.`)}
          </Text>
          <WorkPolicyForm value={workPolicy} onChange={setWorkPolicy} />
          <FormActions>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {_(msg`Save Work Policy`)}
            </Button>
          </FormActions>
        </Card.Content>
      </Card>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// View
// ═══════════════════════════════════════════════════════════════════════

export function SettingsView() {
  const { _ } = useLingui();
  const page = useSettingsPage();

  const formSchema = createSystemSettingsFormDef(_);

  const healthError = useMemo(
    () => (page.healthError ? new Error("Health check failed") : null),
    [page.healthError],
  );
  const settingsError = useMemo(
    () => page.settingsError ?? null,
    [page.settingsError],
  );

  return (
    <>
      <PageHeader
        title={_(msg`System`)}
        description={_(msg`System configuration, health status, and account information.`)}
      />

      {/* ── System Health ─────────────────────────────────────── */}
      <Section>
        <DataBoundary<Health>
          data={page.health ? [page.health] : undefined}
          isLoading={page.healthLoading}
          error={healthError}
          onRetry={() => page.refetchHealth()}
          loadingFallback={<SettingsLoading />}
          errorFallback={<SettingsError onRetry={() => page.refetchHealth()} section="health status" />}
        >
          {([h]) => <HealthCards health={h} formatUptime={page.formatUptime} _={_} />}
        </DataBoundary>
      </Section>

      {/* ── Settings Form ─────────────────────────────────────── */}
      <Section>
        <DataBoundary<unknown>
          data={page.settingsError || page.settingsLoading ? undefined : [{}]}
          isLoading={page.settingsLoading}
          error={settingsError}
          onRetry={() => page.refetchSettings()}
          loadingFallback={<SettingsLoading />}
          errorFallback={<SettingsError onRetry={() => page.refetchSettings()} section="settings" />}
        >
          {() => (
            <Form onSubmit={page.handleSubmit}>
              <SchemaForm formSchema={formSchema} form={page.form} />
              <FormActions>
                <Button type="submit" loading={page.isSaving}>
                  {_(msg`Save`)}
                </Button>
              </FormActions>
            </Form>
          )}
        </DataBoundary>
      </Section>

      {/* ── Work Policy ───────────────────────────────────────── */}
      <WorkPolicySection />

      {/* ── Account ───────────────────────────────────────────── */}
      {page.user && (
        <Section>
          <Card>
            <Card.Content>
              <DetailGrid title={_(msg`Account`)}>
                <DetailItem label={_(msg`Username`)}>{page.user.sub ?? _(msg`Unknown`)}</DetailItem>
                <DetailItem label={_(msg`Role`)}>{page.user.role ?? _(msg`Unknown`)}</DetailItem>
                <DetailItem label={_(msg`Permissions`)}>{page.user.permissions ?? _(msg`None`)}</DetailItem>
              </DetailGrid>
            </Card.Content>
          </Card>
        </Section>
      )}
    </>
  );
}
