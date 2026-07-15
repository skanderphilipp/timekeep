import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { scanNetwork, type NetworkScanResponse, type ScanNetworkRequest } from "@/lib/api";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; results: NetworkScanResponse }
  | { status: "error"; error: string };

/**
 * Network scan orchestration hook.
 *
 * Calls `POST /api/devices/scan` and exposes the scan lifecycle
 * (idle → scanning → done/error) for a dialog or inline view.
 *
 * The subnet defaults to the current page origin's /24 network,
 * but can be overridden by the caller.
 */
export function useNetworkScan() {
  const [state, setState] = useState<ScanState>({ status: "idle" });

  const scanMutation = useMutation({
    mutationFn: (body: ScanNetworkRequest) => scanNetwork(body),
    onMutate: () => {
      setState({ status: "scanning" });
    },
    onSuccess: (data) => {
      setState({ status: "done", results: data });
    },
    onError: (err: Error) => {
      setState({ status: "error", error: err.message });
    },
  });

  const startScan = useCallback(
    (subnet?: string) => {
      scanMutation.mutate({ subnet });
    },
    [scanMutation],
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
    scanMutation.reset();
  }, [scanMutation]);

  return {
    state,
    startScan,
    reset,
    isScanning: scanMutation.isPending,
  } as const;
}
