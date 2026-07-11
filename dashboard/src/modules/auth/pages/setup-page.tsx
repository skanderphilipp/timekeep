import { SetupForm } from "../components/setup-form";
import { useSetupPage } from "../hooks/use-setup-page";
import styles from "./login-page.module.scss";

/**
 * First-run setup page — shown when no admin user exists.
 *
 * Delegates status checking to useSetupPage and account creation to SetupForm.
 */
export function SetupPage() {
  const { checking, needed } = useSetupPage();

  if (checking) {
    return (
      <section data-slot="login-page" className={styles.page}>
        <main data-slot="login-main" className={styles.main}>
          {/* Spinner handled by parent full-page loading state — empty main for consistency */}
        </main>
      </section>
    );
  }

  if (!needed) return null;

  return (
    <section data-slot="login-page" className={styles.page}>
      <main data-slot="login-main" className={styles.main}>
        <SetupForm />
      </main>
    </section>
  );
}
