import { ListError } from "@/modules/shared/components";
type ReportErrorProps = {
  onRetry: () => void;
};

export function ReportError({ onRetry }: ReportErrorProps) {
  return <ListError resource="report data" onRetry={onRetry} />;
}
