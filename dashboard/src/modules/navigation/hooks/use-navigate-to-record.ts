import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute, punchesForDevice, punchesForUser } from "@/lib/navigation";
import { openSidePanelAtom } from "@/infrastructure/state";
import { selectedDeviceSnAtom } from "@/modules/devices/states/device-atoms";

/**
 * Navigation hook — type-safe navigation with side panel support.
 *
 * Provides helpers for each navigation pattern in the app:
 * - `toDeviceDetail(sn)` — opens device detail in the side panel
 * - `toDevicePunches(sn)` — navigates to punch list filtered by device
 * - `toUserPunches(pin)` — navigates to punch list filtered by user
 * - And direct route access via `routes`
 *
 * @example
 * ```tsx
 * const nav = useNavigateToRecord();
 * nav.toDeviceDetail("CQZ7232960836"); // opens side panel
 * ```
 */
export function useNavigateToRecord() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const openSidePanel = useSetAtom(openSidePanelAtom);
  const setSelectedDevice = useSetAtom(selectedDeviceSnAtom);

  /** Open device detail in the side panel. */
  const toDeviceDetail = useCallback(
    (sn: string) => {
      setSelectedDevice(sn);
      openSidePanel({
        title: _(msg`Device ${sn}`),
        render: () => null, // TODO: import and render DeviceDetailPanel
      });
    },
    [openSidePanel, setSelectedDevice],
  );

  /** Navigate to punch list filtered to a specific device. */
  const toDevicePunches = useCallback(
    (sn: string) => {
      navigate(punchesForDevice(sn));
    },
    [navigate],
  );

  /** Navigate to punch list filtered to a specific user. */
  const toUserPunches = useCallback(
    (pin: string) => {
      navigate(punchesForUser(pin));
    },
    [navigate],
  );

  return {
    /** Route definitions (for direct use with `<Link to={...}>`). */
    routes: AppRoute,
    toDeviceDetail,
    toDevicePunches,
    toUserPunches,
    /** Raw navigate function for ad-hoc navigation. */
    navigate,
  } as const;
}
