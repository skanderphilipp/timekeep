import { atom } from "jotai";
import type {
  NetworkScanResponse,
  DiscoveredDevice,
  DeviceConfig,
} from "@/lib/api";

/**
 * Cross-panel wizard atoms for the Device Registration guided flow.
 *
 * These atoms bridge data between wizard steps. They are set by the
 * scan step and consumed by the configure and test steps. They live
 * outside the React tree so they survive remounts when the sub-page
 * router changes the active step component.
 */

/** Result from the network scan (scan step). */
export const wizardScanResultsAtom = atom<NetworkScanResponse | null>(null);

/** The specific discovered device selected by the user (scan step → configure step). */
export const wizardSelectedDeviceAtom = atom<DiscoveredDevice | null>(null);

/** Accumulated device config built up across steps. */
export const wizardDeviceConfigAtom = atom<Partial<DeviceConfig>>({});

/** Reset all wizard atoms to initial state. */
export const resetWizardAtomsAtom = atom(null, (_get, set) => {
  set(wizardScanResultsAtom, null);
  set(wizardSelectedDeviceAtom, null);
  set(wizardDeviceConfigAtom, {});
});
