import { clsx } from "clsx";

import styles from "./cells.module.scss";

export type TextCellProps = {
  /** Display text. */
  text: string;
  /** When true, renders as a clickable link-style cell. */
  clickable?: boolean;
  /** Called when a clickable cell is clicked. */
  onClick?: () => void;
  className?: string;
};

/**
 * Generic text cell. When `clickable` is true, renders as an
 * interactive link-styled element (for device SNs, employee names, etc.).
 */
export function TextCell({ text, clickable, onClick, className }: TextCellProps) {
  if (clickable && onClick) {
    return (
      <button
        data-slot="text-cell-button"
        type="button"
        className={clsx(styles.clickableText, className)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {text}
      </button>
    );
  }

  return <span data-slot="text-cell" className={clsx(styles.text, className)}>{text}</span>;
}
