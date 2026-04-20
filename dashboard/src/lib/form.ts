import { useForm, type UseFormProps, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

/**
 * Thin wrapper around react-hook-form with zod schema validation.
 *
 * Uses a type assertion for the resolver because @hookform/resolvers v5.x
 * has incomplete type compatibility with Zod 4.x. The runtime behavior is
 * correct — this is purely a type-level issue tracked at:
 * https://github.com/react-hook-form/resolvers/issues/717
 *
 * @param schema — A Zod schema whose output extends `FieldValues` (i.e., an object).
 * @param options — Standard react-hook-form options (excluding `resolver`).
 *
 * @example
 * ```ts
 * const schema = z.object({ name: z.string().min(1) });
 * const form = useZodForm(schema, { defaultValues: { name: "" } });
 * ```
 */
export function useZodForm<T extends FieldValues>(
  schema: z.ZodType<T>,
  options?: Omit<UseFormProps<T>, "resolver">,
) {
  return useForm<T>({
    ...options,
    // TODO(ENTERPRISE): Remove `as never` cast when @hookform/resolvers
    // ships full Zod 4.x type support.
    // Phase: Dependency upgrade
    // Impact: Minimal — types are structurally equivalent at runtime.
    // Fix: Upgrade @hookform/resolvers and remove the cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
  });
}

/** Re-export common types consumers need. */
export type { UseFormReturn, FieldErrors, SubmitHandler } from "react-hook-form";
