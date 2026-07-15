import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import type { IntegrationKindValue } from "@shared/integration-kinds";

import { QueryKeys } from "@/lib/query-keys";
import { useZodForm } from "@/lib/form";
import {
  createEndpoint,
  fetchEndpoint,
  updateEndpoint,
  type CreateEndpointRequest,
  type UpdateEndpointRequest,
} from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import { createEndpointSchema, type EndpointFormValues } from "../schemas/endpoint-form.schema";

/**
 * Endpoint form state + mutation hook.
 *
 * Manages react-hook-form with zod validation. When editing, fetches
 * existing endpoint data and populates the form.
 */
export function useEndpointForm(existingId?: string, onSuccess?: () => void) {
  const { _ } = useLingui();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!existingId;

  const form = useZodForm(createEndpointSchema(_), {
    defaultValues: { name: "", kind: "webhook" as const, url: "", config_json: "" },
  });

  // Fetch existing endpoint when editing
  const { data: existingEndpoint, isLoading: isLoadingEndpoint } = useQuery({
    queryKey: QueryKeys.endpoints.detail(existingId!),
    queryFn: () => fetchEndpoint(existingId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingEndpoint) {
      const cfg = existingEndpoint.config as Record<string, unknown> | undefined;
      form.reset({
        name: existingEndpoint.name,
        kind: existingEndpoint.kind as EndpointFormValues["kind"],
        url: typeof cfg?.url === "string" ? cfg.url : "",
        config_json: cfg ? JSON.stringify(cfg, null, 2) : "",
      });
    }
  }, [existingEndpoint, form]);

  const save = useMutation({
    mutationFn: (v: EndpointFormValues) => {
      let config: Record<string, unknown> = {};
      if (v.config_json) {
        try {
          config = JSON.parse(v.config_json);
        } catch {
          /* raw string */ config = { raw: v.config_json };
        }
      }
      if (v.url) config = { ...config, url: v.url };
      if (isEdit && existingId) {
        const req: UpdateEndpointRequest = { name: v.name, config };
        return updateEndpoint(existingId, req);
      }
      const req: CreateEndpointRequest = {
        name: v.name,
        kind: v.kind as IntegrationKindValue,
        config,
      };
      return createEndpoint(req);
    },
    onSuccess: () => {
      toast.success(_(isEdit ? msg`Endpoint updated.` : msg`Endpoint created.`));
      queryClient.invalidateQueries({ queryKey: QueryKeys.endpoints.list() });
      form.reset();
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    form,
    isEdit,
    isLoadingEndpoint,
    isSaving: save.isPending,
    handleSubmit: form.handleSubmit((v) => save.mutate(v)),
  } as const;
}
