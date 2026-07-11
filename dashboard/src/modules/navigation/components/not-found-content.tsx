import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconRouteOff } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { EmptyState, Button } from "@/components/ui";

/**
 * 404 content — message plus a way back to the dashboard.
 */
export function NotFoundContent() {
  const { _ } = useLingui();

  return (
    <EmptyState
      icon={<IconRouteOff size={48} stroke={1.5} />}
      title={_(msg`Page not found`)}
      description={_(msg`The page you are looking for doesn't exist or has been moved.`)}
      action={
        <Button to={AppRoute.dashboard} variant="primary">
          {_(msg`Go to Dashboard`)}
        </Button>
      }
    />
  );
}
