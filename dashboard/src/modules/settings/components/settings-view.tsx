import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  PageHeader,
  Card,
  Form,
  FormActions,
  Button,
  Spinner,
  SchemaForm,
  DetailGrid,
  DetailItem,
  StatusBadge,
  Text,
  PageError,
} from "@/components/ui";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";
import { useSystemSettings } from "../hooks/use-system-settings";
import { useSystemHealth } from "../hooks/use-system-health";
import { createSystemSettingsFormDef } from "../schemas/settings-form.schema";

// ═══════════════════════════════════════════════════════════════════════
// Health status helpers
// ═══════════════════════════════════════════════════════════════════════

/** Map a health status string to a StatusBadge status. */
function healthStatus(status: string): "online" | "offline" | "warning" {
  if (status === "healthy" || status === "connected") return "online";
  if (status === "degraded") return "warning";
  return "offline";
}

function healthLabel(status: string, _: ReturnType<typeof useLingui>["_"]): string {
  switch (status) {
    case "healthy":
      return _(msg`Healthy`);
    case "degraded":
      return _(msg`Degraded`);
    case "connected":
      return _(msg`Connected`);
    default:
      return _(msg`Error`);
  }
}

/** Protocol indicator row for a single device protocol (ADMS or SDK). */
function ProtocolIndicator({ active, label }: { active: boolean; label: string }) {
  return <StatusBadge status={active ? "online" : "offline"} label={label} active={active} />;
}

// ═══════════════════════════════════════════════════════════════════════
// View
// ═══════════════════════════════════════════════════════════════════════

/**
 * Settings view — system health, engine pipeline, settings form, account.
 *
 * Owns all page state; the page composes this inside PageLayout.
 */
export function SettingsView() {
  const { _ } = useLingui();
  const user = useCurrentUser();
  const {
    form,
    isLoading: settingsLoading,
    isSaving,
    error: settingsError,
    refetch: refetchSettings,
    handleSubmit,
  } = useSystemSettings();
  const {
    health,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
    formatUptime,
  } = useSystemHealth();

  const formSchema = createSystemSettingsFormDef(_);

  return (
    <>
      <PageHeader
        title={_(msg`System`)}
        description={_(msg`System configuration, health status, and account information.`)}
      />

      {/* ── System Health ─────────────────────────────────────── */}
      {healthError && <PageError onRetry={() => refetchHealth()} />}

      {!healthError && healthLoading && <Spinner />}

      {!healthError && !healthLoading && health && (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`System Health`)}>
              <DetailItem label={_(msg`Status`)}>
                <StatusBadge
                  status={healthStatus(health.status)}
                  label={healthLabel(health.status, _)}
                />
              </DetailItem>
              <DetailItem label={_(msg`Version`)}>v{health.version}</DetailItem>
              <DetailItem label={_(msg`Database`)}>
                <StatusBadge status={healthStatus(health.db)} label={healthLabel(health.db, _)} />
              </DetailItem>
              <DetailItem label={_(msg`Uptime`)}>{formatUptime(health.uptime_seconds)}</DetailItem>
            </DetailGrid>
          </Card.Content>
        </Card>
      )}

      {/* ── Engine Pipeline ───────────────────────────────────── */}
      {health?.engine ? (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Engine Pipeline`)}>
              <DetailItem label={_(msg`Events Processed`)}>
                {health.engine.events_processed.toLocaleString()}
              </DetailItem>
              <DetailItem label={_(msg`Events Dropped`)}>
                {health.engine.events_dropped.toLocaleString()}
              </DetailItem>
              <DetailItem label={_(msg`Events Distributed`)}>
                {health.engine.events_distributed.toLocaleString()}
              </DetailItem>
              <DetailItem label={_(msg`Events Failed`)}>
                {health.engine.events_failed.toLocaleString()}
              </DetailItem>
            </DetailGrid>
          </Card.Content>
        </Card>
      ) : null}

      {/* ── Devices ───────────────────────────────────────────── */}
      {health?.devices && health.devices.length > 0 ? (
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
      ) : null}

      {/* ── Distributors ──────────────────────────────────────── */}
      {health?.distributors && health.distributors.length > 0 ? (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Distributors`)}>
              {health.distributors.map((d) => (
                <DetailItem key={d.name} label={d.name}>
                  <Text as="span" variant="caption" color="success">
                    {d.delivered} {_(msg`delivered`)}
                  </Text>
                  {d.queued > 0 && (
                    <Text as="span" variant="caption" color="warning">
                      {" · "}
                      {d.queued} {_(msg`queued`)}
                    </Text>
                  )}
                  {d.dead > 0 && (
                    <Text as="span" variant="caption" color="danger">
                      {" · "}
                      {d.dead} {_(msg`dead`)}
                    </Text>
                  )}
                </DetailItem>
              ))}
            </DetailGrid>
          </Card.Content>
        </Card>
      ) : null}

      {/* ── Settings Form ─────────────────────────────────────── */}
      {settingsError && <PageError onRetry={() => refetchSettings()} />}

      {!settingsError && settingsLoading && <Spinner />}

      {!settingsError && !settingsLoading && (
        <Form onSubmit={handleSubmit}>
          <SchemaForm formSchema={formSchema} form={form} />
          <FormActions>
            <Button type="submit" loading={isSaving}>
              {_(msg`Save`)}
            </Button>
          </FormActions>
        </Form>
      )}

      {/* ── Account ───────────────────────────────────────────── */}
      {user && (
        <Card>
          <Card.Content>
            <DetailGrid title={_(msg`Account`)}>
              <DetailItem label={_(msg`Username`)}>{user.sub ?? _(msg`Unknown`)}</DetailItem>
              <DetailItem label={_(msg`Role`)}>{user.role ?? _(msg`Unknown`)}</DetailItem>
              <DetailItem label={_(msg`Permissions`)}>
                {user.permissions ?? _(msg`None`)}
              </DetailItem>
            </DetailGrid>
          </Card.Content>
        </Card>
      )}
    </>
  );
}
