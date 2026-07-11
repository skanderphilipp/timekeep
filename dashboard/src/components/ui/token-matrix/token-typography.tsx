import { FONT_SIZE_TOKENS, FONT_WEIGHT_TOKENS, FONT_FAMILY_TOKENS } from "./token-groups";
import { tokenLabel } from "./token-utils";

export function FontSizeScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_SIZE_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--ao-spacing-4)",
              padding: "var(--ao-spacing-1_5) 0",
              borderBottom: "1px solid var(--ao-border-color-light)",
            }}
          >
            <span
              style={{
                width: 100,
                flexShrink: 0,
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: `var(${name})`,
                fontWeight: "var(--ao-font-weight-regular)",
                color: "var(--ao-font-color-primary)",
                lineHeight: 1.4,
              }}
            >
              The quick brown fox jumps over the lazy dog.
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                whiteSpace: "nowrap",
                marginLeft: "auto",
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

export function FontWeightScale({ values }: { values: Map<string, string> }) {
  const sampleText = "Agile workflows, reliable outcomes.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_WEIGHT_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--ao-spacing-4)",
              padding: "var(--ao-spacing-1_5) 0",
            }}
          >
            <span
              style={{
                width: 100,
                flexShrink: 0,
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-lg)",
                fontWeight: `var(${name})`,
                color: "var(--ao-font-color-primary)",
              }}
            >
              {sampleText}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-xxs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
                whiteSpace: "nowrap",
                marginLeft: "auto",
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

export function FontFamilyScale({ values }: { values: Map<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-3)" }}>
      {FONT_FAMILY_TOKENS.map((name) => {
        const raw = values.get(name) ?? "";
        const label = tokenLabel(name);
        return (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--ao-spacing-1)",
              padding: "var(--ao-spacing-3)",
              borderRadius: "var(--ao-radius-md)",
              border: "1px solid var(--ao-border-color-light)",
            }}
          >
            <span
              style={{
                fontSize: "var(--ao-font-size-xs)",
                color: "var(--ao-font-color-tertiary)",
                fontFamily: "var(--ao-font-family-mono)",
              }}
            >
              {label} — {raw}
            </span>
            <span
              style={{
                fontSize: "var(--ao-font-size-lg)",
                fontFamily: `var(${name})`,
                color: "var(--ao-font-color-primary)",
              }}
            >
              ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Shadows ───────────────────────────────────────────────────────────────
