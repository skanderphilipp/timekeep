import { vi } from "vitest";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";

import type { FilterChip } from "../filter-chips";
import type { FilterField } from "./filter-dropdown";

i18n.load({ en: enMessages });
i18n.activate("en");

export function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

export function makeField(key: string, label: string): FilterField {
  return {
    key,
    label,
    renderValueSelector: ({ onBack }) => (
      <div data-testid={`value-${key}`}>
        <span>Value selector for {label}</span>
        <button type="button" onClick={onBack} data-testid={`back-${key}`}>
          Back
        </button>
      </div>
    ),
  };
}

export function makeChip(key: string, label: string, onRemove = vi.fn()): FilterChip {
  return { key, label, onRemove };
}

export const twoFields = [makeField("status", "Status"), makeField("date", "Date")];
