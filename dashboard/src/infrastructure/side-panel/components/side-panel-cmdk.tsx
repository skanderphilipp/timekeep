import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconReport,
  IconSettings,
  IconPlus,
  IconUsers,
  IconKey,
  IconHistory,
  type Icon,
} from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { clsx } from "clsx";

import { AppRoute } from "@/lib/navigation";
import { SearchInput } from "@/components/ui/search-input/search-input";
import styles from "./side-panel-cmdk.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: Icon;
  keywords: string[];
  action: () => void;
};

type SidePanelCmdkProps = {
  onClose: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Side panel command palette view.
 *
 * Renders inside the right side panel (not a modal dialog). Press Cmd+K
 * to open the panel with this view, then search + navigate via keyboard.
 * Replaces the old standalone CommandPaletteDialog entirely.
 */
export function SidePanelCmdk({ onClose }: SidePanelCmdkProps) {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Build i18n'd command items
  const items: CommandItem[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: _(msg`Dashboard`),
        description: _(msg`Attendance overview`),
        icon: IconDashboard,
        keywords: ["home", "overview"],
        action: () => {
          onClose();
          navigate(AppRoute.dashboard);
        },
      },
      {
        id: "devices",
        label: _(msg`Devices`),
        description: _(msg`Manage biometric scanners`),
        icon: IconDevices,
        keywords: ["scanner", "hardware"],
        action: () => {
          onClose();
          navigate(AppRoute.devices.list);
        },
      },
      {
        id: "devices-add",
        label: _(msg`Add Device`),
        description: _(msg`Register a new scanner`),
        icon: IconPlus,
        keywords: ["new", "register", "scanner"],
        action: () => {
          onClose();
          navigate(AppRoute.devices.new);
        },
      },
      {
        id: "punches",
        label: _(msg`Punch Records`),
        description: _(msg`View and query attendance data`),
        icon: IconFingerprint,
        keywords: ["attendance", "records", "check-in"],
        action: () => {
          onClose();
          navigate(AppRoute.punches.list);
        },
      },
      {
        id: "users",
        label: _(msg`Users`),
        description: _(msg`Manage dashboard accounts`),
        icon: IconUsers,
        keywords: ["accounts", "roles", "admin"],
        action: () => {
          onClose();
          navigate(AppRoute.settings.users);
        },
      },
      {
        id: "api-keys",
        label: _(msg`API Keys`),
        description: _(msg`Manage integration keys`),
        icon: IconKey,
        keywords: ["integrations", "tokens"],
        action: () => {
          onClose();
          navigate(AppRoute.settings.apiKeys);
        },
      },
      {
        id: "audit-log",
        label: _(msg`Audit Log`),
        description: _(msg`View activity history`),
        icon: IconHistory,
        keywords: ["history", "activity", "events"],
        action: () => {
          onClose();
          navigate(AppRoute.legacy.audit);
        },
      },
      {
        id: "reports",
        label: _(msg`Reports`),
        description: _(msg`Attendance reports and exports`),
        icon: IconReport,
        keywords: ["export", "csv", "summary"],
        action: () => {
          onClose();
          navigate(AppRoute.reports);
        },
      },
      {
        id: "settings",
        label: _(msg`Settings`),
        description: _(msg`Application configuration`),
        icon: IconSettings,
        keywords: ["config", "preferences"],
        action: () => {
          onClose();
          navigate(AppRoute.settings.system);
        },
      },
    ],
    [_],
  );

  // Filter by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q)),
    );
  }, [items, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div data-slot="side-panel-cmdk" className={styles.container} onKeyDown={handleKeyDown}>
      <div data-slot="cmdk-search" className={styles.search}>
        <SearchInput
          ref={inputRef}
          placeholder={_(msg`Search commands…`)}
          value={query}
          onChange={setQuery}
        />
      </div>

      <div data-slot="cmdk-results" className={styles.results}>
        {filtered.length === 0 ? (
          <div data-slot="cmdk-empty" className={styles.empty}>
            {_(msg`No results found.`)}
          </div>
        ) : (
          filtered.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={item.id}
                data-slot="cmdk-item"
                data-selected={isSelected || undefined}
                className={clsx(styles.item, isSelected && styles.itemSelected)}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <item.icon data-slot="cmdk-item-icon" size={18} className={styles.itemIcon} />
                <div data-slot="cmdk-item-text" className={styles.itemText}>
                  <span data-slot="cmdk-item-label" className={styles.itemLabel}>
                    {item.label}
                  </span>
                  {item.description && (
                    <span data-slot="cmdk-item-desc" className={styles.itemDesc}>
                      {item.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
