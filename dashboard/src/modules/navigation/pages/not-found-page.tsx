import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconRouteOff } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { PageLayout, PageBody, EmptyState, Button } from "@/components/ui";

/**
 * 404 Not Found page.
 *
 * Rendered for any unmatched route inside the authenticated app shell.
 * Gives the user a clear message and a way back to the dashboard.
 */
export function NotFoundPage() {
  const { _ } = useLingui();

  return (
    <PageLayout>
      <PageBody>
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
      </PageBody>
    </PageLayout>
  );
}
