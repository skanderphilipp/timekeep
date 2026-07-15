import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { SetupForm } from "../components/setup-form";
import { useSetupPage } from "../hooks/use-setup-page";
import { WORKSPACE_NAME } from "@/lib/constants";

/**
 * First-run setup page — shown when no admin user exists.
 *
 * Delegates status checking to useSetupPage and account creation to SetupForm.
 */
export function SetupPage() {
  const { checking, needed } = useSetupPage();

  if (checking || !needed) return null;

  return (
    <AuthLayout workspace={WORKSPACE_NAME}>
      <SetupForm />
    </AuthLayout>
  );
}
