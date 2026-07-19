/**
 * @deprecated Use {@link getDeviceDetailContent} from `./device-detail-auto-content` instead.
 *
 * The device detail rendering is now auto-injected by RecordDetailRenderer
 * via `getDeviceDetailContent()` in `device-detail-auto-content.tsx`.
 *
 * All tab content (Overview, Users, Config, Activity) and the status bar
 * are composed there. The old monolithic `DeviceDetailExtras` component
 * has been split into focused tab-specific components.
 *
 * Kept as a re-export for backward compatibility with any external code
 * that may still import these symbols. No known consumers as of 2026-07.
 */
export { getDeviceDetailContent as DeviceDetailContent } from "./device-detail-auto-content";
export type { DeviceActivityEvent } from "./device-detail-auto-content";
