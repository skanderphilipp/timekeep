import { type ReactNode } from "react";
import { ResponsivePie, type ComputedDatum } from "@nivo/pie";

import { useChartTheme } from "./use-chart-theme";

export type SliceDef = {
  name: string;
  value: number;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  color?: string;
};

/** Data passed to the tooltip render prop. */
export type PieSliceTooltipData = {
  name: string;
  value: number;
  percentage: number;
};

export type PieChartProps = {
  data: SliceDef[];
  height?: number;
  donut?: boolean;
  showLegend?: boolean;
  /** Show value labels on each slice. Default true. */
  showLabels?: boolean;
  /** Show link lines from slices to external labels. Default false. */
  showLinkLabels?: boolean;
  /** Enable hover/focus interactivity. Default true. */
  interactive?: boolean;
  /** Enable mount/unmount animations. Default true. */
  animate?: boolean;
  /** Custom tooltip renderer. Receives slice name, value, and percentage. */
  tooltip?: (slice: PieSliceTooltipData) => ReactNode;
  /**
   * Called when a slice is clicked.
   * Receives the Nivo slice datum with id, value, color, etc.
   */
  onClick?: (slice: ComputedDatum<SliceDef>) => void;
};

export function PieChart({
  data,
  height = 250,
  donut = false,
  showLegend = true,
  showLabels = true,
  showLinkLabels = false,
  interactive = true,
  animate = true,
  tooltip,
  onClick,
}: PieChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  if (data.length === 0) return null;

  const nivoData = data.map((d, i) => ({
    id: d.name,
    label: d.name,
    value: d.value,
    color: d.color ? resolveColor(d.color) : categorical[i % categorical.length],
  }));

  const colors = nivoData.map((d) => d.color);

  const total = nivoData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div data-slot="pie-chart" style={{ width: "100%", height: `${height}px` }}>
      <ResponsivePie
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={nivoData as any}
        colors={colors}
        theme={nivo}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        innerRadius={donut ? 0.55 : 0}
        padAngle={2}
        cornerRadius={2}
        activeOuterRadiusOffset={4}
        enableArcLabels={showLabels}
        enableArcLinkLabels={showLinkLabels}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={nivo.text.fill}
        animate={animate}
        motionConfig="gentle"
        // ── Interaction ────────────────────────────────────────
        isInteractive={interactive}
        onClick={onClick}
        // ── Tooltip ────────────────────────────────────────────
        tooltip={
          tooltip
            ? (d) => {
                const datum = d.datum as unknown as SliceDef;
                return tooltip({
                  name: datum.name,
                  value: datum.value,
                  percentage: total > 0 ? (datum.value / total) * 100 : 0,
                });
              }
            : undefined
        }
        // ── Legend ─────────────────────────────────────────────
        legends={
          showLegend
            ? [
                {
                  anchor: "bottom",
                  direction: "row",
                  justify: false,
                  translateY: 40,
                  itemWidth: 100,
                  itemHeight: 18,
                  itemsSpacing: 8,
                  symbolSize: 10,
                  symbolShape: "circle" as const,
                  toggleSerie: true,
                  itemTextColor: nivo.legends.text.fill,
                },
              ]
            : []
        }
      />
    </div>
  );
}
