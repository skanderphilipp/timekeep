import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Form,
  FormActions,
  Button,
  SchemaForm,
} from "@/components/ui";
import { useEndpointForm } from "../hooks/use-endpoint-form";
import { createEndpointFormDef } from "../schemas/endpoint-form.schema";
import type { IntegrationEndpoint } from "@/lib/api";

type Props = {
  endpoint?: IntegrationEndpoint;
  onSuccess: () => void;
};

/**
 * Endpoint form molecule.
 *
 * Uses {@link SchemaForm} to render fields from the Zod schema + UI metadata.
 * No manual `FormFieldDef[]` arrays.
 */
export function EndpointForm({ endpoint, onSuccess }: Props) {
  const { _ } = useLingui();
  const { form, isSaving, handleSubmit } = useEndpointForm(endpoint, onSuccess);
  const isEdit = !!endpoint;

  const formSchema = createEndpointFormDef(_, isEdit);

  return (
    <Form onSubmit={handleSubmit}>
      <SchemaForm formSchema={formSchema} form={form} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onSuccess}>
          {_(msg`Cancel`)}
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEdit ? _(msg`Save Changes`) : _(msg`Create Endpoint`)}
        </Button>
      </FormActions>
    </Form>
  );
}
