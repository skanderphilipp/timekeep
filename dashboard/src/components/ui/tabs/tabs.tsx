import { type ReactNode } from "react";
import { clsx } from "clsx";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import styles from "./tabs.module.scss";

// ── Tabs (Root) ─────────────────────────────────────────────────────────────────

type TabsProps = {
  children?: ReactNode;
  /** Explicit tab trigger items — bypasses children-based type detection. */
  tabItems?: ReactNode[];
  /** Explicit panel items — bypasses children-based type detection. */
  panelItems?: ReactNode[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

/**
 * Tabs — accessible tabbed content built on @base-ui/react Tabs.
 *
 * Supports two APIs:
 * 1. **Children-based** (declarative):
 *    `<Tabs><Tab>...</Tab><TabPanel>...</TabPanel></Tabs>`
 *    Uses `isTabElement` type detection to separate Tab triggers from panels.
 *
 * 2. **Imperative** (explicit arrays):
 *    `<Tabs tabItems={[...]} panelItems={[...]} />`
 *    Bypasses type detection — reliable across all environments.
 *    When using this API, `children` are rendered as extra content after
 *    the panels (legacy support for arbitrary React nodes).
 *
 * @example Imperative (recommended for programmatic rendering)
 * <Tabs
 *   defaultValue="info"
 *   tabItems={[<Tab key="info" value="info">Info</Tab>]}
 *   panelItems={[<TabPanel key="info" value="info">Content</TabPanel>]}
 * />
 */
export function Tabs({
  children,
  tabItems,
  panelItems,
  defaultValue,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
}: TabsProps) {
  const tabs: ReactNode[] = [];
  const panels: ReactNode[] = [];
  let isImperative = false;

  if (tabItems && panelItems) {
    // Imperative API — explicit arrays, no type detection needed
    tabs.push(...tabItems);
    panels.push(...panelItems);
    isImperative = true;
  } else if (children) {
    // Declarative API — separate children by type
    childrenToSlots(children, tabs, panels);
  }

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      orientation={orientation}
      className={clsx(styles.root, className)}
    >
      <TabsPrimitive.List data-slot="tabs-list" className={styles.list}>
        {tabs}
      </TabsPrimitive.List>
      {panels}
      {/* In imperative mode, children are extra content rendered after panels */}
      {isImperative && children}
    </TabsPrimitive.Root>
  );
}

Tabs.displayName = "Tabs";

// ── Tab ────────────────────────────────────────────────────────────────────────

type TabProps = {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Tab({ value, icon, disabled, className, children }: TabProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tab"
      value={value}
      disabled={disabled}
      className={clsx(styles.tab, className)}
    >
      {icon && <span data-slot="tab-icon" className={styles.icon}>{icon}</span>}
      <span data-slot="tab-label" className={styles.label}>{children}</span>
    </TabsPrimitive.Tab>
  );
}

Tab.displayName = "Tab";

// ── TabPanel ────────────────────────────────────────────────────────────────────

type TabPanelProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function TabPanel({ value, className, children }: TabPanelProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tab-panel"
      value={value}
      className={clsx(styles.panel, className)}
    >
      {children}
    </TabsPrimitive.Panel>
  );
}

TabPanel.displayName = "TabPanel";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function childrenToSlots(children: ReactNode, tabs: ReactNode[], panels: ReactNode[]): void {
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  for (const child of kids) {
    if (child == null || child === false || child === "") continue;
    if (isTabElement(child)) {
      tabs.push(child);
    } else {
      panels.push(child);
    }
  }
}

function isTabElement(child: unknown): boolean {
  if (typeof child !== "object" || child === null || !("type" in child)) {
    return false;
  }
  const type = (child as { type: unknown }).type;
  if (type === Tab) return true;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    if (fn.displayName === "Tab" || fn.name === "Tab") return true;
  }
  return false;
}
