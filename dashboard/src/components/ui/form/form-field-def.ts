// Moved to src/types/form-field-def.ts so lib/ can consume these
// without depending on the components layer. Re-exported here for UI consumers.
export type {
  FormFieldDef,
  FormTextFieldDef,
  FormNumberFieldDef,
  FormIpPortFieldDef,
  FormBooleanFieldDef,
  FormSelectFieldDef,
  FormMultiSelectFieldDef,
  FormPermissionsFieldDef,
  FormExpiryFieldDef,
  FormDateFieldDef,
  FormPasswordFieldDef,
} from "@/types/form-field-def";
