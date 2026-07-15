import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { syncEmployeeToDevices } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useToast } from "@/infrastructure/toast/toast";

/**
 * Hook for syncing an employee to all enrolled devices.
 *
 * On success, invalidates employee and device queries so the UI
 * reflects the updated sync status immediately.
 */
export function useEmployeeSync(employeeId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { _ } = useLingui();

  return useMutation({
    mutationFn: () => syncEmployeeToDevices(employeeId),
    onSuccess: () => {
      toast.success(_(msg`Employee synced to devices successfully.`));
      queryClient.invalidateQueries({ queryKey: QueryKeys.employees.all });
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
    },
    onError: (err: Error) => {
      toast.error(_(msg`Sync failed: ${err.message}`));
    },
  });
}
