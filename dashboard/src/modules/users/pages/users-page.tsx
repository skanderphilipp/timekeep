import { PageLayout, PageBody } from "@/components/layout";
import { UsersView } from "../components/users-view";

export function UsersPage() {
  return (
    <PageLayout>
      <PageBody>
        <UsersView />
      </PageBody>
    </PageLayout>
  );
}
