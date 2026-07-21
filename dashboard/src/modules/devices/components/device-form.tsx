import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useCallback, useEffect } from "react";

import { useZodForm } from "@/lib/form";
import { z } from "zod";
import {
  Form,
  FormActions,
  Button,
  Spinner,
  Input,
  Switch,
  Select,
} from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import { updateDevice } from "@/lib/api";
import { useDeviceDetail } from "../hooks/use-device-detail";
import { useRecordDetailContext } from "@/modules/record-detail/states/record-detail-context";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import { fetchDeviceGroups, type DeviceGroup } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

// ── Schema ────────────────────────────────────────────────────────────────

function createDeviceConfigSchema(_: ReturnType<typeof useLingui>["_"]) {
  return z.object({
    label: z.string().min(1, _(msg`Label is required`)),
    host: z.string().min(1, _(msg`Host is required`)),
    port: z.coerce.number().int().min(1).max(65535).default(DEFAULT_ZKTECO_PORT),
    comm_key: z.coerce.number().int().default(0),
    push_enabled: z.boolean().default(true),
    group_id: z.string().nullable().default(null),
  });
}

type DeviceConfigValues = z.infer<ReturnType<typeof createDeviceConfigSchema>>;

// ── Props ──────────────────────────────────────────────────────────────────

type DeviceFormProps = {
  /** When true, renders inline (no page chrome). Used inside detail tabs. */
  embedded?: boolean;
  /** Callback after successful save. */
  onSaved?: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Device config form — embedded inside the device detail page's Config tab.
 *
 * Reads the current device from the RecordDetailRenderer context and
 * populates the form. Calls `updateDevice` on submit.
 *
 * This is an embedded sub-form (not a standalone page). The full-page
 * DeviceFormPage was removed in the architecture refactoring.
 */
export function DeviceForm({ embedded: _embedded, onSaved }: DeviceFormProps) {
  const { _ } = useLingui();
  const toast = useToast();
  const { entityId: deviceSn } = useRecordDetailContext();
  const { device, isLoading } = useDeviceDetail(deviceSn);

  const formSchema = createDeviceConfigSchema(_);

  const form = useZodForm(formSchema, {
    defaultValues: {
      label: "",
      host: "",
      port: DEFAULT_ZKTECO_PORT,
      comm_key: 0,
      push_enabled: true,
      group_id: null as string | null,
    },
  });

  // Fetch device groups for the dropdown
  const { data: groups } = useQuery<DeviceGroup[]>({
    queryKey: ["device-groups", "options"] as const,
    queryFn: fetchDeviceGroups,
    staleTime: 5 * 60 * 1000,
  });

  // Populate form when device data loads
  useEffect(() => {
    if (device) {
      form.reset({
        label: device.label ?? "",
        host: device.host ?? "",
        port: device.port ?? DEFAULT_ZKTECO_PORT,
        comm_key: device.comm_key ?? 0,
        push_enabled: device.push_enabled ?? true,
        group_id: device.group_id ?? null,
      });
    }
  }, [device, form]);

  const handleSubmit = useCallback(
    async (values: DeviceConfigValues) => {
      try {
        await updateDevice(deviceSn, {
          label: values.label,
          host: values.host,
          port: values.port,
          comm_key: values.comm_key,
          push_enabled: values.push_enabled,
          group_id: values.group_id,
          serial_number: deviceSn,
          timezone: null,
        });
        toast.success(_(msg`Device updated.`));
        onSaved?.();
      } catch {
        toast.error(_(msg`Failed to update device.`));
      }
    },
    [deviceSn, toast, _, onSaved],
  );

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <Form onSubmit={form.handleSubmit(handleSubmit)}>
      <Input
        label={_(msg`Label`)}
        helperText={_(msg`Human-readable name for this scanner.`)}
        {...form.register("label")}
        error={form.formState.errors.label?.message}
      />

      <Input
        label={_(msg`Host`)}
        helperText={_(msg`IP address or hostname of the device.`)}
        {...form.register("host")}
        error={form.formState.errors.host?.message}
      />

      <Input
        label={_(msg`Port`)}
        helperText={_(msg`Default: ${DEFAULT_ZKTECO_PORT}`)}
        type="number"
        {...form.register("port", { valueAsNumber: true })}
        error={form.formState.errors.port?.message}
      />

      <Input
        label={_(msg`Comm Key`)}
        helperText={_(msg`Device communication key (default: 0).`)}
        type="number"
        {...form.register("comm_key", { valueAsNumber: true })}
        error={form.formState.errors.comm_key?.message}
      />

      <Switch
        fieldLabel={_(msg`Push Enabled`)}
        helperText={_(msg`Enable real-time attendance push from this device.`)}
        checked={form.watch("push_enabled")}
        onCheckedChange={(checked: boolean) => form.setValue("push_enabled", checked)}
      />

      {/* Device Group selector */}
      <Select
        label={_(msg`Device Group`)}
        value={form.watch("group_id") ?? ""}
        onChange={(v) => form.setValue("group_id", v || null)}
        options={[
          { value: "", label: _(msg`None`) },
          ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
        ]}
        fullWidth
      />

      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {_(msg`Save Changes`)}
        </Button>
      </FormActions>
    </Form>
  );
}

DeviceForm.displayName = "DeviceForm";
