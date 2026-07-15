import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { QueryKeys } from "@/lib/query-keys";
import { useZodForm } from "@/lib/form";
import { createEmployee, fetchEmployee, updateEmployee } from "@/lib/api";
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createEmployeeFormSchema,
  type EmployeeFormValues,
} from "../schemas/employee-form.schema";

/**
 * Employee form state + mutation hook.
 *
 * Manages react-hook-form with zod validation, fetches existing employee
 * data when editing, and handles the create/update mutation.
 *
 * Pattern: mirrors `useDeviceForm` from the devices module.
 */
export function useEmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { _ } = useLingui();

  // Fetch existing employee when editing
  const { data: existingEmployee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: QueryKeys.employees.detail(id!),
    queryFn: () => fetchEmployee(id!),
    enabled: isEditing,
  });

  // React Hook Form with zod validation (i18n'd error messages)
  const form = useZodForm(createEmployeeFormSchema(_), {
    defaultValues: {
      pin: "",
      name: "",
      department: "",
      external_id: "",
    },
  });

  // Populate form when editing and data arrives
  useEffect(() => {
    if (existingEmployee && isEditing) {
      form.reset({
        pin: existingEmployee.pin,
        name: existingEmployee.name,
        department: existingEmployee.department ?? "",
        external_id: existingEmployee.external_id ?? "",
      });
    }
  }, [existingEmployee, isEditing, form]);

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: (data: EmployeeFormValues) =>
      isEditing
        ? updateEmployee(id!, data as UpdateEmployeeRequest)
        : createEmployee(data as CreateEmployeeRequest),
    onSuccess: () => {
      toast.success(
        isEditing ? _(msg`Employee updated successfully.`) : _(msg`Employee created successfully.`),
      );
      navigate(AppRoute.employees.list);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = form.handleSubmit((data) => {
    saveMutation.mutate(data);
  });

  return {
    form,
    isEditing,
    isLoadingEmployee,
    isSaving: saveMutation.isPending,
    handleSubmit,
    employeeId: id,
  } as const;
}
