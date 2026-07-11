import { useState, useCallback } from "react";
import { useLingui } from "@lingui/react";

import { useZodForm } from "@/lib/form";
import { createApiKeyFormSchema, type ApiKeyFormValues } from "../schemas/api-key-form.schema";
import type { CreateApiKeyRequest, ApiKeyCreatedResponse } from "@/lib/api";

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

type UseApiKeyFormOptions = {
  /** Called with the API-ready request. Returns the created key response. */
  onCreateKey: (req: CreateApiKeyRequest) => Promise<ApiKeyCreatedResponse>;
};

/**
 * Form state hook for the API key creation dialog.
 *
 * Manages react-hook-form with Zod validation, converts form values to
 * the API request shape, and tracks the created key for display.
 */
export function useApiKeyForm({ onCreateKey }: UseApiKeyFormOptions) {
  const { _ } = useLingui();
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = form.handleSubmit(async (values: ApiKeyFormValues) => {
    setSubmitting(true);
    try {
      const req: CreateApiKeyRequest = {
        name: values.name,
        permissions: values.permissions.join(" "),
      };
      const expiryDays = computeExpiryDays(values.expiry);
      if (expiryDays !== null) {
        req.expires_in_days = expiryDays;
      }

      const result = await onCreateKey(req);
      setCreatedKey(result);
    } finally {
      setSubmitting(false);
    }
  });

  return { form, submitting, createdKey, handleSubmit, reset } as const;
}
