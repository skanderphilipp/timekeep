import { clsx } from "clsx";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconCircleFilled,
  IconCircle,
  IconRefresh,
  IconAlertTriangle,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react";

import {
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
  SECONDS_PER_WEEK,
} from "@/lib/constants";
import styles from "./activity-feed.module.scss";

type TimelineEvent = {
  /** Unique event ID. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Unix timestamp (seconds). */
  timestamp: number;
  /** Event type for icon coloring: "online", "offline", "sync", "warning", "config", "provision". */
  kind: "online" | "offline" | "sync" | "warning" | "config" | "provision";
  /** Whether this event represents a problem (renders with emphasis). */
  isProblem?: boolean;
};

type ActivityFeedProps = {
  events: TimelineEvent[];
  /** Show relative timestamps (e.g. "2 min ago"). Default: true. */
  relativeTime?: boolean;
  /** Maximum events to render. */
  maxEvents?: number;
  /** Loading state. */
  loading?: boolean;
  /** Empty state message. */
  emptyMessage?: string;
  className?: string;
};

const KIND_ICONS: Record<TimelineEvent["kind"], typeof IconCircleFilled> = {
  online: IconCircleFilled,
  offline: IconCircle,
  sync: IconRefresh,
  warning: IconAlertTriangle,
  config: IconSettings,
  provision: IconSparkles,
};

/**
 * Activity feed — vertical event list with colored icons and relative timestamps.
 *
 * Composable molecule built on raw elements. Designed to sit inside a Card.Content.
 * Renders a max of `maxEvents` entries with a "Show more" affordance.
 */
export function ActivityFeed({
  events,
  relativeTime = true,
  maxEvents = 20,
  loading = false,
  emptyMessage,
  className,
}: ActivityFeedProps) {
  const { _ } = useLingui();
  const resolvedEmptyMessage = emptyMessage ?? _(msg`No activity yet`);

  if (loading) {
    return (
      <div data-slot="activity-feed" className={clsx(styles.container, className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeleton}>
            <span className={styles.skeletonDot} />
            <span className={styles.skeletonLine} />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div data-slot="activity-feed" className={clsx(styles.container, className)}>
        <span className={styles.empty}>{resolvedEmptyMessage}</span>
      </div>
    );
  }

  const visible = events.slice(0, maxEvents);

  return (
    <div data-slot="activity-feed" className={clsx(styles.container, className)}>
      {visible.map((event) => (
        <EventRow key={event.id} event={event} relativeTime={relativeTime} _={_} />
      ))}
      {events.length > maxEvents && (
        <span className={styles.more}>
          +{events.length - maxEvents} {_(msg`more events`)}
        </span>
      )}
    </div>
  );
}

// ── Internal sub-component ──────────────────────────────────────────

function EventRow({
  event,
  relativeTime,
  _,
}: {
  event: TimelineEvent;
  relativeTime: boolean;
  _: LinguiFn;
}) {
  const Icon = KIND_ICONS[event.kind];

  return (
    <div
      data-slot="activity-feed-event"
      data-kind={event.kind}
      data-problem={event.isProblem || undefined}
      className={clsx(styles.event, styles[event.kind], event.isProblem && styles.problem)}
    >
      <span className={styles.icon}>
        <Icon size={14} />
      </span>
      <span className={styles.label}>{event.label}</span>
      <time className={styles.time} dateTime={new Date(event.timestamp * 1000).toISOString()}>
        {relativeTime ? formatRelative(event.timestamp, _) : formatTime(event.timestamp)}
      </time>
    </div>
  );
}

// ─── Time formatting helpers ────────────────────────────────────────

type LinguiFn = ReturnType<typeof useLingui>["_"];

function formatRelative(ts: number, _: LinguiFn): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < SECONDS_PER_MINUTE) return _(msg`just now`);
  if (diff < SECONDS_PER_HOUR) return _(msg`${Math.floor(diff / SECONDS_PER_MINUTE)}m ago`);
  if (diff < SECONDS_PER_DAY) return _(msg`${Math.floor(diff / SECONDS_PER_HOUR)}h ago`);
  if (diff < SECONDS_PER_WEEK) return _(msg`${Math.floor(diff / SECONDS_PER_DAY)}d ago`);
  return formatTime(ts);
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
