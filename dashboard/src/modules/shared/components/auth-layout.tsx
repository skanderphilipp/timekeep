/**
 * AuthLayout — shared shell for login and setup pages.
 *
 * Provides consistent branding (logo + workspace label), an animated
 * background, and a centered content slot for the auth form.
 */
import { type ReactNode } from "react";
import { TimeKeepLogo } from "./timekeep-logo";
import { AuthBackground } from "./auth-background";
import styles from "./auth-layout.module.scss";

type AuthLayoutProps = {
  children: ReactNode;
  workspace: string;
};

export function AuthLayout({ children, workspace }: AuthLayoutProps) {
  return (
    <div data-slot="auth-layout" className={styles.layout}>
      {/* Animated background decoration */}
      <AuthBackground />

      <main data-slot="auth-main" className={styles.main}>
        {/* Branding header */}
        <header data-slot="auth-brand" className={styles.brand}>
          <TimeKeepLogo className={styles.logo} />
          <span data-slot="auth-workspace" className={styles.workspace}>
            {workspace}
          </span>
        </header>

        {/* Auth form slot */}
        <div data-slot="auth-card" className={styles.card}>
          {children}
        </div>
      </main>
    </div>
  );
}
