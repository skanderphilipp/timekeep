import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { useZodForm } from "@/lib/form";
import { createApiKeyFormSchema, type ApiKeyFormValues } from "../schemas/api-key-form.schema";
import { createApiKey, type CreateApiKeyRequest, type ApiKeyCreatedResponse } from "@/lib/api";
import { QueryKeys } from "@/lib/query-keys";
import { useToast } from "@/infrastructure/toast/toast";

/**
 * Compute the number of days until expiry from the ExpiryValue.
 * Returns null for "never" (no expiration).
 */
export function computeExpiryDays(expiry: NonNullable<ApiKeyFormValues["expiry"]>): number | null {
  if (expiry.preset === "never") return null;
  if (expiry.preset === "custom" && expiry.customDate) {
    const days = Math.ceil((expiry.customDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }
  const presetDays: Record<string, number> = {
    "30d": 30,
    "60d": 60,
    "90d": 90,
    "180d": 180,
    "365d": 365,
  };
  return presetDays[expiry.preset] ?? null;
}

/**
 * Form state hook for the API key creation dialog.
 *
 * Manages react-hook-form with Zod validation, converts form values to
 * the API request shape, and tracks the created key for display.
 * Handles the API call internally via TanStack Query mutation.
 */
export function useApiKeyForm() {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);

  const form = useZodForm(createApiKeyFormSchema(_), {
    defaultValues: {
      name: "",
      permissions: ["read:punches"],
      expiry: { preset: "never", customDate: null },
    },
  });

  const reset = useCallback(() => {
    form.reset({
      name: "",
      permissions: ["read:punches"],
      expiry: { preset: "never", customDate: null },
    });
    setCreatedKey(null);
  }, [form]);

  const mutation = useMutation({
    mutationFn: (req: CreateApiKeyRequest) => createApiKey(req),
    onSuccess: (result) => {
      setCreatedKey(result);
      queryClient.invalidateQueries({ queryKey: QueryKeys.apiKeys.list() });
      toast.success(_(msg`API key created successfully.`));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = form.handleSubmit(async (values: ApiKeyFormValues) => {
    const req: CreateApiKeyRequest = {
      name: values.name,
      permissions: values.permissions.join(" "),
    };
    const expiryDays = computeExpiryDays(values.expiry);
    if (expiryDays !== null) {
      req.expires_in_days = expiryDays;
    }

    mutation.mutate(req);
  });

  return { form, isPending: mutation.isPending, createdKey, handleSubmit, reset } as const;
}
