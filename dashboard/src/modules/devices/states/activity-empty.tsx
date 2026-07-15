import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section, EmptyState, Text } from "@/components/ui";

/**
 * Activity feed empty state — shown when a device has no activity events yet.
 */
export function ActivityEmpty() {
  const { _ } = useLingui();

  return (
    <Section>
      <EmptyState
        title={_(msg`No Activity Yet`)}
        action={
          <Text variant="caption" color="tertiary">
            {_(
              msg`Device activity will appear here once the engine starts collecting events.`,
            )}
          </Text>
        }
      />
    </Section>
  );
}
