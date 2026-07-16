import { Navigate } from "react-router-dom";

import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { LoginForm } from "@/modules/auth/components/login-form";
import { useLoginPage } from "@/modules/auth/hooks/use-login-page";

export function LoginPage() {
  const { isAuthenticated, from, workspace } = useLoginPage();

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <AuthLayout workspace={workspace}>
      <LoginForm />
    </AuthLayout>
  );
}
