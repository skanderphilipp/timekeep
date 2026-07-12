import { type ReactNode } from "react";
import { clsx } from "clsx";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import styles from "./tab-list.module.scss";

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
 * Tabs — accessible tab container built on @base-ui/react Tabs.
 *
 * Automatically wraps `<Tab>` children in a `<Tabs.List>` with an active
 * underline `<Tabs.Indicator>`. `<TabPanel>` children render after the list.
 *
 * @example
 * <Tabs defaultValue="overview">
 *   <Tab value="overview">Overview</Tab>
 *   <Tab value="details">Details</Tab>
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

  // Separate <Tab> children into the list, everything else into panels
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
        <TabsPrimitive.Indicator data-slot="tabs-indicator" className={styles.indicator} />
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
  disabled?: boolean;
  className?: string;
};

export function Tab({ value, disabled, className, children }: TabProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tab"
      value={value}
      disabled={disabled}
      className={clsx(styles.tab, className)}
    >
      {children}
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

// ── Backward compatibility ─────────────────────────────────────────────────────

export { Tabs as TabList };

// ── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Separates React children into tab triggers and panel content.
 *
 * Children whose `type` is the `Tab` function component go into `tabs`;
 * everything else (including `<TabPanel>`, text nodes, fragments) goes into
 * `panels`. Non-element children (null, booleans) are skipped.
 */
function childrenToSlots(
  children: ReactNode,
  tabs: ReactNode[],
  panels: ReactNode[],
): void {
  const kids = Array.isArray(children)
    ? children
    : children != null
      ? [children]
      : [];
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
