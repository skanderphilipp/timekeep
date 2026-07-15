import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";

import { Button, Spinner, Banner } from "@/components/ui";
import { provisionDevice, type DeviceConfig } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useSidePanelNavigation } } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useToast } from "@/infrastructure/toast/toast";
import {
  wizardDeviceConfigAtom,
  resetWizardAtomsAtom,
} from "@/infrastructure/state/atoms/wizard";

type TestStepProps = {
  /** Push the next step. */
  pushStep: (step: string, title: string, params?: Record<string, unknown>) => void;
  /** Go back to configure step. */
  goBack: () => void;
};

type ProvisionState = "idle" | "provisioning" | "success" | "error";

/**
 * Step 3: Test & Register.
 *
 * Calls `provisionDevice` with the accumulated config from previous steps.
 * Shows a connection test result, then saves the device. On success,
 * invalidates the devices list query and closes the side panel.
 */
export function DeviceRegisterTestStep({ goBack }: TestStepProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { close } = useSidePanelNavigation();

  const config = useAtomValue(wizardDeviceConfigAtom);
  const resetWizard = useSetAtom(resetWizardAtomsAtom);

  const [state, setState] = useState<ProvisionState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<DeviceConfig | null>(null);

  const handleProvision = useCallback(async () => {
    if (!config.host || !config.serial_number) {
      setErrorMsg(_(msg`Missing device configuration. Go back and fill in all fields.`));
      setState("error");
      return;
    }

    setState("provisioning");
    setErrorMsg(null);

    try {
      const device = await provisionDevice(config as DeviceConfig);
      setResult(device);
      setState("success");
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
      toast.success(_(msg`Device registered successfully.`));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : _(msg`Failed to provision device. Check the connection and try again.`));
      setState("error");
    }
  }, [config, queryClient, toast, _]);

  const handleDone = useCallback(() => {
    resetWizard();
    close();
  }, [resetWizard, close]);

  return (
    <div style={{ padding: "var(--ao-spacing-4)" }}>
      {/* ── Summary of what will be provisioned ─────────────────────────── */}
      <div style={{ marginBottom: "var(--ao-spacing-4)" }}>
        <p style={{
          color: "var(--ao-font-color-secondary)",
          fontSize: "var(--ao-font-size-sm)",
          margin: "0 0 var(--ao-spacing-2)",
        }}>
          {_(msg`Ready to register the following device:`)}
        </p>
        <div style={{
          background: "var(--ao-background-secondary)",
          borderRadius: "var(--ao-radius-md)",
          fontSize: "var(--ao-font-size-sm)",
          padding: "var(--ao-spacing-3)",
        }}>
          <ConfigRow label={_(msg`Serial`)} value={config.serial_number ?? "—"} />
          <ConfigRow label={_(msg`Label`)} value={config.label ?? config.serial_number ?? "—"} />
          <ConfigRow label={_(msg`Host`)} value={config.host ?? "—"} />
          <ConfigRow label={_(msg`Port`)} value={String(config.port ?? 4370)} />
          <ConfigRow label={_(msg`Comm Key`)} value={String(config.comm_key ?? 0)} />
          <ConfigRow label={_(msg`Push`)} value={config.push_enabled ? _(msg`Enabled`) : _(msg`Disabled`)} isLast />
        </div>
      </div>

      {/* ── State: Idle / Provisioning ──────────────────────────────────── */}
      {state === "idle" && (
        <Button variant="primary" fullWidth onClick={handleProvision}>
          {_(msg`Provision & Test Connection`)}
        </Button>
      )}

      {state === "provisioning" && (
        <div style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ao-spacing-3)",
          padding: "var(--ao-spacing-6) 0",
        }}>
          <Spinner />
          <p style={{
            color: "var(--ao-font-color-secondary)",
            fontSize: "var(--ao-font-size-sm)",
          }}>
            {_(msg`Provisioning device…`)}
          </p>
        </div>
      )}

      {/* ── State: Success ──────────────────────────────────────────────── */}
      {state === "success" && result && (
        <div>
          <Banner variant="success" title={_(msg`Device Registered`)}>
            {_(msg`${result.label ?? result.serial_number} is now connected and active.`)}
          </Banner>
          <div style={{
            alignItems: "center",
            color: "var(--ao-status-color-success, #22c55e)",
            display: "flex",
            gap: "var(--ao-spacing-2)",
            marginTop: "var(--ao-spacing-3)",
          }}>
            <IconCircleCheck size={16} />
            <span style={{ fontSize: "var(--ao-font-size-sm)", fontWeight: "var(--ao-font-weight-medium)" }}>
              {_(msg`Connection test passed`)}
            </span>
          </div>
          <div style={{ marginTop: "var(--ao-spacing-4)", display: "flex", gap: "var(--ao-spacing-2)" }}>
            <Button variant="secondary" onClick={goBack}>
              {_(msg`Back`)}
            </Button>
            <Button variant="primary" onClick={handleDone}>
              {_(msg`Done`)}
            </Button>
          </div>
        </div>
      )}

      {/* ── State: Error ────────────────────────────────────────────────── */}
      {state === "error" && (
        <div>
          <Banner variant="danger" title={_(msg`Provisioning Failed`)}>
            {errorMsg}
          </Banner>
          <div style={{
            alignItems: "center",
            color: "var(--ao-status-color-danger, #ef4444)",
            display: "flex",
            gap: "var(--ao-spacing-2)",
            marginTop: "var(--ao-spacing-3)",
          }}>
            <IconCircleX size={16} />
            <span style={{ fontSize: "var(--ao-font-size-sm)", fontWeight: "var(--ao-font-weight-medium)" }}>
              {_(msg`Connection test failed`)}
            </span>
          </div>
          <div style={{ marginTop: "var(--ao-spacing-4)", display: "flex", gap: "var(--ao-spacing-2)" }}>
            <Button variant="secondary" onClick={goBack}>
              {_(msg`Back to Configure`)}
            </Button>
            <Button variant="primary" onClick={handleProvision}>
              {_(msg`Retry`)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Config Row Helper ────────────────────────────────────────────────────────

function ConfigRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div style={{
      alignItems: "center",
      borderBottom: isLast ? "none" : "1px solid var(--ao-border-color-light)",
      display: "flex",
      gap: "var(--ao-spacing-2)",
      padding: "var(--ao-spacing-1) 0",
    }}>
      <span style={{
        color: "var(--ao-font-color-tertiary)",
        flexShrink: 0,
        minWidth: 60,
      }}>
        {label}
      </span>
      <span style={{ fontWeight: "var(--ao-font-weight-medium)" }}>
        {value}
      </span>
    </div>
  );
}

DeviceRegisterTestStep.displayName = "DeviceRegisterTestStep";
