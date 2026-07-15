import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { ListLoading } from "@/components/ui";

/**
 * Activity feed loading state — spinner with descriptive text.
 */
export function ActivityLoading() {
  const { _ } = useLingui();

  return <ListLoading size="md" label={_(msg`Loading device activity…`)} />;
}
