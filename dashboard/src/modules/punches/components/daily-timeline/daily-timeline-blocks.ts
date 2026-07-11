import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

import type { Punch } from "@/modules/punches/hooks/use-punch-data";
import type { TimelineBlockData } from "@/components/ui";

// ── Timeline block builders ────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, TimelineBlockData["color"]> = {
  check_in: "present",
  check_out: "present",
  break_in: "warning",
  break_out: "warning",
  overtime_in: "overtime",
  overtime_out: "overtime",
};

function timeToMinutes(ts: number): number {
  const d = new Date(ts * 1000);
  return d.getHours() * 60 + d.getMinutes();
}

export function statusLabel(status: string, _: (msg: MessageDescriptor) => string): string {
  const labels: Record<string, MessageDescriptor> = {
    check_in: msg`Check In`,
    check_out: msg`Check Out`,
    break_in: msg`Break In`,
    break_out: msg`Break Out`,
    overtime_in: msg`Overtime In`,
    overtime_out: msg`Overtime Out`,
  };
  return _(labels[status] ?? status);
}

export function buildBlocks(
  punches: Punch[],
  _: (msg: MessageDescriptor) => string,
): TimelineBlockData[] {
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  const blocks: TimelineBlockData[] = [];
  let inBlock: { startMinute: number; status: string } | null = null;

  for (const punch of sorted) {
    const minute = timeToMinutes(punch.timestamp);

    if (
      punch.status === "check_in" ||
      punch.status === "break_in" ||
      punch.status === "overtime_in"
    ) {
      if (inBlock) {
        blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, _));
      }
      inBlock = { startMinute: minute, status: punch.status };
    } else if (inBlock) {
      blocks.push(createBlock(inBlock.startMinute, minute, inBlock.status, _));
      inBlock = null;
    } else {
      blocks.push(createBlock(minute - 1, minute, punch.status, _));
    }
  }

  if (inBlock) {
    blocks.push(
      createBlock(
        inBlock.startMinute,
        Math.min(inBlock.startMinute + 30, 24 * 60),
        inBlock.status,
        _,
      ),
    );
  }

  return blocks;
}

function createBlock(
  startMinute: number,
  endMinute: number,
  status: string,
  _: (msg: MessageDescriptor) => string,
): TimelineBlockData {
  const label = statusLabel(status, _);
  const startStr = `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`;
  const endStr = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;

  return {
    left: (startMinute / (24 * 60)) * 100,
    width: Math.max(((endMinute - startMinute) / (24 * 60)) * 100, 0.5),
    color: STATUS_CLASS[status] ?? "default",
    title: `${label}: ${startStr} - ${endStr}`,
  };
}

// ── Legend ─────────────────────────────────────────────────────────────────────

export function buildLegendItems(_: (msg: MessageDescriptor) => string) {
  return [
    { color: "present" as const, label: _(msg`Present`) },
    { color: "warning" as const, label: _(msg`Break`) },
    { color: "overtime" as const, label: _(msg`Overtime`) },
  ];
}
