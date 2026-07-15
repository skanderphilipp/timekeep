import { useMemo } from "react";

import { SPACING_TOKENS, RADIUS_TOKENS } from "./token-groups";
import { spacingToPx, tokenLabel } from "./token-utils";

// ── Spacing Scale ─────────────────────────────────────────────────────────

export function SpacingScale({ values }: { values: Map<string, string> }) {
  const maxPx = useMemo(() => {
    let max = 0;
    for (const name of SPACING_TOKENS) {
      const v = spacingToPx(values.get(name) ?? "0px");
      if (v > max) max = v;
    }
    return max || 128;
  }, [values]);

  const barColor = "var(--ao-accent-accent9)";
  const mutedBarColor = "var(--ao-accent-accent5)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-1_5)" }}>
      {SPACING_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const px = spacingToPx(raw);
        const pct = Math.max(2, (px / maxPx) * 100);
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ao-spacing-3)",
            }}
          >
            <span
              style={{
                width: 120,
                flexShrink: 0,
                textAlign: "right",
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <div
              style={{
                height: 24,
                width: `${pct}%`,
                minWidth: 2,
                borderRadius: "var(--ao-radius-xs)",
                background: `linear-gradient(90deg, ${barColor}, ${mutedBarColor})`,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  right: -60,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "var(--ao-font-size-xxs)",
                  color: "var(--ao-font-color-tertiary)",
                  fontFamily: "var(--ao-font-family-mono)",
                  whiteSpace: "nowrap",
                }}
              >
                {raw}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Border Radius ─────────────────────────────────────────────────────────

export function BorderRadiusScale({ values }: { values: Map<string, string> }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--ao-spacing-4)",
        alignItems: "flex-start",
      }}
    >
      {RADIUS_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-1_5)",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: `var(${name})`,
                border: "2px solid var(--ao-accent-accent9)",
                backgroundColor: "var(--ao-accent-accent3)",
              }}
            />
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
                textAlign: "center",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {raw}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Typography ────────────────────────────────────────────────────────────
