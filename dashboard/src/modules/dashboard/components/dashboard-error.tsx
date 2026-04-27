import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, IconButton } from "@/components/ui";
import { Banner } from "@/components/ui/banner";
import { IconRefresh } from "@tabler/icons-react";

type DashboardErrorProps = {
  onRetry: () => void;
};

export function DashboardError({ onRetry }: DashboardErrorProps) {
  const { _ } = useLingui();

  return (
    <Section>
      <Banner variant="danger">
        {_(msg`Failed to load dashboard data.`)}
      </Banner>
      <IconButton onClick={onRetry} aria-label={_(msg`Retry`)}>
        <IconRefresh size={16} />
      </IconButton>
    </Section>
  );
}
