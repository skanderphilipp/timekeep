import { ResponsiveBump } from "@nivo/bump";
import type { BumpSerie, BumpDatum, BumpPoint } from "@nivo/bump";

import { useChartTheme } from "./use-chart-theme";

export type BumpSerieDef = {
  id: string;
  data: { x: string | number; y: number | null }[];
};

export type BumpChartProps = {
  data: BumpSerieDef[];
  height?: number;
  grid?: boolean;
  endLabel?: boolean;
  /**
   * Called when a data point is clicked.
   * Receives the serie id and the x/y values.
   */
  onClick?: (point: { id: string; x: string | number; y: number | null }) => void;
};

/**
 * Bump chart for ranking changes over time.
 *
 * User story US-CHARTS-F03:
 *   Employee ranking month-over-month — who improved? who declined?
 */
export function BumpChart({
  data,
  height = 350,
  grid = true,
  endLabel = true,
  onClick,
}: BumpChartProps) {
  const { nivo } = useChartTheme();

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveBump
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={data as unknown as BumpSerie<BumpDatum, Record<string, any>>[]}
        theme={nivo}
        margin={{ top: 16, right: endLabel ? 120 : 8, bottom: 36, left: 48 }}
        colors={{ scheme: "nivo" }}
        lineWidth={3}
        activeLineWidth={5}
        inactiveLineWidth={2}
        opacity={0.85}
        activeOpacity={1}
        inactiveOpacity={0.35}
        pointSize={8}
        activePointSize={12}
        inactivePointSize={4}
        pointColor={{ from: "serie.color" }}
        pointBorderWidth={2}
        activePointBorderWidth={2}
        pointBorderColor={{ from: "serie.color" }}
        // ── Grid ─────────────────────────────────────────────────
        enableGridX={grid}
        enableGridY={grid}
        axisTop={null}
        axisRight={null}
        axisBottom={{ tickSize: 0, tickPadding: 6 }}
        axisLeft={null}
        // ── Labels ───────────────────────────────────────────────
        endLabel={endLabel ? (serie) => serie.id : false}
        // ── Interaction — point-level clicks via mesh ────────────
        isInteractive={!!onClick}
        useMesh={true}
        onClick={(point: BumpPoint<BumpDatum, Record<string, any>>) => {
          if (!onClick) return;
          onClick({
            id: point.serie.id,
            x: point.data.x,
            y: point.data.y ?? null,
          });
        }}
        animate={false}
      />
    </div>
  );
}
