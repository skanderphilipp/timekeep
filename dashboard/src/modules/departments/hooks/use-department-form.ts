import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { QueryKeys } from "@/lib/query-keys";
import { useZodForm } from "@/lib/form";
import {
  createDepartment,
  fetchDepartment,
  updateDepartment,
  type DepartmentRequest,
} from "@/lib/api";
import { useToast } from "@/infrastructure/toast/toast";
import {
  createDepartmentFormSchema,
  type DepartmentFormValues,
} from "../schemas/department-form.schema";

/**
 * Department form state + mutation hook.
 *
 * Manages react-hook-form with zod validation. When editing, fetches
 * existing department data. The work_policy is tracked separately
 * because it's optional and has complex shape.
 */
export function useDepartmentForm(existingId?: string, onSaved?: () => void) {
  const isEditing = !!existingId;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { _ } = useLingui();

  // Fetch existing department when editing
  const { data: existingDepartment, isLoading: isLoadingDepartment } = useQuery({
    queryKey: QueryKeys.departments.detail(existingId!),
    queryFn: () => fetchDepartment(existingId!),
    enabled: isEditing,
  });

  // React Hook Form with zod validation
  const form = useZodForm(createDepartmentFormSchema(_), {
    defaultValues: {
      name: "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingDepartment && isEditing) {
      form.reset({ name: existingDepartment.name });
    }
  }, [existingDepartment, isEditing, form]);

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: (data: DepartmentFormValues) => {
      const req: DepartmentRequest = {
        name: data.name,
      };
      return isEditing
        ? updateDepartment(existingId!, req)
        : createDepartment(req);
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? _(msg`Department updated successfully.`)
          : _(msg`Department created successfully.`),
      );
      queryClient.invalidateQueries({ queryKey: QueryKeys.departments.all });
      onSaved?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = form.handleSubmit((data) => {
    saveMutation.mutate(data);
  });

  return {
    form,
    isEditing,
    isLoadingDepartment,
    isSaving: saveMutation.isPending,
    handleSubmit,
    existingDepartment,
  } as const;
}
