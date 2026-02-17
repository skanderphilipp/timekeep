import { clsx } from "clsx";

import styles from "./avatar.module.scss";

type AvatarProps = {
  /** Full name — used to derive initials. */
  name: string;
  /** Image URL. When provided, replaces initials. */
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  return (
    <span
      data-slot="avatar"
      className={clsx(styles.avatar, styles[size], className)}
      aria-label={name}
      role="img"
    >
      {src ? (
        <img data-slot="avatar-image" className={styles.image} src={src} alt={name} />
      ) : (
        <span data-slot="avatar-initials" className={styles.initials}>
          {initials}
        </span>
      )}
    </span>
  );
}
