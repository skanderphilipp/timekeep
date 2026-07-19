import { useLingui } from "@lingui/react";
import { useMemo, useState, useEffect } from "react";
import { msg } from "@lingui/core/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Section, Card, Form, FormActions, Button, SchemaForm, DetailGrid, DetailItem, Badge, Text, Heading, Tabs, Tab, TabPanel } from "@/components/ui";
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
// Tab: Health
// ═══════════════════════════════════════════════════════════════════════

type HealthTabProps = {
  health: Health | undefined;
  healthLoading: boolean;
  healthError: boolean;
  formatUptime: (seconds: number) => string;
  refetchHealth: () => void;
  _: ReturnType<typeof useLingui>["_"];
};

function HealthTab({ health, healthLoading, healthError, formatUptime, refetchHealth, _ }: HealthTabProps) {
  const healthErr = useMemo(
    () => (healthError ? new Error("Health check failed") : null),
    [healthError],
  );

  return (
    <Section>
      <DataBoundary<Health>
        data={health ? [health] : undefined}
        isLoading={healthLoading}
        error={healthErr}
        onRetry={refetchHealth}
        loadingFallback={<SettingsLoading />}
        errorFallback={<SettingsError onRetry={refetchHealth} section="health status" />}
      >
        {([h]) => (
          <>
            <Card>
              <Card.Content>
                <DetailGrid title={_(msg`System Health`)}>
                  <DetailItem label={_(msg`Status`)}>
                    <Badge dot={healthVariant(h.status).dot} variant={healthVariant(h.status).variant}>
                      {healthLabel(h.status, _)}
                    </Badge>
                  </DetailItem>
                  <DetailItem label={_(msg`Version`)}>v{h.version}</DetailItem>
                  <DetailItem label={_(msg`Database`)}>
                    <Badge dot={healthVariant(h.db).dot} variant={healthVariant(h.db).variant}>
                      {healthLabel(h.db, _)}
                    </Badge>
                  </DetailItem>
                  <DetailItem label={_(msg`Uptime`)}>{formatUptime(h.uptime_seconds)}</DetailItem>
                </DetailGrid>
              </Card.Content>
            </Card>
            {h.engine && (
              <Card>
                <Card.Content>
                  <DetailGrid title={_(msg`Engine Pipeline`)}>
                    <DetailItem label={_(msg`Events Processed`)}>{h.engine.events_processed.toLocaleString()}</DetailItem>
                    <DetailItem label={_(msg`Events Dropped`)}>{h.engine.events_dropped.toLocaleString()}</DetailItem>
                    <DetailItem label={_(msg`Events Distributed`)}>{h.engine.events_distributed.toLocaleString()}</DetailItem>
                    <DetailItem label={_(msg`Events Failed`)}>{h.engine.events_failed.toLocaleString()}</DetailItem>
                  </DetailGrid>
                </Card.Content>
              </Card>
            )}
            {h.devices && h.devices.length > 0 && (
              <Card>
                <Card.Content>
                  <DetailGrid title={_(msg`Devices`)}>
                    {h.devices.map((d) => (
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
            {h.distributors && h.distributors.length > 0 && (
              <Card>
                <Card.Content>
                  <DetailGrid title={_(msg`Distributors`)}>
                    {h.distributors.map((d) => (
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
        )}
      </DataBoundary>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab: System Configuration
// ═══════════════════════════════════════════════════════════════════════

type SystemConfigTabProps = {
  settingsLoading: boolean;
  settingsError: Error | null;
  isSaving: boolean;
  handleSubmit: () => void;
  refetchSettings: () => void;
  form: ReturnType<typeof useSettingsPage>["form"];
  _: ReturnType<typeof useLingui>["_"];
};

function SystemConfigTab({
  settingsLoading,
  settingsError,
  isSaving,
  handleSubmit,
  refetchSettings,
  form,
  _,
}: SystemConfigTabProps) {
  const formSchema = createSystemSettingsFormDef(_);

  const settingsErr = useMemo(() => settingsError ?? null, [settingsError]);

  return (
    <Section>
      <DataBoundary<unknown>
        data={settingsError || settingsLoading ? undefined : [{}]}
        isLoading={settingsLoading}
        error={settingsErr}
        onRetry={refetchSettings}
        loadingFallback={<SettingsLoading />}
        errorFallback={<SettingsError onRetry={refetchSettings} section="settings" />}
      >
        {() => (
          <Form onSubmit={handleSubmit}>
            <SchemaForm formSchema={formSchema} form={form} />
            <FormActions>
              <Button type="submit" loading={isSaving}>
                {_(msg`Save`)}
              </Button>
            </FormActions>
          </Form>
        )}
      </DataBoundary>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab: Work Policy
// ═══════════════════════════════════════════════════════════════════════

type WorkPolicyTabProps = {
  persistedWorkPolicy?: WorkPolicyType | null;
};

function WorkPolicyTab({ persistedWorkPolicy }: WorkPolicyTabProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [workPolicy, setWorkPolicy] = useState<WorkPolicyType>(DEFAULT_WORK_POLICY);

  // Load persisted work policy from system settings (V13 fix).
  useEffect(() => {
    if (persistedWorkPolicy) {
      setWorkPolicy(persistedWorkPolicy);
    }
  }, [persistedWorkPolicy]);

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
          <Text variant="body" color="tertiary">
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
// Tab: Account
// ═══════════════════════════════════════════════════════════════════════

type AccountTabProps = {
  user: ReturnType<typeof useSettingsPage>["user"];
  _: ReturnType<typeof useLingui>["_"];
};

function AccountTab({ user, _ }: AccountTabProps) {
  return (
    <Section>
      <Card>
        <Card.Content>
          <DetailGrid title={_(msg`Account`)}>
            <DetailItem label={_(msg`Username`)}>{user?.sub ?? _(msg`Unknown`)}</DetailItem>
            <DetailItem label={_(msg`Role`)}>{user?.role ?? _(msg`Unknown`)}</DetailItem>
            <DetailItem label={_(msg`Permissions`)}>{user?.permissions ?? _(msg`None`)}</DetailItem>
          </DetailGrid>
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

  return (
    <>
      <PageHeader
        title={_(msg`System`)}
        description={_(msg`System configuration, health status, and account information.`)}
      />

      <Tabs defaultValue="health">
        <Tab value="health">{_(msg`Health`)}</Tab>
        <Tab value="config">{_(msg`Configuration`)}</Tab>
        <Tab value="work-policy">{_(msg`Work Policy`)}</Tab>
        <Tab value="account">{_(msg`Account`)}</Tab>

        <TabPanel value="health">
          <HealthTab
            health={page.health}
            healthLoading={page.healthLoading}
            healthError={page.healthError}
            formatUptime={page.formatUptime}
            refetchHealth={page.refetchHealth}
            _={_}
          />
        </TabPanel>

        <TabPanel value="config">
          <SystemConfigTab
            settingsLoading={page.settingsLoading}
            settingsError={page.settingsError ? new Error("Failed to load settings") : null}
            isSaving={page.isSaving}
            handleSubmit={page.handleSubmit}
            refetchSettings={page.refetchSettings}
            form={page.form}
            _={_}
          />
        </TabPanel>

        <TabPanel value="work-policy">
          <WorkPolicyTab persistedWorkPolicy={page.settingsData?.work_policy ?? null} />
        </TabPanel>

        <TabPanel value="account">
          {page.user && <AccountTab user={page.user} _={_} />}
        </TabPanel>
      </Tabs>
    </>
  );
}
