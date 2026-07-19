import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Input, ToggleGroup, Toggle, Text, Badge, Card, Section } from "@/components/ui";
import type { WorkPolicy as WorkPolicyType } from "@/lib/api";
import { formatDurationMinutes } from "@/lib/format-duration";
import styles from "./work-policy-form.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

type WorkPolicyFormProps = {
  value: WorkPolicyType;
  onChange: (policy: WorkPolicyType) => void;
  disabled?: boolean;
  disabledMessage?: string;
};

// ── Defaults ───────────────────────────────────────────────────────────

export const DEFAULT_WORK_POLICY: WorkPolicyType = {
  work_start: "09:00",
  work_end: "17:00",
  late_threshold_minutes: 15,
  min_hours_for_full_day: 4,
  daily_overtime_after_hours: 8,
  working_days: [true, true, true, true, true, false, false],
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * WorkPolicyForm — reusable work policy editor.
 *
 * Used in: Department create/edit modal, Settings → Work Policy tab.
 */
export function WorkPolicyForm({
  value,
  onChange,
  disabled = false,
  disabledMessage,
}: WorkPolicyFormProps) {
  const { _ } = useLingui();

  const update = useCallback(
    (patch: Partial<WorkPolicyType>) => {
      onChange({ ...value, ...patch });
    },
    [value, onChange],
  );

  const handleDayToggle = useCallback(
    (toggledValues: string[]) => {
      const days = DAY_LABELS.map((_, i) => toggledValues.includes(String(i)));
      update({ working_days: days });
    },
    [update],
  );

  const activeDayValues = DAY_LABELS
    .map((_, i) => (value.working_days[i] ? String(i) : null))
    .filter(Boolean) as string[];

  // ── Derived ─────────────────────────────────────────────────────

  const startMin = timeToMinutes(value.work_start);
  const endMin = timeToMinutes(value.work_end);
  const isOvernight = endMin < startMin;
  const dailyMinutes = isOvernight ? 24 * 60 - startMin + endMin : endMin - startMin;
  const workingDayCount = value.working_days.filter(Boolean).length;
  const weeklyMinutes = dailyMinutes * workingDayCount;

  if (disabled) {
    return (
      <Card>
        <Card.Content>
          <Text variant="body" color="tertiary">
            {disabledMessage ?? _(msg`Using organization default work policy.`)}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className={styles.form}>
      {/* Schedule */}
      <Section>
        <Text variant="label" className={styles.sectionLabel}>
          {_(msg`Schedule`)}
        </Text>
        <div className={styles.scheduleRow}>
          <Input
            type="time"
            value={value.work_start}
            onChange={(e) => update({ work_start: e.target.value })}
            label={_(msg`Start`)}
          />
          <Text variant="body" color="tertiary" className={styles.dash}>
            —
          </Text>
          <Input
            type="time"
            value={value.work_end}
            onChange={(e) => update({ work_end: e.target.value })}
            label={_(msg`End`)}
          />
          {isOvernight && (
            <span className={styles.overnightBadge}>
              <Badge variant="info" size="sm">
                {_(msg`Overnight`)}
              </Badge>
            </span>
          )}
        </div>
      </Section>

      {/* Working Days */}
      <Section>
        <Text variant="label" className={styles.sectionLabel}>
          {_(msg`Working Days`)}
        </Text>
        <ToggleGroup value={activeDayValues} onValueChange={handleDayToggle} multiple>
          {DAY_LABELS.map((day, i) => (
            <Toggle key={day} value={String(i)}>
              {day}
            </Toggle>
          ))}
        </ToggleGroup>
      </Section>

      {/* Thresholds */}
      <Section>
        <Text variant="label" className={styles.sectionLabel}>
          {_(msg`Thresholds`)}
        </Text>
        <div className={styles.thresholdRow}>
          <Input
            type="number"
            value={String(value.late_threshold_minutes)}
            onChange={(e) => update({ late_threshold_minutes: Number(e.target.value) || 0 })}
            label={_(msg`Late threshold (min)`)}
            min={0}
            max={120}
            className={styles.thresholdInput}
          />
          <Input
            type="number"
            value={String(value.min_hours_for_full_day)}
            onChange={(e) => update({ min_hours_for_full_day: Number(e.target.value) || 0 })}
            label={_(msg`Min hours (full day)`)}
            min={0}
            max={24}
            step={0.5}
            className={styles.thresholdInput}
          />
          <Input
            type="number"
            value={String(value.daily_overtime_after_hours)}
            onChange={(e) => update({ daily_overtime_after_hours: Number(e.target.value) || 0 })}
            label={_(msg`Overtime after (h)`)}
            min={0}
            max={24}
            className={styles.thresholdInput}
          />
        </div>
      </Section>

      {/* Live Preview */}
      <Card>
        <Card.Content>
          <div className={styles.preview}>
            <div>
              <Text variant="caption" color="tertiary">
                {_(msg`Daily`)}
              </Text>
              <Text variant="body">{formatDurationMinutes(dailyMinutes)}</Text>
            </div>
            <div>
              <Text variant="caption" color="tertiary">
                {_(msg`Weekly`)}
              </Text>
              <Text variant="body">
                {formatDurationMinutes(weeklyMinutes)} ({workingDayCount}d)
              </Text>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
