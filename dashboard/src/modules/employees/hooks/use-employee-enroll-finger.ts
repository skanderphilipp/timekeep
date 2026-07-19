import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { enrollFinger } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useToast } from "@/infrastructure/toast/toast";

/**
 * Hook for enrolling an employee's fingerprint on a specific device.
 *
 * Triggers the 3-sample capture loop on the physical device.
 * The employee must place their finger three times on the scanner.
 * Returns immediately - actual enrollment runs asynchronously on the backend.
 *
 * After enrollment completes, use "Sync to Devices" to push the new
 * fingerprint to all other devices the employee is enrolled on.
 *
 * TODO(ENTERPRISE): Add SSE listener for real-time finger score updates
 * (Sample 1/3, 2/3, 3/3, Enrolled).
 *
 * Phase: Production hardening
 * Impact: HR has no live feedback during the 10-30s capture window.
 * Fix: Subscribe to onboarding SSE or poll fingerprint_count on interval.
 */
export function useEmployeeEnrollFinger(
  userPin: string,
  deviceSn: string,
) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { _ } = useLingui();

  return useMutation({
    mutationFn: () => enrollFinger(deviceSn, userPin, 0),
    onSuccess: () => {
      toast.success(
        _(msg`Enrollment started on ${deviceSn}. Ask the employee to place their finger on the scanner.`),
      );
      queryClient.invalidateQueries({ queryKey: QueryKeys.devices.all });
    },
    onError: (err: Error) => {
      toast.error(_(msg`Enrollment failed: ${err.message}`));
    },
  });
}
