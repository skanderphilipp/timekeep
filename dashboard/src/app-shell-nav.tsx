import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";

import type { ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";
import { Tooltip } from "@/components/ui/tooltip";
import styles from "@/infrastructure/app-shell/app-sidebar.module.scss";

// ── NavLeaf ───────────────────────────────────────────────────────────────────

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

  /** Whether this is a nested child item (no icon = child of a group). */
  const isNested = !item.icon;

  const link = (
    <NavLink
      key={item.key}
      to={item.path}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          styles.navItem,
          collapsed && styles.navItemCollapsed,
          collapsed && isNested && styles.navItemCollapsedNested,
          !collapsed && isNested && styles.navItemNested,
          isActive && styles.navItemActive,
        )
      }
      aria-label={collapsed ? item.label() : undefined}
    >
      {item.icon && <item.icon data-slot="nav-icon" size={20} />}
      {collapsed && isNested && (
        <span data-slot="nav-dot" className={styles.navItemDot} aria-hidden="true">
          &bull;
        </span>
      )}
      {!collapsed && <span data-slot="nav-label">{item.label()}</span>}
    </NavLink>
  );

  // In collapsed mode, wrap with Tooltip
  if (collapsed) {
    return (
      <Tooltip content={item.label()} side="right">
        {link}
      </Tooltip>
    );
  }

  return link;
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

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
  const [isOpen, setIsOpen] = useState(isChildActive);
  const childrenRef = useRef<HTMLDivElement>(null);

  // Auto-expand when a child becomes active (e.g., deep link)
  useEffect(() => {
    if (isChildActive && !isOpen) {
      setIsOpen(true);
    }
  }, [isChildActive, isOpen]);

  // ── Collapsed mode: parent icon header + children as icon-less links ─
  if (collapsed) {
    return (
      <>
        {/* Parent icon with tooltip */}
        <Tooltip content={item.label()} side="right">
          <div
            data-slot="nav-group-collapsed"
            className={clsx(
              styles.navGroupCollapsedIcon,
              isChildActive && styles.navGroupCollapsedIconActive,
            )}
            aria-label={item.label()}
          >
            {item.icon && <item.icon data-slot="nav-icon" size={20} />}
          </div>
        </Tooltip>

        {/* Children — individual icon-less links */}
        {item.children?.map((child) => (
          <NavLeaf
            key={child.key}
            item={child}
            collapsed
            onClick={closeSidebar}
          />
        ))}
      </>
    );
  }

  // ── Expanded mode: collapsible group ────────────────────────────────
  return (
    <div data-slot="nav-group" className={styles.navGroup}>
      <button
        data-slot="nav-group-header"
        className={clsx(
          styles.navGroupHeader,
          isChildActive && styles.navGroupHeaderActive,
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        {item.icon && <item.icon data-slot="nav-icon" size={20} />}
        <span data-slot="nav-label" className={styles.navGroupLabel}>
          {item.label()}
        </span>
        <IconChevronDown
          size={14}
          className={clsx(
            styles.navGroupChevron,
            isOpen && styles.navGroupChevronOpen,
          )}
        />
      </button>

      {/* Animated children container */}
      <div
        ref={childrenRef}
        data-slot="nav-group-children"
        className={styles.navGroupChildren}
        style={{
          maxHeight: isOpen ? `${childrenRef.current?.scrollHeight ?? 200}px` : "0px",
        }}
      >
        {item.children?.map((child) => (
          <NavLeaf
            key={child.key}
            item={child}
            collapsed={false}
            onClick={closeSidebar}
          />
        ))}
      </div>
    </div>
  );
}
