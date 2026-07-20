import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { AppRoute } from "@/lib/navigation";
import { useSidePanelNavigation } from "./use-side-panel-navigation";
import type { EntityType } from "@/types/entities";

/**
 * Maps an entity type + ID to the full-page AppRoute, or null if
 * no main-view page exists for that entity type yet.
 */
function resolveMainViewRoute(
	entityType: EntityType,
	entityId: string,
): string | null {
	switch (entityType) {
		case "device":
			return AppRoute.devices.detail(entityId);
		case "employee":
		case "user":
			return AppRoute.employees.detail(entityId);
		case "department":
			return AppRoute.departments.detail(entityId);
		default:
			return null;
	}
}

/**
 * Hook that provides an "open in main view" function for the side panel.
 *
 * Navigates the browser to the full-page URL for the current entity
 * and closes the side panel. Analogous to
 * `RecordShowSidePanelOpenRecordButton`.
 *
 * @returns `openInMainView` — call to navigate to the full-page view
 * @returns `canOpenInMainView` — whether the current entity has a main-view page
 *
 * @example
 * ```tsx
 * const { openInMainView, canOpenInMainView } = useOpenInMainView();
 * if (canOpenInMainView) {
 *   return <Button onClick={openInMainView}>Open in Main View</Button>;
 * }
 * ```
 */
export function useOpenInMainView() {
	const navigate = useNavigate();
	const { activeEntry, close } = useSidePanelNavigation();

	const canOpenInMainView =
		activeEntry !== null &&
		resolveMainViewRoute(activeEntry.entityType, activeEntry.entityId) !== null;

	const openInMainView = useCallback(() => {
		if (!activeEntry) return;

		const route = resolveMainViewRoute(
			activeEntry.entityType,
			activeEntry.entityId,
		);
		if (!route) return;

		// Navigate the main router first, then close the side panel.
		// Order matters: if we close first, the component unmounts before navigate fires.
		navigate(route);
		close();
	}, [activeEntry, navigate, close]);

	return { openInMainView, canOpenInMainView } as const;
}
