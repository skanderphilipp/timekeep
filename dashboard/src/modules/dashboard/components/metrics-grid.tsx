import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui";

type MetricsGridProps = {
  children: ReactNode;
};

export function MetricsGrid({ children }: MetricsGridProps) {
  return <CardGrid>{children}</CardGrid>;
}
