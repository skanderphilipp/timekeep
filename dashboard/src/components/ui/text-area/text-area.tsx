import { clsx } from "clsx";
import { forwardRef, type TextareaHTMLAttributes } from "react";

import styles from "./text-area.module.scss";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="text-area"
        className={clsx(styles.textarea, className)}
        {...rest}
      />
    );
  },
);

TextArea.displayName = "TextArea";
