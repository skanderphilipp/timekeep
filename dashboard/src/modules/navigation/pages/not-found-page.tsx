import { PageShell } from "@/components/layout";
import { NotFoundContent } from "../components/not-found-content";

/**
 * 404 Not Found page.
 *
 * Rendered for any unmatched route inside the authenticated app shell.
 */
export function NotFoundPage() {
  return (
    <PageShell>
      <NotFoundContent />
    </PageShell>
  );
}
