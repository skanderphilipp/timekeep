import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Button,
  Input,
  Form,
  FormActions,
  Section,
  Heading,
  Separator,
  Callout,
  Dialog,
  SchemaForm,
} from "@/components/ui";
import { useApiKeyForm } from "../hooks/use-api-key-form";
import { createApiKeyFormDef } from "../schemas/api-key-form.schema";
import type { CreateApiKeyRequest, ApiKeyCreatedResponse } from "@/lib/api";

type CreateApiKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateKey: (req: CreateApiKeyRequest) => Promise<ApiKeyCreatedResponse>;
  isCreating: boolean;
};

/**
 * API key creation dialog.
 *
 * Uses {@link SchemaForm} to render the form from the Zod schema + UI metadata
 * in `createApiKeyFormDef`. No manual field declarations, no raw useState.
 */
export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreateKey,
}: CreateApiKeyDialogProps) {
  const { _ } = useLingui();
  const { form, submitting, createdKey, handleSubmit, reset } =
    useApiKeyForm({ onCreateKey });

  const formSchema = createApiKeyFormDef(_);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  const isPending = submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {createdKey ? (
        <Section>
          <Heading level="h3">{_(msg`API Key Created`)}</Heading>
          <Separator />
          <Callout
            variant="warning"
            title={_(msg`Important`)}
            description={_(
              msg`Copy this key now. It will not be shown again.`,
            )}
          />
          <Input value={createdKey.api_key} readOnly />
          <FormActions>
            <Button onClick={handleClose}>{_(msg`Done`)}</Button>
          </FormActions>
        </Section>
      ) : (
        <Form onSubmit={handleSubmit}>
          <SchemaForm formSchema={formSchema} form={form} />
          <FormActions>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              {_(msg`Cancel`)}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              loading={isPending}
            >
              {isPending ? _(msg`Creating…`) : _(msg`Create Key`)}
            </Button>
          </FormActions>
        </Form>
      )}
    </Dialog>
  );
}
