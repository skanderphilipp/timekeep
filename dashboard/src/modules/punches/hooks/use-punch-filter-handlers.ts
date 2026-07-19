import { useCallback } from "react";

import { toDateString } from "@/lib/date";

type FilterPatch = Record<string, unknown>;

/**
 * Simple change handlers for the punch filter bar controls.
 */
export function usePunchFilterHandlers(
	handleFilterChange: (patch: FilterPatch) => void,
	setDeviceSns: (sns: string[]) => void,
) {
	const handleDateChange = useCallback(
		(from: Date | null, to: Date | null | undefined) => {
			handleFilterChange({
				since: from ? toDateString(from) : undefined,
				until: to ? toDateString(to) : undefined,
			});
		},
		[handleFilterChange],
	);

	/**
	 * Unified search across employee name + PIN.
	 *
	 * Digit-only input → exact PIN match (`user_pins`).
	 * Text input → full-text search (`search`).
	 *
	 * The two params are mutually exclusive — setting one clears the other.
	 */
	const handleSearchChange = useCallback(
		(v: string) => {
			if (!v) {
				handleFilterChange({ user_pins: undefined, search: undefined });
			} else if (/^\d+$/.test(v)) {
				// Pure digits → exact PIN match
				handleFilterChange({ user_pins: [v], search: undefined });
			} else {
				// Text → full-text search
				handleFilterChange({ search: v, user_pins: undefined });
			}
		},
		[handleFilterChange],
	);

	/** Single device select (legacy; maps to device_sns array). */
	const handleDeviceChange = useCallback(
		(v: string) => {
			handleFilterChange({ device_sn: v || undefined });
			setDeviceSns(v ? [v] : []);
		},
		[handleFilterChange, setDeviceSns],
	);

	const handleStatusChange = useCallback(
		(v: string) => handleFilterChange({ status: v || undefined }),
		[handleFilterChange],
	);

	const handleVerifyModeChange = useCallback(
		(v: string) => handleFilterChange({ verify_mode: v || undefined }),
		[handleFilterChange],
	);

	const handleAnomaliesOnlyToggle = useCallback(
		(checked: boolean) => handleFilterChange({ anomalies_only: checked ? "true" : undefined }),
		[handleFilterChange],
	);

	return {
		handleDateChange,
		handleSearchChange,
		handleDeviceChange,
		handleStatusChange,
		handleVerifyModeChange,
		handleAnomaliesOnlyToggle,
	};
}
