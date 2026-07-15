import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deleteDevice } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { AppRoute } from "@/lib/navigation";

/**
 * Delete a device. Invalidates device list + detail queries.
 */
export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (sn: string) => deleteDevice(sn),
    onSuccess: (_data, sn) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.detail(sn) });
      // Navigate back to device list
      navigate(AppRoute.devices.list);
    },
  });
}
