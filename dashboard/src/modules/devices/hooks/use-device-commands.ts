import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueDeviceCommand, type EnqueueCommandRequest } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device command mutation hook.
 *
 * Enqueues a command (REBOOT, CLEAR_ATTENDANCE, etc.) for a device
 * via the ADMS push mechanism.
 */
export function useDeviceCommands(deviceSn: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (cmd: EnqueueCommandRequest) => enqueueDeviceCommand(deviceSn, cmd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    },
  });

  return {
    sendCommand: mutation,
  } as const;
}
