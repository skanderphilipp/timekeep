import { Controller, type UseFormReturn } from "react-hook-form";

import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import { FormField } from "@/components/ui/form/form-field";
import { FieldInputContainer } from "@/components/ui/form/field-input-container";
import { IpPortInput } from "@/components/ui/ip-port-input";
import type { FormIpPortFieldDef } from "@/components/ui/form/form-field-def";

export function FormFieldIpPort({
  field,
  form,
  inputId,
}: {
  field: FormIpPortFieldDef;
  form: UseFormReturn<any>;
  inputId: string;
}) {
  const [ipName, portName] = field.name;
  const ipError = form.formState.errors[ipName]?.message as string | undefined;
  const portError = form.formState.errors[portName]?.message as string | undefined;
  const error = ipError || portError;

  return (
    <FormField
      label={field.label}
      required={field.required}
      helperText={field.description}
      error={error}
      htmlFor={inputId}
    >
      <FieldInputContainer>
        <Controller
          name={ipName}
          control={form.control}
          render={({ field: ipField }) => (
            <Controller
              name={portName}
              control={form.control}
              render={({ field: portField }) => (
                <IpPortInput
                  value={{ ip: ipField.value ?? "", port: portField.value ?? DEFAULT_ZKTECO_PORT }}
                  onChange={({ ip, port }) => {
                    ipField.onChange(ip);
                    portField.onChange(port);
                  }}
                  ipName={ipName}
                  portName={portName}
                  disabled={field.disabled}
                  required={field.required}
                  error={error}
                  fullWidth
                />
              )}
            />
          )}
        />
      </FieldInputContainer>
    </FormField>
  );
}
