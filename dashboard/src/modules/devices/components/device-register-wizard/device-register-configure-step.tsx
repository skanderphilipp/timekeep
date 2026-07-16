import { useEffect, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Form, SchemaForm, Section } from "@/components/ui";
import { useZodForm } from "@/lib/form";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import {
  createDeviceFormSchema,
  createDeviceFormDef,
  type DeviceFormValues,
} from "@/modules/devices/schemas/device-form.schema";
import {
  wizardSelectedDeviceAtom,
  wizardDeviceConfigAtom,
} from "@/infrastructure/state/atoms/wizard";

import styles from "./device-register-configure-step.module.scss";

type DeviceRegisterConfigureStepProps = {
  /** IP address and serial number from the scan step params. */
  params?: Record<string, unknown>;
  /** Push the next step. */
  pushStep: (step: string, title: string, params?: Record<string, unknown>) => void;
  /** Go back to scan step. */
  goBack: () => void;
};

/**
 * Step 2: Configure Device.
 *
 * Pre-fills the device form with data discovered during the network scan.
 * On submit, stores the config in {@link wizardDeviceConfigAtom} and
 * pushes the test step.
 */
export function DeviceRegisterConfigureStep({
  params,
  pushStep,
}: DeviceRegisterConfigureStepProps) {
  const { _ } = useLingui();
  const selectedDevice = useAtomValue(wizardSelectedDeviceAtom);
  const setDeviceConfig = useSetAtom(wizardDeviceConfigAtom);

  const scanIp = (params?.ip as string) ?? selectedDevice?.ip_address ?? "";
  const scanSerial = (params?.serial as string) ?? selectedDevice?.serial_number ?? "";

  const formSchema = createDeviceFormSchema(_);
  const formDef = createDeviceFormDef(_);

  const form = useZodForm(formSchema, {
    defaultValues: {
      serial_number: scanSerial,
      label: "",
      host: scanIp,
      port: DEFAULT_ZKTECO_PORT,
      comm_key: 0,
      push_enabled: true,
      timezone: null,
    },
  });

  // Update form when scan data arrives (handles late-loading atom)
  useEffect(() => {
    if (scanSerial) form.setValue("serial_number", scanSerial);
    if (scanIp) form.setValue("host", scanIp);
  }, [scanSerial, scanIp, form]);

  const handleSubmit = useCallback(
    (values: DeviceFormValues) => {
      setDeviceConfig({
        serial_number: values.serial_number,
        label: values.label || values.serial_number,
        host: values.host,
        port: values.port,
        comm_key: values.comm_key,
        push_enabled: values.push_enabled,
      });
      pushStep("test", _(msg`Test & Register`));
    },
    [setDeviceConfig, pushStep, _],
  );

  return (
    <Section className={styles.container}>
      <Form id="configure-form" onSubmit={form.handleSubmit(handleSubmit)}>
        <SchemaForm formSchema={formDef} form={form} />
      </Form>
    </Section>
  );
}

DeviceRegisterConfigureStep.displayName = "DeviceRegisterConfigureStep";
