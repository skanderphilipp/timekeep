import { useState, useMemo, useEffect, useRef } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { clsx } from "clsx";

import { SearchInput } from "@/components/ui/search-input/search-input";
import { useCommands } from "@/infrastructure/commands";
import type { Command } from "@/infrastructure/commands";
import styles from "./side-panel-cmdk.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

type SidePanelCmdkProps = {
  onClose: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Side panel command palette view.
 *
 * Renders inside the right side panel (not a modal dialog). Press Cmd+K
 * to open the panel with this view, then search + navigate via keyboard.
 *
 * Reads from the central {@link CommandRegistry}:
 * - Contextual commands (page-specific) are shown first
 * - Global commands (available everywhere) are shown after
 * - Search filters across both groups
 */
export function SidePanelCmdk({ onClose }: SidePanelCmdkProps) {
  const { _ } = useLingui();
  const { contextual, global } = useCommands();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Filter by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { contextual, global };
    const filterFn = (cmd: Command) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.toLowerCase().includes(q));
    return {
      contextual: contextual.filter(filterFn),
      global: global.filter(filterFn),
    };
  }, [contextual, global, query]);

  // Flat list for keyboard navigation
  const flatFiltered = useMemo(
    () => [...filtered.contextual, ...filtered.global],
    [filtered],
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
      e.preventDefault();
      flatFiltered[selectedIndex].action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const hasResults = flatFiltered.length > 0;
  const hasContextual = filtered.contextual.length > 0;
  const hasGlobal = filtered.global.length > 0;

  // Track flat index to determine which group an item belongs to
  // (reserved for future keyboard navigation that considers groups)

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
        {!hasResults ? (
          <div data-slot="cmdk-empty" className={styles.empty}>
            {_(msg`No results found.`)}
          </div>
        ) : (
          <CommandList
            query={query}
            contextual={filtered.contextual}
            global={filtered.global}
            flatFiltered={flatFiltered}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            hasContextual={hasContextual}
            hasGlobal={hasGlobal}
            _={_}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CommandList({
  query,
  contextual,
  global: globalCommands,
  flatFiltered,
  selectedIndex,
  setSelectedIndex,
  hasContextual,
  hasGlobal,
  _,
}: {
  query: string;
  contextual: Command[];
  global: Command[];
  flatFiltered: Command[];
  selectedIndex: number;
  setSelectedIndex: (i: number | ((prev: number) => number)) => void;
  hasContextual: boolean;
  hasGlobal: boolean;
  _: ReturnType<typeof useLingui>["_"];
}) {
  // When searching, flatten everything (no group headers)
  if (query.trim()) {
    return (
      <>
        {flatFiltered.map((item, index) => (
          <CommandItemButton
            key={item.id}
            item={item}
            isSelected={index === selectedIndex}
            onSelect={() => setSelectedIndex(index)}
          />
        ))}
      </>
    );
  }

  // No query: show contextual first, then global, with group headers
  return (
    <>
      {hasContextual && (
        <div data-slot="cmdk-group">
          <div data-slot="cmdk-group-label" className={styles.groupLabel}>
            {_(msg`Page commands`)}
          </div>
          {contextual.map((item, index) => {
            const flatIndex = index;
            const isSelected = flatIndex === selectedIndex;
            return (
              <CommandItemButton
                key={item.id}
                item={item}
                isSelected={isSelected}
                onSelect={() => setSelectedIndex(flatIndex)}
              />
            );
          })}
        </div>
      )}

      {hasGlobal && (
        <div data-slot="cmdk-group">
          {hasContextual && <div className={styles.groupDivider} />}
          <div data-slot="cmdk-group-label" className={styles.groupLabel}>
            {_(msg`All commands`)}
          </div>
          {globalCommands.map((item, index) => {
            const flatIndex = contextual.length + index;
            const isSelected = flatIndex === selectedIndex;
            return (
              <CommandItemButton
                key={item.id}
                item={item}
                isSelected={isSelected}
                onSelect={() => setSelectedIndex(flatIndex)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function CommandItemButton({
  item,
  isSelected,
  onSelect,
}: {
  item: Command;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-slot="cmdk-item"
      data-selected={isSelected || undefined}
      className={clsx(styles.item, isSelected && styles.itemSelected)}
      onClick={item.action}
      onMouseEnter={onSelect}
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
}
