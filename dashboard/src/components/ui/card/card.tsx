import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

import styles from "./card.module.scss";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** When true, applies cursor: pointer for clickable cards. */
  clickable?: boolean;
} & HTMLAttributes<HTMLDivElement>;

type CardContentProps = CardProps;

export function Card({ children, className, clickable, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={clsx(styles.card, clickable && styles.clickable, className)}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div data-slot="card-header" className={styles.header}>
      <div data-slot="card-header-info">
        <h3 data-slot="card-title" className={styles.title}>
          {title}
        </h3>
        {subtitle && (
          <p data-slot="card-subtitle" className={styles.subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div data-slot="card-header-action">{action}</div>}
    </div>
  );
}

function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div data-slot="card-content" className={clsx(styles.content, className)} {...props}>
      {children}
    </div>
  );
}

type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div data-slot="card-footer" className={clsx(styles.footer, className)}>
      {children}
    </div>
  );
}

Card.displayName = "Card";
CardHeader.displayName = "Card.Header";
CardContent.displayName = "Card.Content";
CardFooter.displayName = "Card.Footer";

Card.Header = CardHeader;
Card.Content = CardContent;
Card.Footer = CardFooter;
