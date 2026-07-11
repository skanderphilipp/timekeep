import { SHADOW_TOKENS } from "./token-groups";
import { tokenLabel } from "./token-utils";

export function ShadowScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ao-spacing-4)" }}>
      {SHADOW_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-2)",
            }}
          >
            <div
              style={{
                width: 120,
                height: 80,
                borderRadius: "var(--ao-radius-md)",
                backgroundColor: "var(--ao-background-primary)",
                border: "1px solid var(--ao-border-color-light)",
                boxShadow: `var(${name})`,
              }}
            />
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-secondary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                maxWidth: 140,
                textAlign: "center",
                wordBreak: "break-all",
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

// ── Border Preview ────────────────────────────────────────────────────────

export const BORDER_TOKENS = [
  "--ao-border-color-light",
  "--ao-border-color-medium",
  "--ao-border-color-strong",
];

export function BorderPreview({ values }: { values: Map<string, string> }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--ao-spacing-4)",
        flexWrap: "wrap",
        alignItems: "flex-start",
      }}
    >
      {BORDER_TOKENS.map((name) => {
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
                width: 80,
                height: 80,
                borderRadius: "var(--ao-radius-md)",
                border: `3px solid var(${name})`,
                backgroundColor: "var(--ao-background-secondary)",
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

// ── Font Color Preview ────────────────────────────────────────────────────

export const FONT_COLOR_TOKENS = [
  "--ao-font-color-primary",
  "--ao-font-color-secondary",
  "--ao-font-color-tertiary",
  "--ao-font-color-disabled",
];

export function FontColorPreview({ values }: { values: Map<string, string> }) {
  const sampleText = "Sample text color";
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--ao-spacing-4)",
        alignItems: "center",
      }}
    >
      {FONT_COLOR_TOKENS.map((name) => {
        const label = tokenLabel(name);
        const raw = values.get(name) ?? "";
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--ao-spacing-1)",
              padding: "var(--ao-spacing-3)",
              borderRadius: "var(--ao-radius-md)",
              backgroundColor: "var(--ao-background-primary)",
              border: "1px solid var(--ao-border-color-light)",
              minWidth: 140,
            }}
          >
            <span
              style={{
                fontSize: "var(--ao-font-size-md)",
                fontWeight: "var(--ao-font-weight-medium)",
                color: `var(${name})`,
              }}
            >
              {sampleText}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
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
                wordBreak: "break-all",
                textAlign: "center",
                lineHeight: 1.2,
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

// ── Page Shell ────────────────────────────────────────────────────────────
