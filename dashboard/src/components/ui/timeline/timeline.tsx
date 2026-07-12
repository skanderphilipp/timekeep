import { type ReactNode } from "react";
import { clsx } from "clsx";

import { Badge } from "../badge";

import styles from "./timeline.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

type TimelineBlockColor = "present" | "warning" | "overtime" | "default";

type TimelineBlockData = {
  /** Start position as percentage of the full timeline width (0-100). */
  left: number;
  /** Width as percentage of the full timeline width (0-100). */
  width: number;
  /** Semantic color variant. */
  color: TimelineBlockColor;
  /** Tooltip shown on hover. */
  title?: string;
};

/** Maps semantic color variants to SCSS module classes for the bar track blocks. */
const BLOCK_STYLES: Record<TimelineBlockColor, string> = {
  present: styles.blockPresent,
  warning: styles.blockWarning,
  overtime: styles.blockOvertime,
  default: styles.blockDefault,
};

/**
 * Maps timeline legend colors to Badge variants + dot status values.
 * Present → green success badge with online dot.
 * Warning/Break → amber warning badge with warning dot.
 * Overtime → blue info badge with online dot.
 */
const LEGEND_BADGE: Record<string, { variant: "success" | "warning" | "info"; dot: "online" | "warning" }> = {
  present: { variant: "success", dot: "online" },
  warning: { variant: "warning", dot: "warning" },
  overtime: { variant: "info", dot: "online" },
};

type TimelineRowData = {
  id: string;
  /** Employee name displayed on the left label. */
  name: string;
  /** Secondary label (e.g., PIN) shown below the name. */
  subLabel?: string;
  /** Block segments to render in the bar track. */
  blocks: TimelineBlockData[];
  /** Called when the row is clicked. */
  onClick?: () => void;
};

type TimelineProps = {
  /** Header label (e.g., "Employee"). */
  headerLabel: string;
  /** Hour labels to display (e.g., ["06:00", "08:00", ...]). */
  hourMarkers: string[];
  /** Timeline rows. */
  rows: TimelineRowData[];
  /** Legend items: color variant + translated label. Badge component used internally. */
  legendItems?: Array<{ color: TimelineBlockColor; label: string }>;
  /** Shown when rows is empty. */
  emptyState?: ReactNode;
  /** Show loading skeleton. */
  isLoading?: boolean;
  /** Loading placeholder height. */
  loadingHeight?: number;
  className?: string;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function TimelineHeader({ label, markers }: { label: string; markers: string[] }) {
  return (
    <div data-slot="timeline-header" className={styles.header}>
      <span data-slot="timeline-header-label" className={styles.headerLabel}>
        {label}
      </span>
      <div data-slot="timeline-hour-markers" className={styles.hourMarkers}>
        {markers.map((h) => (
          <span key={h} data-slot="timeline-hour-marker" className={styles.hourMarker}>
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ name, subLabel, blocks, onClick }: TimelineRowData) {
  const isClickable = !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      data-slot="timeline-row"
      className={clsx(styles.row, isClickable && styles.clickableRow)}
      onClick={onClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div data-slot="timeline-employee-label" className={styles.employeeLabel}>
        <span className={styles.employeeName}>{name}</span>
        {subLabel && <span className={styles.employeePin}>{subLabel}</span>}
      </div>

      <div data-slot="timeline-bar-track" className={styles.barTrack}>
        {blocks.map((block, i) => (
          <div
            key={i}
            className={clsx(styles.block, BLOCK_STYLES[block.color])}
            style={{ left: `${block.left}%`, width: `${block.width}%` }}
            title={block.title}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      data-slot="timeline-skeleton"
      style={{
        height: `${height}px`,
        background: "var(--ao-background-tertiary)",
        borderRadius: "var(--ao-radius-md)",
      }}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Horizontal timeline for daily attendance blocks.
 *
 * Each row = one employee. Colored blocks span the 24-hour bar.
 * Legend reuses the `<Badge>` component with `dot` for consistent status dots.
 *
 * @example
 * ```tsx
 * <Timeline
 *   headerLabel={_(msg`Employee`)}
 *   hourMarkers={["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]}
 *   rows={[
 *     { id: "1", name: "Alice", subLabel: "PIN 123",
 *       blocks: [{ left: 32, width: 37, color: "present", title: "07:42–17:02" }] }
 *   ]}
 *   legendItems={[
 *     { color: "present", label: "Present" },
 *     { color: "warning", label: "Break" },
 *     { color: "overtime", label: "Overtime" },
 *   ]}
 * />
 * ```
 */
export function Timeline({
  headerLabel,
  hourMarkers,
  rows,
  legendItems,
  emptyState,
  isLoading = false,
  loadingHeight = 200,
  className,
}: TimelineProps) {
  if (isLoading) {
    return (
      <div data-slot="timeline" className={clsx(styles.root, className)}>
        <TimelineSkeleton height={loadingHeight} />
      </div>
    );
  }

  return (
    <div data-slot="timeline" className={clsx(styles.root, className)}>
      <TimelineHeader label={headerLabel} markers={hourMarkers} />

      <div data-slot="timeline-body" className={styles.body}>
        {rows.length === 0 && emptyState && (
          <div data-slot="timeline-empty" className={styles.empty}>
            {emptyState}
          </div>
        )}
        {rows.map((row) => (
          <TimelineRow key={row.id} {...row} />
        ))}
      </div>

      {legendItems && legendItems.length > 0 && (
        <div data-slot="timeline-legend" className={styles.legend}>
          {legendItems.map((item) => {
            const badge = LEGEND_BADGE[item.color];
            return badge ? (
              <Badge key={item.color} variant={badge.variant} dot={badge.dot} size="sm">
                {item.label}
              </Badge>
            ) : (
              <span key={item.color} className={styles.legendLabel}>
                {item.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Re-exports ─────────────────────────────────────────────────────────────────

export type { TimelineBlockData, TimelineRowData };
