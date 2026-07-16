import { Text } from "@/components/ui";

type TextFieldDisplayProps = {
  value: unknown;
};

/**
 * Plain text field display — default fallback for `text` and `number` types.
 *
 * Renders the value as plain text. For clickable/navigable fields,
 * use `ReferenceFieldDisplay` with `type: "reference"` metadata.
 */
export function TextFieldDisplay({ value }: TextFieldDisplayProps) {
  const text = value != null ? String(value) : "";

  return (
    <Text
      variant="body"
      color="primary"
      weight="regular"
    >
      {text || "-"}
    </Text>
  );
}
