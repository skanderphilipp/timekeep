import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";

import { Button, Spinner, Banner, Section, Text } from "@/components/ui";
import { provisionDevice, type DeviceConfig } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useSidePanelNavigation } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useToast } from "@/infrastructure/toast/toast";
import {
  wizardDeviceConfigAtom,
  resetWizardAtomsAtom,
} from "@/infrastructure/state/atoms/wizard";

import styles from "./device-register-test-step.module.scss";

type DeviceRegisterTestStepProps = {
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
export function DeviceRegisterTestStep({ goBack }: DeviceRegisterTestStepProps) {
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
    <Section className={styles.container}>
      {/* ── Summary of what will be provisioned ─────────────────────────── */}
      <Text as="span" variant="caption" color="secondary" className={styles.summaryHeader}>
        {_(msg`Ready to register the following device:`)}
      </Text>
      <Section className={styles.configSummary}>
        <ConfigRow label={_(msg`Serial`)} value={config.serial_number ?? "—"} />
        <ConfigRow label={_(msg`Label`)} value={config.label ?? config.serial_number ?? "—"} />
        <ConfigRow label={_(msg`Host`)} value={config.host ?? "—"} />
        <ConfigRow label={_(msg`Port`)} value={String(config.port ?? 4370)} />
        <ConfigRow label={_(msg`Comm Key`)} value={String(config.comm_key ?? 0)} />
        <ConfigRow label={_(msg`Push`)} value={config.push_enabled ? _(msg`Enabled`) : _(msg`Disabled`)} />
      </Section>

      {/* ── State: Idle ─────────────────────────────────────────────────── */}
      {state === "idle" && (
        <Button variant="primary" fullWidth onClick={handleProvision}>
          {_(msg`Provision & Test Connection`)}
        </Button>
      )}

      {/* ── State: Provisioning ──────────────────────────────────────────── */}
      {state === "provisioning" && (
        <Section alignment="center" className={styles.centeredSpinner}>
          <Spinner />
          <Text as="span" variant="caption" color="secondary">
            {_(msg`Provisioning device…`)}
          </Text>
        </Section>
      )}

      {/* ── State: Success ──────────────────────────────────────────────── */}
      {state === "success" && result && (
        <Section>
          <Banner variant="success" title={_(msg`Device Registered`)}>
            {_(msg`${result.label ?? result.serial_number} is now connected and active.`)}
          </Banner>
          <div data-slot="test-status-success" className={styles.statusLineSuccess}>
            <IconCircleCheck size={16} />
            <Text as="span" variant="caption" weight="medium" className={styles.statusText}>
              {_(msg`Connection test passed`)}
            </Text>
          </div>
          <div data-slot="test-actions" className={styles.buttonRow}>
            <Button variant="secondary" onClick={goBack}>
              {_(msg`Back`)}
            </Button>
            <Button variant="primary" onClick={handleDone}>
              {_(msg`Done`)}
            </Button>
          </div>
        </Section>
      )}

      {/* ── State: Error ────────────────────────────────────────────────── */}
      {state === "error" && (
        <Section>
          <Banner variant="danger" title={_(msg`Provisioning Failed`)}>
            {errorMsg}
          </Banner>
          <div data-slot="test-status-error" className={styles.statusLineDanger}>
            <IconCircleX size={16} />
            <Text as="span" variant="caption" weight="medium" className={styles.statusText}>
              {_(msg`Connection test failed`)}
            </Text>
          </div>
          <div data-slot="test-actions" className={styles.buttonRow}>
            <Button variant="secondary" onClick={goBack}>
              {_(msg`Back to Configure`)}
            </Button>
            <Button variant="primary" onClick={handleProvision}>
              {_(msg`Retry`)}
            </Button>
          </div>
        </Section>
      )}
    </Section>
  );
}

// ── Config Row Helper ────────────────────────────────────────────────────────

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div data-slot="config-row" className={styles.configRow}>
      <Text as="span" variant="caption" color="tertiary" className={styles.configRowLabel}>
        {label}
      </Text>
      <Text as="span" variant="caption" weight="medium" className={styles.configRowValue}>
        {value}
      </Text>
    </div>
  );
}

DeviceRegisterTestStep.displayName = "DeviceRegisterTestStep";
