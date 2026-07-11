# Timekeep Dashboard — Design System Core

> **Status:** Canonical. If this document and the code disagree, run `pnpm lint:tokens` — the generator wins.
> **Last rebuilt:** 2026-07-11

---

## 1. The one rule

**Every visual value in `src/` comes from a generated `--ao-*` token.**
No hex colors, no raw px for spacing/radius/font-size, no invented token names.

This is not a convention — it is enforced. Three linters run in `pnpm check` and CI:

| Gate               | Tool                                                               | What it catches                                                                                                           |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint:style`  | stylelint (`stylelint-declaration-strict-value` + disallowed-list) | Hardcoded colors and px values in `.scss`                                                                                 |
| `pnpm lint:tokens` | `scripts/check-tokens.ts`                                          | References to tokens that **don't exist**, a stale `generated-tokens.css`, and `--ao-*` definitions outside the generator |
| `pnpm check` (CI)  | full pipeline                                                      | typecheck, oxlint, format, dependency layering, file size, styles, tokens, duplication                                    |

The second gate is the important one. Before it existed, 28 phantom tokens
(`--ao-radius-md`, `--ao-font-weight-bold`, `--ao-accent-accent8`, …) were
referenced across ~60 files and silently resolved to _nothing_ — invisible
focus rings, unstyled shadows, broken button text. That class of bug is now
impossible: an unknown token fails CI.

---

## 2. Token architecture

```
src/styles/tokens/build.ts     ← THE source of truth (only place raw values live)
        │  pnpm generate-tokens
        ▼
src/styles/generated-tokens.css  ← AUTO-GENERATED, verified in CI, never hand-edited
        │  imported once in main.tsx (and Storybook preview)
        ▼
:root/.light + .dark blocks      ← theme switch = class swap on <html>
```

### Namespaces

| Prefix                  | Meaning                                                      | Who may define it                          |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `--ao-*`                | Design tokens                                                | `tokens/build.ts` **only** (lint-enforced) |
| `--tk-*`                | Runtime variables set from JS (e.g. `--tk-side-panel-width`) | Application code                           |
| unprefixed (`--btn-bg`) | Component-local variables                                    | The component's own `.module.scss`         |

### Color scales (Radix, full 12 steps)

`gray`, `accent` (cyan), `red`, `green`, `amber`, `blue` — each emitted as a
full 12-step scale (`--ao-color-red1…12`, `--ao-accent-accent1…12`) in both
themes, with sRGB hex fallback + P3 wide-gamut override.

Radix step semantics: **1–2** backgrounds · **3–5** component states ·
**6–8** borders · **9–10** solid fills · **11–12** text.

### Semantic aliases — prefer these over raw steps

| Group       | Tokens                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Backgrounds | `--ao-background-{primary,secondary,tertiary,page}`                                                                      |
| Text        | `--ao-font-color-{primary,secondary,tertiary,disabled,inverted}`                                                         |
| Borders     | `--ao-border-color-{light,medium,strong}`                                                                                |
| Status      | `--ao-status-{success,warning,danger,info}-{bg,bg-hover,border,solid,solid-hover,text}`                                  |
| Interaction | `--ao-focus-ring`, `--ao-overlay`                                                                                        |
| Elevation   | `--ao-shadow-{sm,md,lg,page}` (theme-aware — dark theme gets stronger shadows)                                           |
| Typography  | `--ao-font-size-{xxs…3xl}`, `--ao-font-weight-{regular,medium,semibold,bold}`, `--ao-line-height-{heading,body,relaxed}` |
| Shape       | `--ao-radius-{xs,sm,md,lg,xl,pill,full}`                                                                                 |
| Spacing     | `--ao-spacing-{0,0_5,1,1_5,2…32}` (4px base)                                                                             |

Rule of thumb: a component expressing _meaning_ (success badge, danger button)
uses **status aliases**; a component doing _fine-grained tinting_ (calendar
heat levels) may use raw scale steps.

### Chart tokens — special case

`--ao-chart-{1…6}` (categorical) and `--ao-chart-{primary,positive,negative,warning,info,neutral}`
are emitted **sRGB hex only, never P3**. Chart libraries (nivo → d3-color)
parse colors in JavaScript, and d3 cannot parse `color(display-p3 …)`.
Resolving a chart token always yields a parseable color. Use these — not the
raw scales — for anything a chart library touches.

---

## 3. SCSS rules (enforced by stylelint)

- Only `var(--ao-*)` for colors, spacing, radius, font-size, line-height.
  `color-mix(in srgb, var(--ao-…) N%, transparent)` is allowed — token-derived alpha.
- CSS Modules only; no BEM, no global utility classes.
- `:global()` only for third-party overrides (react-datepicker etc.);
  `!important` only with a `stylelint-disable` comment explaining _why_.
- Shared patterns live in `src/styles/mixins.scss` (`focus-ring`, `sr-only`,
  `card-surface`, `skeleton-loading`, `custom-scrollbar`, `respond-to`) and the
  `_form-control-base/_input-base/_dropdown-base` partials. Never copy-paste
  a focus ring or sr-only block — `@include` it.
- Dark theme = token swap. **Never** write `.dark .myComponent { … }` — if you
  need a theme-dependent value, it belongs in the generator as a token
  (see `--ao-shadow-page` for the pattern).

---

## 4. Charts (nivo)

`var(--ao-*)` strings **break** inside nivo: SVG presentation attributes don't
resolve `var()`, and d3-color modifiers can't parse them. The chart layer
therefore resolves tokens to concrete values at runtime:

```tsx
import { useChartTheme } from "@/components/ui";

