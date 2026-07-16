import { z } from "zod";
import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

import type { FormSchemaDefinition } from "@/lib/form-field-meta";

export function createWorkPolicyFormSchema(_: I18n["_"]) {
  return z.object({
    title: z
      .string({ message: _(msg`Title is required`) })
      .min(1, _(msg`Title is required`))
      .max(150, _(msg`Title must be 150 characters or fewer`)),
    description: z
      .string()
      .max(500, _(msg`Description must be 500 characters or fewer`))
      .optional()
      .nullable(),
    work_start: z
      .string({ message: _(msg`Work start time is required`) })
      .regex(/^\d{2}:\d{2}$/, _(msg`Time must be in HH:MM format`)),
    work_end: z
      .string({ message: _(msg`Work end time is required`) })
      .regex(/^\d{2}:\d{2}$/, _(msg`Time must be in HH:MM format`)),
    late_threshold_minutes: z
      .number()
      .min(0, _(msg`Must be 0 or greater`))
      .max(120, _(msg`Must be 120 or fewer`))
      .optional(),
    min_hours_for_full_day: z
      .number()
      .min(0, _(msg`Must be 0 or greater`))
      .max(24, _(msg`Must be 24 or fewer`))
      .optional(),
    daily_overtime_after_hours: z
      .number()
      .min(0, _(msg`Must be 0 or greater`))
      .max(24, _(msg`Must be 24 or fewer`))
      .optional(),
    working_days: z
      .array(z.boolean())
      .length(7)
      .optional(),
  });
}

export type WorkPolicyFormValues = z.infer<ReturnType<typeof createWorkPolicyFormSchema>>;

export function createWorkPolicyFormDef(_: I18n["_"]) {
  const def: FormSchemaDefinition = {
    schema: createWorkPolicyFormSchema,
    fields: {
      title: {
        label: _(msg`Title`),
        description: _(msg`A unique name for this work policy template (e.g., "Night Shift")`),
        placeholder: _(msg`Night Shift`),
        section: "info",
      },
      description: {
        label: _(msg`Description`),
        description: _(msg`Optional description of this policy's purpose`),
        placeholder: _(msg`Overnight warehouse shift with extended hours`),
        section: "info",
      },
      work_start: {
        label: _(msg`Work Start Time`),
        description: _(msg`Start of the work day in 24h format`),
        placeholder: "09:00",
        section: "hours",
      },
      work_end: {
        label: _(msg`Work End Time`),
        description: _(msg`End of the work day in 24h format`),
        placeholder: "17:00",
        section: "hours",
      },
      late_threshold_minutes: {
        label: _(msg`Late Threshold (minutes)`),
        description: _(msg`Minutes after work_start before employee is marked late`),
        section: "thresholds",
      },
      min_hours_for_full_day: {
        label: _(msg`Min Hours for Full Day`),
        description: _(msg`Minimum worked hours to count as a full attendance day`),
        section: "thresholds",
      },
      daily_overtime_after_hours: {
        label: _(msg`Overtime After (hours)`),
        description: _(msg`Daily hours threshold after which overtime is calculated`),
        section: "thresholds",
      },
      working_days: {
        label: _(msg`Working Days`),
        description: _(msg`Select the days of the week this policy applies to`),
        section: "hours",
      },
    },
    sections: [
      {
        key: "info",
        title: _(msg`Policy Information`),
        description: _(msg`Give the work policy a clear, descriptive name.`),
      },
      {
        key: "hours",
        title: _(msg`Work Hours & Days`),
        description: _(msg`Set the standard work schedule for this policy.`),
      },
      {
        key: "thresholds",
        title: _(msg`Attendance Thresholds`),
        description: _(msg`Configure how attendance rules are calculated.`),
      },
    ],
  } as const;

  return def;
}
