import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { QueryKeys } from "@/lib/query-keys";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import { useZodForm } from "@/lib/form";
import { createDevice, fetchDevice, updateDevice, type DeviceConfig } from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import { createDeviceFormSchema, type DeviceFormValues } from "../schemas/device-form.schema";

type UseDeviceFormOptions = {
  /** When true, stay on the current page after save. */
  embedded?: boolean;
  /** Called after a successful save in embedded mode. */
  onSaved?: () => void;
};

/**
 * Device form state + mutation hook.
 *
 * Manages react-hook-form with zod validation, fetches existing device
 * data when editing, and handles the create/update mutation.
 */
export function useDeviceForm({ embedded = false, onSaved }: UseDeviceFormOptions = {}) {
  const { sn } = useParams<{ sn: string }>();
  const isEditing = !!sn;
  const navigate = useNavigate();
  const toast = useToast();
  const { _ } = useLingui();

  // Fetch existing device when editing
  const { data: existingDevice, isLoading: isLoadingDevice } = useQuery({
    queryKey: QueryKeys.devices.detail(sn!),
    queryFn: () => fetchDevice(sn!),
    enabled: isEditing,
  });

  // React Hook Form with zod validation (i18n'd error messages)
  const form = useZodForm(createDeviceFormSchema(_), {
    defaultValues: {
      serial_number: "",
      label: "",
      host: "",
      port: DEFAULT_ZKTECO_PORT,
      comm_key: 0,
      push_enabled: true,
      timezone: null,
    },
  });

  // Populate form when editing and data arrives
  useEffect(() => {
    if (existingDevice && isEditing && existingDevice.serial_number) {
      form.reset({
        serial_number: existingDevice.serial_number ?? "",
        label: existingDevice.label ?? "",
        host: existingDevice.host ?? "",
        port: existingDevice.port ?? DEFAULT_ZKTECO_PORT,
        comm_key: existingDevice.comm_key ?? 0,
        push_enabled: existingDevice.push_enabled ?? true,
        timezone: existingDevice.timezone,
      });
    }
  }, [existingDevice, isEditing, form]);

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: (data: DeviceFormValues) =>
      isEditing ? updateDevice(sn!, data as DeviceConfig) : createDevice(data as DeviceConfig),
    onSuccess: () => {
      toast.success(
        isEditing ? _(msg`Device updated successfully.`) : _(msg`Device added successfully.`),
      );
      if (embedded && onSaved) {
        // In embedded mode, call the callback (typically triggers a data refetch).
        onSaved();
      } else {
        navigate(AppRoute.devices.list);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = form.handleSubmit((data) => {
    saveMutation.mutate(data);
  });

  return {
    form,
    isEditing,
    isLoadingDevice,
    isSaving: saveMutation.isPending,
    handleSubmit,
    effectiveDevice: existingDevice,
    deviceSn: sn,
  } as const;
}
