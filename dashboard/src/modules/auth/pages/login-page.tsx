import { Navigate } from "react-router-dom";

import { LoginForm } from "@/modules/auth/components/login-form";
import { useLoginPage } from "@/modules/auth/hooks/use-login-page";
import styles from "./login-page.module.scss";

export function LoginPage() {
  const { isAuthenticated, from } = useLoginPage();

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
