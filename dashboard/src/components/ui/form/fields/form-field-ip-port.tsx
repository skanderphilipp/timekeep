import { Controller, type UseFormReturn } from "react-hook-form";

import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import { IpPortInput } from "@/components/ui/ip-port-input";
import type { FormIpPortFieldDef } from "@/components/ui/form/form-field-def";

/**
 * IP:Port form field — self-contained, no FormField wrapper.
 *
 * IpPortInput handles its own label, error, and helper text.
   * the control is self-contained.
 */
export function FormFieldIpPort({
  field,
  form,
}: {
  field: FormIpPortFieldDef;
  form: UseFormReturn<any>;
  // inputId not needed — IpPortInput generates its own id
  inputId?: string;
}) {
  const [ipName, portName] = field.name;
  const ipError = form.formState.errors[ipName]?.message as string | undefined;
  const portError = form.formState.errors[portName]?.message as string | undefined;
  const error = ipError || portError;

  return (
    <Controller
      name={ipName}
      control={form.control}
      render={({ field: ipField }) => (
        <Controller
          name={portName}
          control={form.control}
          render={({ field: portField }) => (
            <IpPortInput
              label={field.label}
              error={error}
              helperText={field.description}
              value={{
                ip: ipField.value ?? "",
                port: portField.value ?? DEFAULT_ZKTECO_PORT,
              }}
              onChange={({ ip, port }) => {
                ipField.onChange(ip);
                portField.onChange(port);
              }}
              ipName={ipName}
              portName={portName}
              disabled={field.disabled}
              required={field.required}
              fullWidth
            />
          )}
        />
      )}
    />
  );
}
