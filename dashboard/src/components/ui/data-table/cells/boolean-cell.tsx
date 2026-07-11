import { IconCheck, IconX } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import styles from "./boolean-cell.module.scss";

export type BooleanCellProps = {
  value: boolean | null | undefined;
};

/**
 * 1:1 port of Reaktly's BooleanDisplay.
 *
 * Renders a checkmark + "True" or cross + "False" for boolean values.
 * Returns an empty container when the value is null/undefined.
 */
export function BooleanCell({ value }: BooleanCellProps) {
  const { _ } = useLingui();

  if (value === null || value === undefined) {
    return <div className={styles.container} />;
  }

  const isTrue = value === true;

  return (
    <div className={styles.container}>
      {isTrue ? <IconCheck size={14} /> : <IconX size={14} />}
      <span className={styles.label}>{isTrue ? _(msg`True`) : _(msg`False`)}</span>
    </div>
  );
}
