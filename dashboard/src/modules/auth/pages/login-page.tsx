import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { LoginForm } from "@/modules/auth/components/login-form";
import { useLoginPage } from "@/modules/auth/hooks/use-login-page";
import { fetchAbout } from "@/modules/auth/api/about";
import { WORKSPACE_NAME } from "@/lib/constants";

export function LoginPage() {
  const { isAuthenticated, from } = useLoginPage();

  const { data: about } = useQuery({
    queryKey: ["about"],
    queryFn: fetchAbout,
    staleTime: 60_000,
  });

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
