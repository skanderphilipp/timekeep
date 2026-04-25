import { useLocation, Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";

import { isAuthenticatedAtom } from "@/infrastructure/state";
import { LoginForm } from "@/modules/auth/components/login-form";
import styles from "./login-page.module.scss";

export function LoginPage() {
  const location = useLocation();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <section data-slot="login-page" className={styles.page}>
      <main data-slot="login-main" className={styles.main}>
        <LoginForm />
      </main>
    </section>
  );
}
