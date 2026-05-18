import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useZodForm } from "@/lib/form";
import { fetchSystemSettings, updateSystemSettings } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { DEFAULT_POLL_INTERVAL_SECS } from "@/lib/constants";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createSystemSettingsSchema,
  type SystemSettingsFormValues,
} from "../schemas/settings-form.schema";

export function useSystemSettings() {
  const { _ } = useLingui();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: QueryKeys.settings.system(),
    queryFn: fetchSystemSettings,
  });

  const form = useZodForm(createSystemSettingsSchema(_), {
    defaultValues: {
      poll_interval_secs: DEFAULT_POLL_INTERVAL_SECS,
      auto_discover: false,
    },
  });

  useEffect(() => {
    if (data)
      form.reset({
        poll_interval_secs: data.poll_interval_secs,
        auto_discover: data.auto_discover,
      });
  }, [data, form]);

  const save = useMutation({
    mutationFn: (v: SystemSettingsFormValues) => updateSystemSettings(v),
    onSuccess: () => toast.success(_(msg`Settings saved.`)),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    form,
    isLoading,
    isSaving: save.isPending,
    handleSubmit: form.handleSubmit((v) => save.mutate(v)),
  } as const;
}
