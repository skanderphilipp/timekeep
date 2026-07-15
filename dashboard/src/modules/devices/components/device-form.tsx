import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { Form, SchemaForm, FormActions, Button, ListLoading } from "@/components/ui";
import { useDeviceForm } from "../hooks/use-device-form";
import { createDeviceFormDef } from "../schemas/device-form.schema";

type DeviceFormProps = {
  /**
   * When true, the form renders without section descriptions (tighter visual
   * for embedding inside a tab panel) and replaces Cancel/Save with a single
   * Save button that calls `onSaved` instead of navigating away.
   */
  embedded?: boolean;
  /** Called after a successful save in embedded mode. */
  onSaved?: () => void;
};

/**
 * Device form molecule.
 *
 * Delegates all field rendering to {@link SchemaForm}, which derives
 * field definitions from the Zod schema + UI metadata in
 * `createDeviceFormDef`. The page only composes this molecule — it never
 * imports raw atoms like `Input`, `Select`, or `Toggle`.
 */
export function DeviceForm({ embedded = false, onSaved }: DeviceFormProps) {
  const { _ } = useLingui();
  const { form, isEditing, isLoadingDevice, isSaving, handleSubmit } = useDeviceForm({
    embedded,
    onSaved,
  });

  // Memoize the form schema definition (labels are i18n'd)
  const formSchema = createDeviceFormDef(_);

  if (isEditing && isLoadingDevice) {
    return <ListLoading />;
  }

  return (
    <Form onSubmit={handleSubmit}>
      <SchemaForm
        formSchema={formSchema}
        form={form}
        fieldOverrides={isEditing ? { serial_number: { disabled: true } } : undefined}
      />
      <FormActions>
        {!embedded && (
          <Button to={AppRoute.devices.list} variant="secondary">
            {_(msg`Cancel`)}
          </Button>
        )}
        <Button type="submit" loading={isSaving}>
          {isEditing ? _(msg`Save Changes`) : _(msg`Add Device`)}
        </Button>
      </FormActions>
    </Form>
  );
}
