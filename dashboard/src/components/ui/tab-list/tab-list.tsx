import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { clsx } from "clsx";

import styles from "./tab-list.module.scss";

// ── Context ────────────────────────────────────────────────────────────────────

type TabContextType = {
  activeTab: string;
  setActiveTab: (id: string) => void;
};

const TabContext = createContext<TabContextType | null>(null);

function useTabContext() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error("Tab components must be used within <TabList>");
  return ctx;
}

// ── TabList (container) ────────────────────────────────────────────────────────

type TabListProps = {
  children: ReactNode;
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
};

export function TabList({
  children,
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  className,
}: TabListProps) {
  const [internalTab, setInternalTab] = useState(defaultTab ?? "");
  const activeTab = controlledTab ?? internalTab;

  const setActiveTab = useCallback(
    (id: string) => {
      if (!controlledTab) setInternalTab(id);
      onTabChange?.(id);
    },
    [controlledTab, onTabChange],
  );

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <div data-slot="tab-list" className={clsx(styles.list, className)} role="tablist">
        {children}
      </div>
    </TabContext.Provider>
  );
}

// ── Tab (trigger) ──────────────────────────────────────────────────────────────

type TabProps = {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Tab({ id, children, disabled, className }: TabProps) {
  const { activeTab, setActiveTab } = useTabContext();
  const isActive = activeTab === id;

  return (
    <button
      data-slot="tab"
      data-active={isActive || undefined}
      className={clsx(styles.tab, isActive && styles.tabActive, className)}
      onClick={() => setActiveTab(id)}
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      type="button"
    >
      {children}
    </button>
  );
}

// ── TabPanel (content) ─────────────────────────────────────────────────────────

type TabPanelProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export function TabPanel({ id, children, className }: TabPanelProps) {
  const { activeTab } = useTabContext();
  const isActive = activeTab === id;

  return (
    <div
      data-slot="tab-panel"
      className={clsx(styles.panel, isActive && styles.panelActive, className)}
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={id}
      hidden={!isActive}
    >
      {children}
    </div>
  );
}
