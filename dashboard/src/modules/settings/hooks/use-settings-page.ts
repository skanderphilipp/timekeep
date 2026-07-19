import { useSystemSettings } from "./use-system-settings";
import { useSystemHealth } from "./use-system-health";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";

/**
 * Settings page orchestration hook.
 *
 * Composes the two independent queries (system health + system settings)
 * into a single consumable return for the settings view. Error coordination
 * (when both queries fail simultaneously) is handled centrally by `<PageShell>`
 * — this hook does NOT need to manage that.
 */
export function useSettingsPage() {
  const user = useCurrentUser();
  const {
    form,
    settingsData,
    isLoading: settingsLoading,
    isSaving,
    error: settingsError,
    refetch: refetchSettings,
    handleSubmit,
  } = useSystemSettings();
  const {
    health,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
    formatUptime,
  } = useSystemHealth();

  return {
    user,
    health,
    healthLoading,
    healthError,
    settingsData,
    settingsLoading,
    settingsError,
    isSaving,
    form,
    formatUptime,
    handleSubmit,
    refetchHealth,
    refetchSettings,
  } as const;
}
