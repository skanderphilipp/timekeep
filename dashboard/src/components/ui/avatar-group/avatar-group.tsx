import { type ReactNode } from "react";

import styles from "./avatar-group.module.scss";

export type AvatarGroupProps = {
  /** Avatar elements (typically `<Avatar />` components). */
  avatars: ReactNode[];
};

const MAX_VISIBLE = 4;

/**
 * 1:1 port of Reaktly's AvatarGroup.
 *
 * Stacks avatar elements with a consistent -3px overlap.
 * Only the first 4 avatars are rendered.
 */
export function AvatarGroup({ avatars }: AvatarGroupProps) {
  if (!avatars.length) return null;

  return (
    <div data-slot="avatar-group" className={styles.container}>
      {avatars.slice(0, MAX_VISIBLE).map((avatar, index) => (
        <div className={styles.itemContainer} key={index}>
          {avatar}
        </div>
      ))}
    </div>
  );
}