function MyChart() {
  const { categorical, semantic, nivo, resolveColor } = useChartTheme();
  // categorical: ["#00a2c7", "#0090ff", …]  ← resolved, theme-correct, d3-parseable
  // nivo: full nivo theme object built from resolved tokens
}
```

- `BarChart` / `LineChart` / `PieChart` default their series colors to the
  categorical palette — **omit `fill`/`stroke`/`color` unless you mean it.**
- Explicit colors may still be `var(--ao-*)` references; `resolveColor`
  translates them before nivo sees them.
- `useChartTheme` re-resolves when the color scheme flips (via `ThemeProvider`),
  so charts restyle on theme switch without a reload.
- Semantic mapping for HR data: positive = attendance/present, negative =
  absent/anomaly, warning = late/break, info = overtime.

---

## 5. Component & page architecture (enforced by oxlint + depcruise + size gate)

```
src/types/            pure types (no runtime imports)
src/lib/              pure logic — may NOT import components/ui
src/infrastructure/   cross-cutting (theme, toast, navigation) — may NOT import modules
src/components/ui/    atoms; one folder per component (tsx + module.scss + stories + index.ts)
src/modules/<name>/   feature modules: components/ + hooks/ + pages/ + schemas/
```

- **Pages are thin composites** (≤ 80 lines): `PageLayout > PageBody > <FeatureView />`.
  All state lives in a `use-<feature>-page` orchestration hook; all markup in a
  `<feature>-view.tsx` module component.
- Hooks ≤ 150 lines, TSX files ≤ 250 lines — split by concern, not by line count.
- The UI barrel (`components/ui/index.ts`) is generated: `pnpm generate-ui-barrel`.
- Stories with local state use named `…Demo` components — hooks in anonymous
  `render:` functions violate rules-of-hooks.

---

## 6. Verifying tokens visually

`Tokens / Design Tokens` in Storybook renders every token (swatches, spacing
bars, radius boxes, type scale, shadows) read live via `getComputedStyle`, so
it is always in sync with the generator and theme-aware. Token name lists live
in `token-matrix/token-groups.ts`; `pnpm lint:tokens` fails if any listed name
stops existing.

---

## 7. Assessment of the planning docs (2026-07-11 upload)

What the uploaded docs got **right** (and is now implemented or confirmed):

- Two-layer token defense (lint + visual story) — implemented, plus a third
  layer they missed: **token-existence checking**. stylelint can only reject
  raw values; it cannot know `--ao-radius-md` didn't exist. That gap was the
  single biggest source of breakage.
- `@radix-ui/colors` as token source, generated CSS, CSS-Modules-only,
  dark theme via token swap — all sound, all kept.
- Storybook direction (play functions, catalog pattern, browser-mode tests,
  a11y-as-error) — sound, and the dual test project now actually runs again
  (the Vitest 4 upgrade had silently killed it; `vitest.workspace.ts` is not
  supported in Vitest 4 and had to become `vitest.config.ts` projects).

What was **stale or wrong** in the docs:

- Token names: docs said `--ao-radius-*` while the generator emitted
  `--ao-border-radius-*` — half the codebase followed the doc and silently
  broke. The generator now matches the documented (shorter) name.
- "stylelint in `pnpm check` enforces this" — `pnpm check` was **not runnable**
  (broken `pnpm-workspace.yaml`) and CI ran zero dashboard jobs. Both fixed.
- Spacing scale doc (Decision 6) claimed stops were missing that already
  existed; ignore it.
- The storybook guide's Phase 2–4 roadmap is still valid as a to-do list, but
  its file-structure section predates the token-matrix split.

Still open (deliberately not done in this pass — see §8):

- Component consolidation: `Badge`/`Tag`/`Chip`/`Pill` and
  `StatusBadge`/`DeviceStatusBadge` overlap (docs' Batch 9). The right target
  from the docs stands: **`Badge` (status display) + `Tag` (interactive
  label)**, `Pill` becomes a Badge variant, `Dot` vs `StatusDot` kept but
  documented (decorative vs semantic ARIA).
- Filter component altitude: `FilterBar` (layout) + `FilterDropdown`
  (add-filter flow) + `ViewBar` (filters + sorts + views) need a documented
  composition contract before more filter UI is built.
- Domain stories for dashboard/punches/reports/employees (docs' Batches 3–7).

## 8. Why consolidation comes after this foundation

Merging Badge/Tag/Chip/Pill while tokens were broken would have consolidated
onto sand. Now that every color/spacing value is token-checked and every
component renders in Storybook with a11y checks, consolidation is a mechanical
API merge with visual verification — do it as its own change, one component
family at a time, using the Catalog story to review every variant before and
after.
