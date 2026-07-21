import { useState } from "react";
import { IconRadar, IconPlus, IconCheck } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import { useNetworkScan } from "../hooks/use-network-scan";
import { createDevice } from "@/lib/api";
import type { DiscoveredDevice } from "@/lib/api";
import {
  Dialog,
  Button,
  Spinner,
  Banner,
  TextCell,
  Badge,
  EmptyState,
  Input,
  Text,
  Separator,
} from "@/components/ui";
// oxlint-disable-next-line bentech/require-data-list-view -- scan results table inside a dialog, not a standalone list page
import { DataTable } from "@/components/ui";

type ScanNetworkDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Network scan dialog molecule.
 *
 * Scans the local subnet for ZKTeco devices and displays results
 * in a table with one-click "Add Device" actions per row.
 */
export function ScanNetworkDialog({ open, onClose }: ScanNetworkDialogProps) {
  const { _ } = useLingui();
  const { state, startScan, reset, isScanning } = useNetworkScan();

  const [subnet, setSubnet] = useState("");

  const handleScan = () => {
    startScan(subnet || undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddSingle = async (d: DiscoveredDevice) => {
    if (!d.serial_number || !d.ip_address) return;
    try {
      await createDevice({
        serial_number: d.serial_number,
        label: d.model || d.serial_number,
        host: d.ip_address,
        port: DEFAULT_ZKTECO_PORT,
        comm_key: 0,
        push_enabled: true,
        vendor: "zkteco",
        timezone: null,
      });
      reset();
      onClose();
    } catch {
      // Individual failure — user will see the scan results still visible
    }
  };

  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);

  const handleAddAll = async () => {
    if (state.status !== "done") return;
    const reachable = state.results.devices.filter(
      (d: DiscoveredDevice) => d.reachable && d.serial_number,
    );
    if (reachable.length === 0) return;
    setBulkAdding(true);
    let added = 0;
    for (const d of reachable) {
      try {
        await createDevice({
          serial_number: d.serial_number!,
          label: d.model || d.serial_number!,
          host: d.ip_address!,
          port: DEFAULT_ZKTECO_PORT,
          comm_key: 0,
          push_enabled: true,
          vendor: "zkteco",
          timezone: null,
        });
        added++;
      } catch {
        // Individual failures are tolerated
      }
    }
    setBulkDone(added);
    setBulkAdding(false);
    reset();
  };

  const columns = [
    {
      id: "serial_number",
      header: _(msg`Serial`),
      cell: (d: DiscoveredDevice) => <TextCell text={d.serial_number ?? "\u2014"} />,
    },
    {
      id: "model",
      header: _(msg`Model`),
      cell: (d: DiscoveredDevice) => <TextCell text={d.model ?? "\u2014"} />,
    },
    {
      id: "ip_address",
      header: _(msg`IP`),
      cell: (d: DiscoveredDevice) => <TextCell text={d.ip_address ?? "\u2014"} />,
    },
    {
      id: "vendor",
      header: _(msg`Vendor`),
      cell: (d: DiscoveredDevice) =>
        d.vendor ? <Badge>{d.vendor}</Badge> : <TextCell text={"\u2014"} />,
    },
    {
      id: "add",
      header: "",
      cell: (d: DiscoveredDevice) =>
        d.reachable && d.serial_number ? (
          <Button
            onClick={() => handleAddSingle(d)}
            size="sm"
            variant="secondary"
            icon={<IconPlus size={14} />}
          >
            {_(msg`Add`)}
          </Button>
        ) : null,
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      title={_(msg`Scan Network`)}
    >
      <Text variant="caption" color="tertiary">
        {_(msg`Scan your local network to find ZKTeco attendance scanners.`)}
      </Text>

      <Separator />

      <section style={{ display: "flex", gap: "var(--ao-spacing-3)", alignItems: "flex-end" }}>
        <Input
          label={_(msg`Subnet`)}
          placeholder="192.168.100"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          helperText={_(msg`Leave empty to auto-detect`)}
        />
        <Button onClick={handleScan} loading={isScanning} icon={<IconRadar size={16} />}>
          {_(msg`Start Scan`)}
        </Button>
      </section>

      <Separator />

      {state.status === "scanning" && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--ao-spacing-4)",
            padding: "var(--ao-spacing-8)",
          }}
        >
          <Spinner size="lg" />
          <Text variant="caption" color="tertiary">
            {_(msg`Scanning network… this may take up to 30 seconds.`)}
          </Text>
        </section>
      )}

      {state.status === "error" && (
        <Banner variant="danger" title={_(msg`Scan Failed`)} onDismiss={reset}>
          {state.error}
        </Banner>
      )}

      {state.status === "done" &&
        (state.results.devices_found === 0 ? (
          <EmptyState
            title={_(msg`No devices found`)}
            description={_(
              msg`No ZKTeco devices were discovered on this subnet. Try a different subnet or check network connectivity.`,
            )}
          />
        ) : (
          <>
            <Text variant="caption" color="tertiary">
              {_(msg`Found`)} {state.results.devices_found} {_(msg`device(s) across`)}{" "}
              {state.results.hosts_scanned} {_(msg`hosts on`)} {state.results.subnet}
            </Text>
            {state.results.devices_found > 1 && (
              <Button
                onClick={handleAddAll}
                loading={bulkAdding}
                variant="primary"
                size="sm"
                icon={bulkDone > 0 ? <IconCheck size={14} /> : <IconPlus size={14} />}
              >
                {bulkDone > 0 ? _(msg`Added ${bulkDone} devices`) : _(msg`Add All Discovered`)}
              </Button>
            )}
            <DataTable
              columns={columns}
              data={state.results.devices}
              getRowKey={(d) => d.serial_number ?? d.ip_address ?? ""}
              rowDataSlot="scan-result-row"
            />
          </>
        ))}

      {state.status === "idle" && (
        <EmptyState
          title={_(msg`Ready to scan`)}
          description={_(
            msg`Enter a subnet or leave empty for auto-detect, then click Start Scan.`,
          )}
        />
      )}
    </Dialog>
  );
}
