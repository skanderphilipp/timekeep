import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import type { IntegrationKindValue } from "@shared/integration-kinds";

import { useZodForm } from "@/lib/form";
import { createEndpoint, updateEndpoint, type IntegrationEndpoint, type CreateEndpointRequest, type UpdateEndpointRequest } from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import { createEndpointSchema, type EndpointFormValues } from "../schemas/endpoint-form.schema";

export function useEndpointForm(endpoint?: IntegrationEndpoint, onSuccess?: () => void) {
  const { _ } = useLingui();
  const toast = useToast();
  const isEdit = !!endpoint;

  const form = useZodForm(createEndpointSchema(_), {
    defaultValues: { name: "", kind: "webhook" as const, url: "", config_json: "" },
  });

  useEffect(() => {
    if (endpoint) {
      const cfg = endpoint.config as Record<string, unknown> | undefined;
      form.reset({
        name: endpoint.name,
        kind: endpoint.kind as EndpointFormValues["kind"],
        url: typeof cfg?.url === "string" ? cfg.url : "",
        config_json: cfg ? JSON.stringify(cfg, null, 2) : "",
      });
    }
  }, [endpoint, form]);

  const save = useMutation({
    mutationFn: (v: EndpointFormValues) => {
      let config: Record<string, unknown> = {};
      if (v.config_json) { try { config = JSON.parse(v.config_json); } catch { /* raw string */ config = { raw: v.config_json }; } }
      if (v.url) config = { ...config, url: v.url };
      if (isEdit && endpoint) {
        const req: UpdateEndpointRequest = { name: v.name, config };
        return updateEndpoint(endpoint.id, req);
      }
      const req: CreateEndpointRequest = { name: v.name, kind: v.kind as IntegrationKindValue, config };
      return createEndpoint(req);
    },
    onSuccess: () => {
      toast.success(_(isEdit ? msg`Endpoint updated.` : msg`Endpoint created.`));
      form.reset();
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { form, isSaving: save.isPending, handleSubmit: form.handleSubmit((v) => save.mutate(v)) } as const;
}
