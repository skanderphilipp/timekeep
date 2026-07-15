import { IconCheck, IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./display.module.scss";

type BooleanDisplayProps = {
  value: boolean | null | undefined;
};

/**
 * Read-only boolean display — checkmark for true, X for false.
 *
 * Returns an empty container for null/undefined values
 * (preserves cell height without showing misleading state).
 */
export function BooleanDisplay({ value }: BooleanDisplayProps) {
  const { _ } = useLingui();

  if (value === null || value === undefined) {
    return <span data-slot="boolean-display" className={styles.displayContainer} />;
  }

  const isTrue = value === true;

  return (
    <span data-slot="boolean-display" className={styles.displayContainer}>
      {isTrue ? <IconCheck size={14} /> : <IconX size={14} />}
      <span className={styles.booleanLabel}>
        {isTrue ? _(msg`Yes`) : _(msg`No`)}
      </span>
    </span>
  );
}
