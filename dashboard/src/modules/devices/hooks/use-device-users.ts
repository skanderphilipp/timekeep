import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  setUserOnDevice,
  deleteUserFromDevice,
  type SetUserRequest,
} from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";

/**
 * Device user enrollment hook.
 *
 * Provides mutations for enrolling and removing users on a device.
 * After any mutation, invalidates the device detail to refetch users.
 */
export function useDeviceUsers(deviceSn: string) {
  const queryClient = useQueryClient();

  const enrollMutation = useMutation({
    mutationFn: (req: SetUserRequest) => setUserOnDevice(deviceSn, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userPin: string) => deleteUserFromDevice(deviceSn, userPin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(deviceSn) });
    },
  });

  return {
    enrollUser: enrollMutation,
    removeUser: removeMutation,
  } as const;
}
