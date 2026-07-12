import { ResponsiveRadar } from "@nivo/radar";

import { useChartTheme } from "./use-chart-theme";

export type RadarDef = {
  dataKey: string;
  /** CSS color or `var(--ao-*)` token reference. Defaults to the categorical palette. */
  stroke?: string;
  name?: string;
};

export type RadarChartProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  axes: RadarDef[];
  indexBy: string;
  height?: number;
  maxValue?: number | "auto";
  /** Number of concentric grid circles. 0 = no grid. */
  gridLevels?: number;
  dot?: boolean;
  fillOpacity?: number;
  onClick?: (datum: RadarDatum) => void;
};

/** The datum shape passed to onClick handlers. */
export type RadarDatum = {
  index: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * Radar / spider chart for multi-KPI employee comparison.
 *
 * User story US-CHARTS-F01:
 *   Employee KPI spider — punctuality, hours consistency, attendance rate,
 *   overtime reliability, break compliance.
 */
export function RadarChart({
  data,
  axes,
  indexBy,
  height = 350,
  maxValue = "auto",
  gridLevels = 5,
  dot = true,
  fillOpacity = 0.2,
  onClick,
}: RadarChartProps) {
  const { categorical, nivo, resolveColor } = useChartTheme();

  const keys = axes.map((a) => a.dataKey);
  const colors = axes.map((a, i) =>
    a.stroke ? resolveColor(a.stroke) : categorical[i % categorical.length],
  );

  // Radar charts need more visible grid rings than bar/line charts.
  // The shared nivo theme uses subtle dashed grid lines for readability
  // in dense bar charts — but circular radar rings need solid, visible strokes.
  const radarTheme = {
    ...nivo,
    grid: {
      line: {
        stroke: nivo.grid?.line?.stroke ?? "#e0e0e0",
        strokeWidth: 1.5,
        // Solid lines for circular rings — dashed looks broken on arcs.
        strokeDasharray: undefined as unknown as string,
        strokeOpacity: 0.6,
      },
    },
  };

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <ResponsiveRadar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={data as any}
        keys={keys}
        indexBy={indexBy}
        theme={radarTheme}
        margin={{ top: 48, right: 48, bottom: 48, left: 48 }}
        maxValue={maxValue}
        colors={colors}
        blendMode="normal"
        // ── Grid ─────────────────────────────────────────────────
        gridShape="circular"
        gridLevels={gridLevels}
        gridLabelOffset={16}
        // ── Polygon outline — makes the data shape visible ──────
        borderWidth={2}
        borderColor={{ from: "color", modifiers: [["darker", 0.15]] }}
        // ── Points — larger dots for visibility on radar ────────
        enableDotLabel={false}
        dotSize={dot ? 14 : 0}
        dotColor={{ from: "color" }}
        dotBorderWidth={3}
        dotBorderColor={{ theme: "background" }}
        fillOpacity={fillOpacity}
        // ── Interaction ─────────────────────────────────────────
        isInteractive={!!onClick}
        onClick={(radarPoint) => {
          if (!onClick) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pt = radarPoint as any;
          const idx = pt?.index ?? pt?.id;
          const row = data.find((d) => String(d[indexBy]) === String(idx));
          if (row) onClick(row as RadarDatum);
        }}
      />
    </div>
  );
}
