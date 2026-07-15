import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { Form, SchemaForm, Input } from "@/components/ui";
import { useApiKeyForm } from "../hooks/use-api-key-form";
import { createApiKeyFormDef } from "../schemas/api-key-form.schema";
import type { CreateApiKeyRequest, ApiKeyCreatedResponse } from "@/lib/api";

type ApiKeyFormSidePanelProps = {
  onCreateKey: (req: CreateApiKeyRequest) => Promise<ApiKeyCreatedResponse>;
  onClose: () => void;
};

/**
 * API key form in the side panel — thin wrapper with two-step flow:
 *   1. Form → submit → key created
 *   2. Display generated key (shown once)
 *
 * Delegates to `useApiKeyForm` (shared hook) + `SchemaForm` (UI library).
 */
export function ApiKeyFormSidePanel({ onCreateKey, onClose }: ApiKeyFormSidePanelProps) {
  const { _ } = useLingui();
  const { form, submitting, createdKey, handleSubmit, reset } = useApiKeyForm({ onCreateKey });
  const formSchema = createApiKeyFormDef(_);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  // Step 2: key created — show to copy
  if (createdKey) {
    return (
      <SidePanelFormContainer
        title={_(msg`API Key Created`)}
        description={_(msg`Copy this key now. It will not be shown again.`)}
        onCancel={handleClose}
        saveLabel={_(msg`Done`)}
      >
        <Input value={createdKey.api_key} readOnly />
      </SidePanelFormContainer>
    );
  }

  // Step 1: create form
  return (
    <SidePanelFormContainer
      title={_(msg`Create API Key`)}
      description={_(msg`Generate a new API key with specific permissions and expiry.`)}
      isPending={submitting}
      onCancel={handleClose}
      saveLabel={submitting ? _(msg`Creating…`) : _(msg`Create Key`)}
    >
      <Form id="side-panel-form" onSubmit={handleSubmit}>
        <SchemaForm formSchema={formSchema} form={form} />
      </Form>
    </SidePanelFormContainer>
  );
}

ApiKeyFormSidePanel.displayName = "ApiKeyFormSidePanel";
