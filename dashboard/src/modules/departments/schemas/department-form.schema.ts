import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

export function createDepartmentFormSchema(_: I18n["_"]) {
  return z.object({
    name: z
      .string({ message: _(msg`Name is required`) })
      .min(1, _(msg`Name is required`))
      .max(100, _(msg`Name must be 100 characters or fewer`)),
  });
}

export type DepartmentFormValues = z.infer<ReturnType<typeof createDepartmentFormSchema>>;

export function createDepartmentFormDef(_: I18n["_"]) {
  const def: FormSchemaDefinition = {
    schema: createDepartmentFormSchema,
    fields: {
      name: {
        label: _(msg`Department Name`),
        description: _(msg`Organizational unit name (e.g., Warehouse, Office, Sales)`),
        placeholder: _(msg`Warehouse`),
        section: "info",
      },
    },
    sections: [
      {
        key: "info",
        title: _(msg`Department Information`),
        description: _(msg`Give the department a clear and unique name.`),
      },
    ],
  } as const;

  return def;
}
