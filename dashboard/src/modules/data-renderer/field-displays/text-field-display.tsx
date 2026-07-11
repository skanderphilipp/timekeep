import { Text } from "@/components/ui";

type TextFieldDisplayProps = {
  value: unknown;
};

/**
 * Plain text field display — default fallback.
 *
 * Renders the string value directly. Used for fields like
 * verify_mode labels, work codes, etc.
 */
export function TextFieldDisplay({ value }: TextFieldDisplayProps) {
  const text = value != null ? String(value) : "";
  return (
    <Text variant="body" color="primary">
      {text || "-"}
    </Text>
  );
}
