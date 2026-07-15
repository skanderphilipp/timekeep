import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useSetAtom } from "jotai";
import { IconSearch, IconArrowRight } from "@tabler/icons-react";

import { Button, Input, Banner, Spinner, Section } from "@/components/ui";
import { useSidePanelSubPage } from "@/infrastructure/side-panel/hooks/use-side-panel-sub-page";
import { scanNetwork, type DiscoveredDevice } from "@/lib/api";
import {
  wizardScanResultsAtom,
  wizardSelectedDeviceAtom,
} from "@/infrastructure/state/atoms/wizard";

type ScanStepProps = {
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
export function DeviceRegisterScanStep({ onClose: _onClose }: ScanStepProps) {
  const { _ } = useLingui();
  const { pushStep } = useSidePanelSubPage();

  const setScanResults = useSetAtom(wizardScanResultsAtom);
  const setSelectedDevice = useSetAtom(wizardSelectedDeviceAtom);

  const [subnet, setSubnet] = useState("192.168.1.0/24");
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
      <div style={{ marginBottom: "var(--ao-spacing-4)" }}>
        <Input
          value={subnet}
          onChange={(e) => setSubnet((e.target as HTMLInputElement).value)}
          placeholder={_(msg`192.168.1.0/24`)}
        />
      </div>

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

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ marginTop: "var(--ao-spacing-3)" }}>
          <Banner variant="danger">{error}</Banner>
        </div>
      )}

      {/* ── Scanning spinner ────────────────────────────────────────────── */}
      {scanning && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          padding: "var(--ao-spacing-6) 0",
        }}>
          <Spinner />
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {results && !scanning && (
        <div style={{ marginTop: "var(--ao-spacing-4)" }}>
          {results.length === 0 ? (
            <Banner variant="neutral">
              {_(msg`No ZKTeco devices found on this subnet.`)}
            </Banner>
          ) : (
            <>
              <p style={{
                color: "var(--ao-font-color-secondary)",
                fontSize: "var(--ao-font-size-sm)",
                marginBottom: "var(--ao-spacing-2)",
              }}>
                {_(msg`Found ${results.length} device(s). Select one to configure.`)}
              </p>
              <div style={{
                border: "1px solid var(--ao-border-color-light)",
                borderRadius: "var(--ao-radius-md)",
                overflow: "hidden",
              }}>
                {results.map((device, idx) => (
                  <DeviceRow
                    key={device.ip_address ?? idx}
                    device={device}
                    onSelect={handleSelectDevice}
                    isLast={idx === results.length - 1}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

// ── Device Row ────────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  onSelect,
  isLast,
}: {
  device: DiscoveredDevice;
  onSelect: (d: DiscoveredDevice) => void;
  isLast: boolean;
}) {
  const { _ } = useLingui();

  const reachable = device.reachable;
  const label = device.serial_number ?? device.ip_address ?? _(msg`Unknown`);

  return (
    <div
      style={{
        alignItems: "center",
        borderBottom: isLast ? "none" : "1px solid var(--ao-border-color-light)",
        cursor: "pointer",
        display: "flex",
        gap: "var(--ao-spacing-3)",
        padding: "var(--ao-spacing-3)",
        transition: "background 150ms ease",
      }}
      onClick={() => onSelect(device)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(device);
      }}
      role="button"
      tabIndex={0}
    >
      {/* Status dot */}
      <span
        style={{
          backgroundColor: reachable
            ? "var(--ao-status-color-success, #22c55e)"
            : "var(--ao-font-color-tertiary, #94a3b8)",
          borderRadius: "50%",
          display: "inline-block",
          flexShrink: 0,
          height: 8,
          width: 8,
        }}
      />

      {/* Device info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--ao-font-size-sm)",
          fontWeight: "var(--ao-font-weight-medium)",
        }}>
          {label}
        </div>
        <div style={{
          color: "var(--ao-font-color-tertiary)",
          fontSize: "var(--ao-font-size-xs)",
        }}>
          {device.ip_address && `${device.ip_address}`}
          {device.model && ` — ${device.model}`}
          {!reachable && ` — ${_(msg`unreachable`)}`}
        </div>
      </div>

      <IconArrowRight
        size={14}
        style={{ color: "var(--ao-font-color-tertiary)", flexShrink: 0 }}
      />
    </div>
  );
}

DeviceRegisterScanStep.displayName = "DeviceRegisterScanStep";
