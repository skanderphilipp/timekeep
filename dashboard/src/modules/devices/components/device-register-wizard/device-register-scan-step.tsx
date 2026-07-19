import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useSetAtom } from "jotai";
import { IconSearch, IconArrowRight, IconPencil } from "@tabler/icons-react";

import { Button, Input, Banner, Spinner, Section, StatusDot, Text } from "@/components/ui";
import { useSidePanelSubPage } from "@/infrastructure/side-panel/hooks/use-side-panel-sub-page";
import { scanNetwork, type DiscoveredDevice } from "@/lib/api";
import {
  wizardScanResultsAtom,
  wizardSelectedDeviceAtom,
} from "@/infrastructure/state/atoms/wizard";

import styles from "./device-register-scan-step.module.scss";

type DeviceRegisterScanStepProps = {
  /** Called when the user cancels the wizard entirely. */
  onClose: () => void;
};

/**
 * Step 1: Network Scan.
 *
 * The user enters a subnet (e.g., "192.168.1.0/24"), clicks scan,
 * and selects a discovered ZKTeco device from the results table.
 * Selected device data is stored in {@link wizardSelectedDeviceAtom}
 * for the next step.
 */
export function DeviceRegisterScanStep({ onClose: _onClose }: DeviceRegisterScanStepProps) {
  const { _ } = useLingui();
  const { pushStep } = useSidePanelSubPage();

  const setScanResults = useSetAtom(wizardScanResultsAtom);
  const setSelectedDevice = useSetAtom(wizardSelectedDeviceAtom);

  const [subnet, setSubnet] = useState("192.168.100");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveredDevice[] | null>(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const response = await scanNetwork({ subnet: subnet || undefined });
      setResults(response.devices);
      setScanResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : _(msg`Scan failed. Check the subnet and try again.`));
      setResults(null);
    } finally {
      setScanning(false);
    }
  }, [subnet, setScanResults, _]);

  const handleSelectDevice = useCallback(
    (device: DiscoveredDevice) => {
      setSelectedDevice(device);
      pushStep(
        "configure",
        _(msg`Configure Device`),
        { ip: device.ip_address ?? "", serial: device.serial_number ?? "" }
      );
    },
    [setSelectedDevice, pushStep, _],
  );

  return (
    <Section>
      {/* ── Subnet Input ────────────────────────────────────────────────── */}
      <Input
        className={styles.inputWrapper}
        value={subnet}
        onChange={(e) => setSubnet((e.target as HTMLInputElement).value)}
        placeholder={_(msg`192.168.100`)}
      />

      {/* ── Scan Button ─────────────────────────────────────────────────── */}
      <Button
        variant="primary"
        fullWidth
        onClick={handleScan}
        disabled={scanning || !subnet.trim()}
        icon={scanning ? undefined : <IconSearch size={16} />}
        loading={scanning}
      >
        {scanning ? _(msg`Scanning…`) : _(msg`Scan Network`)}
      </Button>

      {/* ── Register Manually ──────────────────────────────────────────── */}
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          setSelectedDevice(null);
          pushStep("configure", _(msg`Configure Device`));
        }}
        icon={<IconPencil size={16} />}
      >
        {_(msg`Register Manually`)}
      </Button>

      {!scanning && !results && !error && (
        <Banner variant="neutral">
          {_(msg`Enter a subnet like "192.168.100" and click Scan, or use Register Manually to enter device details directly.`)}
        </Banner>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && <Banner className={styles.errorWrapper} variant="danger">{error}</Banner>}

      {/* ── Scanning spinner ────────────────────────────────────────────── */}
      {scanning && (
        <Section alignment="center" className={styles.spinnerWrapper}>
          <Spinner />
        </Section>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {results && !scanning && (
        <Section className={styles.resultsContainer}>
          {results.length === 0 ? (
            <Banner variant="neutral">
              {_(msg`No ZKTeco devices found on this subnet.`)}
            </Banner>
          ) : (
            <>
              <Text as="span" variant="caption" color="secondary">
                {_(msg`Found ${results.length} device(s). Select one to configure.`)}
              </Text>
              <Section className={styles.resultsList}>
                {results.map((device, idx) => (
                  <DeviceRow
                    key={device.ip_address ?? idx}
                    device={device}
                    onSelect={handleSelectDevice}
                  />
                ))}
              </Section>
            </>
          )}
        </Section>
      )}
    </Section>
  );
}

// ── Device Row ────────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  onSelect,
}: {
  device: DiscoveredDevice;
  onSelect: (d: DiscoveredDevice) => void;
}) {
  const { _ } = useLingui();

  const reachable = device.reachable;
  const label = device.serial_number ?? device.ip_address ?? _(msg`Unknown`);

  return (
    <div
      data-slot="device-row"
      className={styles.deviceRow}
      onClick={() => onSelect(device)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(device);
      }}
      role="button"
      tabIndex={0}
    >
      <StatusDot status={reachable ? "online" : "offline"} size="sm" />

      <div data-slot="device-row-info" className={styles.deviceInfo}>
        <Text as="span" variant="caption" weight="medium" className={styles.deviceLabel}>
          {label}
        </Text>
        <Text as="span" variant="caption" color="tertiary" className={styles.deviceMeta}>
          {device.ip_address && `${device.ip_address}`}
          {device.model && ` — ${device.model}`}
          {!reachable && ` — ${_(msg`unreachable`)}`}
        </Text>
      </div>

      <IconArrowRight size={14} className={styles.arrowIcon} />
    </div>
  );
}

DeviceRegisterScanStep.displayName = "DeviceRegisterScanStep";
