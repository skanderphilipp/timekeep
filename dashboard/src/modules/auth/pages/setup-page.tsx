import { useAtomValue } from "jotai";

import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { SetupForm } from "../components/setup-form";
import { useSetupPage } from "../hooks/use-setup-page";
import { clientConfigState } from "@/infrastructure/state";
import { WORKSPACE_NAME } from "@/lib/constants";

/**
 * First-run setup page — shown when no admin user exists.
 *
 * Delegates status checking to useSetupPage and account creation to SetupForm.
 * Workspace name comes from the bootstrap client config, falling back to the
 * compile-time constant if the server hasn't responded yet.
 */
export function SetupPage() {
  const { checking, needed } = useSetupPage();
  const clientConfig = useAtomValue(clientConfigState.atom);

  if (checking || !needed) return null;

  const workspace = clientConfig?.workspace_name || WORKSPACE_NAME;

  return (
    <AuthLayout workspace={workspace}>
      <SetupForm />
    </AuthLayout>
  );
}
