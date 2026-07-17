import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute, attendanceForDevice, attendanceForUser } from "@/lib/navigation";
import { openSidePanelAtom } from "@/infrastructure/state";
import { selectedDeviceSnState } from "@/modules/devices/states/device-atoms";

/**
 * Navigation hook — type-safe navigation with side panel support.
 *
 * Provides helpers for each navigation pattern in the app:
 * - `toDeviceDetail(sn)` — opens device detail in the side panel
 * - `toDeviceAttendance(sn)` — navigates to attendance list filtered by device
 * - `toUserAttendance(pin)` — navigates to attendance list filtered by user
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
  const setSelectedDevice = useSetAtom(selectedDeviceSnState.atom);

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

  /** Navigate to attendance list filtered to a specific device. */
  const toDeviceAttendance = useCallback(
    (sn: string) => {
      navigate(attendanceForDevice(sn));
    },
    [navigate],
  );

  /** Navigate to attendance list filtered to a specific user. */
  const toUserAttendance = useCallback(
    (pin: string) => {
      navigate(attendanceForUser(pin));
    },
    [navigate],
  );

  return {
    /** Route definitions (for direct use with `<Link to={...}>`). */
    routes: AppRoute,
    toDeviceDetail,
    toDeviceAttendance,
    toUserAttendance,
    /** Raw navigate function for ad-hoc navigation. */
    navigate,
  } as const;
}
