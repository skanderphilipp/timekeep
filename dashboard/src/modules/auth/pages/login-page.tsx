import { Navigate } from "react-router-dom";

import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { LoginForm } from "@/modules/auth/components/login-form";
import { useLoginPage } from "@/modules/auth/hooks/use-login-page";
import { WORKSPACE_NAME } from "@/lib/constants";

export function LoginPage() {
  const { isAuthenticated, from, about } = useLoginPage();

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const workspace = about?.workspace_name || WORKSPACE_NAME;

  return (
    <AuthLayout workspace={workspace}>
      <LoginForm />
    </AuthLayout>
  );
}
