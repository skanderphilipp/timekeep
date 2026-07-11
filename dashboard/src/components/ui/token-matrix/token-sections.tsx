import type { ReactNode } from "react";

import type { TokenGroup } from "./token-groups";
import { extractColorFromValue, tokenLabel } from "./token-utils";

// ── Sub-components for each token category ────────────────────────────────

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 var(--ao-spacing-4) 0",
        fontSize: "var(--ao-font-size-xl)",
        fontWeight: "var(--ao-font-weight-semibold)",
        color: "var(--ao-font-color-primary)",
      }}
    >
      {children}
    </h2>
  );
}

export function SectionDescription({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "calc(-1 * var(--ao-spacing-3)) 0 var(--ao-spacing-4) 0",
        fontSize: "var(--ao-font-size-sm)",
        color: "var(--ao-font-color-secondary)",
      }}
    >
      {children}
    </p>
  );
}

// ── Color Palette ─────────────────────────────────────────────────────────

export function ColorGroupBlock({
  group,
  values,
}: {
  group: TokenGroup;
  values: Map<string, string>;
}) {
  return (
    <div style={{ marginBottom: "var(--ao-spacing-6)" }}>
      <h3
        style={{
          margin: "0 0 var(--ao-spacing-1) 0",
          fontSize: "var(--ao-font-size-md)",
          fontWeight: "var(--ao-font-weight-semibold)",
          color: "var(--ao-font-color-primary)",
        }}
      >
        {group.label}
      </h3>
      {group.description && (
        <p
          style={{
            margin: "0 0 var(--ao-spacing-3) 0",
            fontSize: "var(--ao-font-size-sm)",
            color: "var(--ao-font-color-tertiary)",
          }}
        >
          {group.description}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-3)" }}>
        {group.tokens.map((name) => {
          const raw = values.get(name) ?? "";
          const color = extractColorFromValue(raw);
          return <ColorSwatch key={name} name={tokenLabel(name)} rawValue={raw} color={color} />;
        })}
      </div>
    </div>
  );
}

export function ColorSwatch({
  name,
  rawValue,
  color,
}: {
  name: string;
  rawValue: string;
  color: string | null;
}) {
  const borderColor = "var(--ao-border-color-medium)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--ao-radius-md)",
        border: `1px solid ${borderColor}`,
        overflow: "hidden",
        width: 140,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 56,
          backgroundColor: color ?? extractColorFromValue(rawValue) ?? rawValue,
        }}
      />
      <div
        style={{
          padding: "var(--ao-spacing-1_5) var(--ao-spacing-2)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: "var(--ao-font-size-xs)",
            fontWeight: "var(--ao-font-weight-medium)",
            color: "var(--ao-font-color-primary)",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: "var(--ao-font-size-xxs)",
            color: "var(--ao-font-color-tertiary)",
            fontFamily: "var(--ao-font-family-mono)",
            lineHeight: 1.3,
            wordBreak: "break-all",
          }}
        >
          {rawValue}
        </span>
      </div>
    </div>
  );
}
