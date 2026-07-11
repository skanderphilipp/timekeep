import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { Form, SchemaForm, FormActions, Button, Spinner } from "@/components/ui";
import { useDeviceForm } from "../hooks/use-device-form";
import { createDeviceFormDef } from "../schemas/device-form.schema";

/**
 * Device form molecule.
 *
 * Delegates all field rendering to {@link SchemaForm}, which derives
 * field definitions from the Zod schema + UI metadata in
 * `createDeviceFormDef`. The page only composes this molecule — it never
 * imports raw atoms like `Input`, `Select`, or `Toggle`.
 */
export function DeviceForm() {
  const { _ } = useLingui();
  const { form, isEditing, isLoadingDevice, isSaving, handleSubmit } = useDeviceForm();

  // Memoize the form schema definition (labels are i18n'd)
  const formSchema = createDeviceFormDef(_);

  if (isEditing && isLoadingDevice) {
    return <Spinner size="lg" />;
  }

  return (
    <Form onSubmit={handleSubmit}>
      <SchemaForm
        formSchema={formSchema}
        form={form}
        fieldOverrides={isEditing ? { serial_number: { disabled: true } } : undefined}
      />
      <FormActions>
        <Button to={AppRoute.devices.list} variant="secondary">
          {_(msg`Cancel`)}
        </Button>
        <Button type="submit" loading={isSaving}>
          {isEditing ? _(msg`Save Changes`) : _(msg`Add Device`)}
        </Button>
      </FormActions>
    </Form>
  );
}
