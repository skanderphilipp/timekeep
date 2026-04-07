import { type ReactNode } from "react";
import { clsx } from "clsx";

import styles from "./timeline.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

type TimelineBlockColor = "default" | "present" | "warning" | "overtime";

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

/** Maps semantic color variants to SCSS module classes. */
const BLOCK_COLORS: Record<TimelineBlockColor, string> = {
  default: styles.blockDefault,
  present: styles.blockPresent,
  warning: styles.blockWarning,
  overtime: styles.blockOvertime,
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
  /** Hour labels to display (e.g., ["00:00", "01:00", ...]). */
  hourMarkers: string[];
  /** Timeline rows. */
  rows: TimelineRowData[];
  /** Legend items: color variant + translated label. */
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

function TimelineHeader({
  label,
  markers,
}: {
  label: string;
  markers: string[];
}) {
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

function TimelineRow({
  name,
  subLabel,
  blocks,
  onClick,
}: TimelineRowData) {
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
            className={clsx(styles.block, BLOCK_COLORS[block.color])}
            style={{ left: `${block.left}%`, width: `${block.width}%` }}
            title={block.title}
          />
        ))}
      </div>
    </div>
  );
}

// ── Loading State ──────────────────────────────────────────────────────────────

function TimelineSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      data-slot="timeline-skeleton"
      style={{
        height: `${height}px`,
        background: "var(--ao-background-tertiary)",
        borderRadius: "var(--ao-border-radius-md)",
      }}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Horizontal timeline visualization for daily attendance data.
 *
 * Displays employee rows with color-coded time blocks spanning a 24-hour bar.
 * Supports clickable rows, a legend, empty/loading states, and hour markers.
 *
 * @example
 * ```tsx
 * <Timeline
 *   headerLabel={_(msg`Employee`)}
 *   hourMarkers={["00:00", "01:00", ...]}
 *   rows={[
 *     { id: "1", name: "Alice", subLabel: "123", blocks: [{ left: 10, width: 20, colorClass: styles.present, title: "Check In" }] }
 *   ]}
 *   legend={<TimelineLegend items={...} />}
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
          {legendItems.map((item) => (
            <span key={item.color}>
              <span className={clsx(styles.legendDot, BLOCK_COLORS[item.color])} />
              <span className={styles.legendLabel}>{item.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Re-exports ─────────────────────────────────────────────────────────────────

export type { TimelineBlockData, TimelineRowData };
