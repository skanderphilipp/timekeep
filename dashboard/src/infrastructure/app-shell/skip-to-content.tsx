import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import styles from "@/app-shell.module.scss";

/** Accessibility skip link — first focusable element on the page. */
export function SkipToContent() {
  const { _ } = useLingui();
  return (
    <a data-slot="skip-to-content" className={styles.skipLink} href="#main-content">
      {_(msg`Skip to content`)}
    </a>
  );
}
