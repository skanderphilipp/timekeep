import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  PageLayout,
  PageBody,
  PageHeader,
  Card,
  Form,
  FormActions,
  Button,
  Spinner,
  SchemaForm,
  DetailGrid,
  DetailItem,
  StatusDot,
} from "@/components/ui";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";
import { useSystemSettings } from "../hooks/use-system-settings";
import { useSystemHealth } from "../hooks/use-system-health";
import { createSystemSettingsFormDef } from "../schemas/settings-form.schema";

// ═══════════════════════════════════════════════════════════════════════
// Health status helpers
// ═══════════════════════════════════════════════════════════════════════

/** Map a status string to a StatusDot variant. */
function statusVariant(status: string): "online" | "offline" | "warning" {
  if (status === "healthy" || status === "connected") return "online";
  if (status === "degraded") return "warning";
  return "offline";
}

function StatusBadge({ status }: { status: string }) {
  const { _ } = useLingui();
  const label =
    status === "healthy"
      ? _(msg`Healthy`)
      : status === "degraded"
        ? _(msg`Degraded`)
        : status === "connected"
          ? _(msg`Connected`)
          : _(msg`Error`);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ao-space-xs)" }}>
      <StatusDot status={statusVariant(status)} />
      <span>{label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export function SettingsPage() {
  const { _ } = useLingui();
  const user = useCurrentUser();
  const { form, isLoading: settingsLoading, isSaving, handleSubmit } = useSystemSettings();
  const { health, isLoading: healthLoading, formatUptime } = useSystemHealth();

  const formSchema = createSystemSettingsFormDef(_);

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`System`)}
          description={_(msg`System configuration, health status, and account information.`)}
        />

        {/* ── System Health ─────────────────────────────────────── */}
        {healthLoading ? (
          <Spinner />
        ) : health ? (
          <Card>
            <Card.Content>
              <DetailGrid title={_(msg`System Health`)}>
                <DetailItem label={_(msg`Status`)}>
                  <StatusBadge status={health.status} />
                </DetailItem>
                <DetailItem label={_(msg`Version`)}>
                  v{health.version}
                </DetailItem>
                <DetailItem label={_(msg`Database`)}>
                  <StatusBadge status={health.db} />
                </DetailItem>
                <DetailItem label={_(msg`Uptime`)}>
                  {formatUptime(health.uptime_seconds)}
                </DetailItem>
              </DetailGrid>
            </Card.Content>
          </Card>
        ) : null}

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
                    <span
                      style={{
                        display: "inline-flex",
                        gap: "var(--ao-space-md)",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {d.adms_active ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ao-space-xs)" }}>
                          <StatusDot status="online" />
                          <span style={{ fontSize: "var(--ao-font-size-sm)" }}>ADMS</span>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ao-space-xs)", opacity: 0.5 }}>
                          <StatusDot status="offline" />
                          <span style={{ fontSize: "var(--ao-font-size-sm)" }}>ADMS</span>
                        </span>
                      )}
                      {d.sdk_active ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ao-space-xs)" }}>
                          <StatusDot status="online" />
                          <span style={{ fontSize: "var(--ao-font-size-sm)" }}>SDK</span>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--ao-space-xs)", opacity: 0.5 }}>
                          <StatusDot status="offline" />
                          <span style={{ fontSize: "var(--ao-font-size-sm)" }}>SDK</span>
                        </span>
                      )}
                      {d.last_seen_secs_ago != null && (
                        <span style={{ fontSize: "var(--ao-font-size-sm)", opacity: 0.6 }}>
                          {_(msg`Last seen`)}: {d.last_seen_secs_ago}s ago
                        </span>
                      )}
                    </span>
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
                    <span
                      style={{
                        display: "inline-flex",
                        gap: "var(--ao-space-md)",
                        fontSize: "var(--ao-font-size-sm)",
                      }}
                    >
                      <span style={{ color: "var(--ao-color-success)" }}>
                        {d.delivered} {_(msg`delivered`)}
                      </span>
                      {d.queued > 0 && (
                        <span style={{ color: "var(--ao-color-warning)" }}>
                          {d.queued} {_(msg`queued`)}
                        </span>
                      )}
                      {d.dead > 0 && (
                        <span style={{ color: "var(--ao-color-error)" }}>
                          {d.dead} {_(msg`dead`)}
                        </span>
                      )}
                    </span>
                  </DetailItem>
                ))}
              </DetailGrid>
            </Card.Content>
          </Card>
        ) : null}

        {/* ── Settings Form ─────────────────────────────────────── */}
        {settingsLoading ? (
          <Spinner />
        ) : (
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
                <DetailItem label={_(msg`Username`)}>
                  {user.sub ?? _(msg`Unknown`)}
                </DetailItem>
                <DetailItem label={_(msg`Role`)}>
                  {user.role ?? _(msg`Unknown`)}
                </DetailItem>
                <DetailItem label={_(msg`Permissions`)}>
                  {user.permissions ?? _(msg`None`)}
                </DetailItem>
              </DetailGrid>
            </Card.Content>
          </Card>
        )}
      </PageBody>
    </PageLayout>
  );
}
