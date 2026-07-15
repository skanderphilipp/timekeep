import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { Form, SchemaForm } from "@/components/ui";
import { useEndpointForm } from "../hooks/use-endpoint-form";
import { createEndpointFormDef } from "../schemas/endpoint-form.schema";
import type { IntegrationEndpoint } from "@/lib/api";

type EndpointFormSidePanelProps = {
  endpoint?: IntegrationEndpoint;
  onClose: () => void;
};

/**
 * Endpoint form in the side panel — thin wrapper.
 *
 * Delegates to `useEndpointForm` (shared hook) + `SchemaForm` (UI library).
 */
export function EndpointFormSidePanel({ endpoint, onClose }: EndpointFormSidePanelProps) {
  const { _ } = useLingui();
  const isEdit = !!endpoint;
  const { form, isSaving, handleSubmit } = useEndpointForm(endpoint, onClose);
  const formSchema = createEndpointFormDef(_, isEdit);

  return (
    <SidePanelFormContainer
      title={isEdit ? _(msg`Edit Endpoint`) : _(msg`Create Endpoint`)}
      description={
        isEdit
          ? _(msg`Update integration endpoint configuration.`)
          : _(msg`Add a new webhook or API endpoint for integrations.`)
      }
      isPending={isSaving}
      onCancel={onClose}
      saveLabel={isEdit ? _(msg`Save Changes`) : _(msg`Create Endpoint`)}
    >
      <Form id="side-panel-form" onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
      </Form>
    </SidePanelFormContainer>
  );
}

EndpointFormSidePanel.displayName = "EndpointFormSidePanel";
