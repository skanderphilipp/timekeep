import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";

import type { ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";
import styles from "@/infrastructure/app-shell/app-sidebar.module.scss";

// ── NavItem (leaf) ────────────────────────────────────────────────────────────

export function NavLeaf({
  item,
  collapsed,
  onClick,
}: {
  item: ResolvedNavItem;
  collapsed: boolean;
  onClick: () => void;
}) {
  if (!item.path) return null;

  return (
    <NavLink
      key={item.key}
      to={item.path!}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(styles.navItem, !item.icon && styles.navItemNested, isActive && styles.navItemActive)
      }
      title={collapsed ? item.label() : undefined}
    >
      {item.icon && <item.icon data-slot="nav-icon" size={20} />}
      {!collapsed && <span data-slot="nav-label">{item.label()}</span>}
    </NavLink>
  );
}

// ── NavGroup (collapsible parent) ─────────────────────────────────────────────

export function NavGroup({
  item,
  collapsed,
  closeSidebar,
}: {
  item: ResolvedNavItem;
  collapsed: boolean;
  closeSidebar: () => void;
}) {
  const location = useLocation();
  const isChildActive =
    item.children?.some((c) => location.pathname.startsWith(c.path ?? "")) ?? false;
  const [expanded, setExpanded] = useState(isChildActive);

  if (collapsed) {
    // When collapsed, show only the parent icon (no expand)
    return (
      <div data-slot="nav-group-collapsed" className={styles.navGroupCollapsed}>
        <div className={clsx(styles.navItem, isChildActive && styles.navItemActive)}>
          {item.icon && <item.icon data-slot="nav-icon" size={20} />}
        </div>
        {item.children?.map((child) => (
          <NavLeaf key={child.key} item={child} collapsed={collapsed} onClick={closeSidebar} />
        ))}
      </div>
    );
  }

  return (
    <div data-slot="nav-group" className={styles.navGroup}>
      <button
        data-slot="nav-group-header"
        className={clsx(styles.navGroupHeader, isChildActive && styles.navGroupHeaderActive)}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {item.icon && <item.icon data-slot="nav-icon" size={20} />}
        <span data-slot="nav-label" className={styles.navGroupLabel}>
          {item.label()}
        </span>
        <IconChevronDown
          size={14}
          className={clsx(styles.navGroupChevron, expanded && styles.navGroupChevronOpen)}
        />
      </button>
      {expanded && (
        <div data-slot="nav-group-children" className={styles.navGroupChildren}>
          {item.children?.map((child) => (
            <NavLeaf key={child.key} item={child} collapsed={false} onClick={closeSidebar} />
          ))}
        </div>
      )}
    </div>
  );
}
