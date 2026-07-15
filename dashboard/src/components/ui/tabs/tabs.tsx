import { type ReactNode } from "react";
import { clsx } from "clsx";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import styles from "./tabs.module.scss";

// ── Tabs (Root) ─────────────────────────────────────────────────────────────────

type TabsProps = {
  children: ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

/**
 * Tabs — accessible tabbed content built on @base-ui/react Tabs.
 *
 * Supports icons via `<Tab icon={...}>`. The active tab is indicated by
 * a background color (pill style) and primary text color — always clearly
 * distinguishable from inactive tabs.
 *
 * Built-in keyboard navigation (arrow keys, Home/End), roving tabindex,
 * and animated transitions.
 *
 * @example
 * <Tabs defaultValue="overview">
 *   <Tab value="overview" icon={<IconUser size={16} />}>Overview</Tab>
 *   <Tab value="details" icon={<IconInfoCircle size={16} />}>Details</Tab>
 *   <TabPanel value="overview">Overview content</TabPanel>
 *   <TabPanel value="details">Details content</TabPanel>
 * </Tabs>
 */
export function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
}: TabsProps) {
  const tabs: ReactNode[] = [];
  const panels: ReactNode[] = [];

  childrenToSlots(children, tabs, panels);

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
    </TabsPrimitive.Root>
  );
}

Tabs.displayName = "Tabs";

// ── Tab ────────────────────────────────────────────────────────────────────────

type TabProps = {
  value: string;
  children: ReactNode;
  /** Optional icon rendered before the tab label. Inherits the tab's color. */
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

/**
 * Separates React children into tab triggers and panel content.
 *
 * Children whose `type` is the `Tab` function component go into `tabs`;
 * everything else (including `<TabPanel>`, text nodes, fragments) goes into
 * `panels`. Non-element children (null, booleans) are skipped.
 */
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
  return (
    typeof child === "object" &&
    child !== null &&
    "type" in child &&
    (child as { type: unknown }).type === Tab
  );
}
