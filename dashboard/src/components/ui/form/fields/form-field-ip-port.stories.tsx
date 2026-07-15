import type { Meta, StoryObj } from "@storybook/react";
import { useForm, FormProvider } from "react-hook-form";

import { Form } from "../form";
import { FormField } from "../form-field";
import { FormFieldIpPort } from "../fields/form-field-ip-port";
import { FieldInputContainer } from "../field-input-container";
import { Button } from "../../button";
import type { FormIpPortFieldDef } from "../form-field-def";

// ── Wrapper: provides react-hook-form context ───────────────────────────

function FormWrapper({
  field,
  defaultIp = "",
  defaultPort = 4370,
}: {
  field: FormIpPortFieldDef;
  defaultIp?: string;
  defaultPort?: number;
}) {
  const form = useForm({
    defaultValues: {
      [field.name[0]]: defaultIp,
      [field.name[1]]: defaultPort,
    },
  });

  return (
    <FormProvider {...form}>
      <Form>
        <FormField label={field.label} required={field.required} helperText={field.description}>
          <FieldInputContainer>
            <FormFieldIpPort field={field} form={form} inputId="story-ip-port" />
          </FieldInputContainer>
        </FormField>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" type="button" onClick={() => {}}>
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}

// ── Field definition ────────────────────────────────────────────────────

const deviceAddressField: FormIpPortFieldDef = {
  type: "ip-port",
  label: "Device Address",
  description: "The IP address and port of the ZKTeco biometric scanner.",
  name: ["host", "port"],
  required: true,
};

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof FormFieldIpPort> = {
  title: "UI/Forms/FormFieldIpPort",
  component: FormFieldIpPort,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FormFieldIpPort>;

// ── Stories ─────────────────────────────────────────────────────────────

/** Device address form field with default values. */
export const Primary: Story = {
  render: () => (
    <FormWrapper field={deviceAddressField} defaultIp="192.168.1.100" defaultPort={4370} />
  ),
};

/** Empty field — user must enter both IP and port. */
export const Empty: Story = {
  render: () => <FormWrapper field={deviceAddressField} />,
};

/** Optional field (not required). */
export const Optional: Story = {
  render: () => (
    <FormWrapper
      field={{
        ...deviceAddressField,
        required: false,
        description: "Optional backup device address.",
      }}
    />
  ),
};

/** Field with validation error. */
export const WithError: Story = {
  name: "With Error",
  render: () => {
    const errorField: FormIpPortFieldDef = { ...deviceAddressField };
    function ErrorWrapper() {
      const form = useForm({
        defaultValues: { host: "999.999.999.999", port: 4370 },
      });
      // Simulate a validation error
      form.setError("host", { message: "Invalid IP address" });

      return (
        <FormProvider {...form}>
          <Form>
            <FormField
              label={errorField.label}
              required={errorField.required}
              error="Invalid IP address"
            >
              <FieldInputContainer>
                <FormFieldIpPort field={errorField} form={form} inputId="story-error" />
              </FieldInputContainer>
            </FormField>
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" type="button" onClick={() => {}}>
                Save
              </Button>
            </div>
          </Form>
        </FormProvider>
      );
    }
    return <ErrorWrapper />;
  },
};
