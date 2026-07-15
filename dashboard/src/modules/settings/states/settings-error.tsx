import { ListError } from "@/modules/shared/components";
type SettingsErrorProps = {
  onRetry: () => void;
  /** Which section failed (for context in the message). */
  section: string;
};

export function SettingsError({ onRetry, section }: SettingsErrorProps) {
  return <ListError resource={section} onRetry={onRetry} />;
}
