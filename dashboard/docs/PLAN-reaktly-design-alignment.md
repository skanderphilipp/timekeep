# Reaktly Design System Alignment Plan

> **Date**: 2026-07-10
> **Status**: Research complete — planning phase
> **Source**: Deep study of `reaklty-xx/packages/ui/src/` and `apps/pulse/src/modules/ui/layout/`

---

## 1. Design Token Comparison

### Spacing System

| Reaktly (`--ry-*`) | Our Dashboard (`--ao-*`) | Gap |
|---|---|---|
| **Spacing multiplicator**: `--ry-spacing-multiplicator` (base unit, e.g. 4px) | Fixed px values: `--ao-spacing-1: 4px`, `--ao-spacing-2: 8px`, etc. | We hardcode. Reaktly multiplies. Same result, but Reaktly's approach is more flexible for density scaling. |
| Scale: 0–32 + 0.5, 1.5 (34 stops) | Scale: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (11 stops) | We're missing fine-grained stops (7, 9, 11, 13-15, 17+) and fractional stops (0.5, 1.5). |
| `spacing-4` = `4 * multiplicator` (~16px) | `spacing-4: 16px` | Functionally identical for this value. |

**Action**: Add missing spacing stops: `7` (28px), `9` (36px), `11` (44px), `14` (56px), `18` (72px), `20` (80px), `24` (96px), `32` (128px).

### Background System

| Reaktly Token | Our Token | Match? |
|---|---|---|
| `background.primary` | `--ao-background-primary` | ✅ |
| `background.secondary` | `--ao-background-secondary` | ✅ |
| `background.tertiary` | `--ao-background-tertiary` | ✅ |
| `background.noisy` | ❌ None | 🔴 Missing — used for the page background behind cards |
| `background.transparent.*` (8 variants) | ❌ None | 🟡 Nice to have |
| `grayScale.gray3` (used in DefaultLayout) | ❌ None | 🔴 Missing — this is the main app background |

**Action**: 
- Add `--ao-background-page` (equivalent to `gray3`/`background.noisy`) — the subtle texture/color behind the page card
- The app shell content area should use this as its background

### Border System

| Reaktly | Our Dashboard | Issue |
|---|---|---|
| `border.color.medium` — very subtle in both themes | `--ao-border-color-medium` | ✅ Same approach |
| Uses `border: 1px solid` OR `box-shadow: 0 0 0 1px` | Uses `border: 1px solid` | ✅ Both patterns used in Reaktly |
| `border.radius.sm` ≈ 6px (Radix) | `--ao-border-radius-sm: 4px` | 🟡 Slightly smaller |

**Action**: Bump `--ao-border-radius-sm` to 6px, `--ao-border-radius-md` to 8px.

### Card System (Critical)

**Reaktly's Card approach:**
```scss
// Card wrapper
.card {
  background: transparent;           // ← KEY: transparent by default!
  border: 1px solid var(--border-color-medium);
  border-radius: var(--border-radius-sm);  // 6px
  overflow: hidden;
}

// Card content
.cardContent {
  background: var(--background-secondary);  // ← Nested bg contrast
  padding: var(--spacing-4);               // 16px
}
```

**Our Card approach:**
```scss
.card {
  background: white; // ← WRONG: should be transparent
  border: 1px solid var(--ao-border-color-light);
  border-radius: var(--ao-border-radius-md);
}
.content {
  background: white; // ← WRONG: should be secondary
  padding: var(--ao-spacing-5); // 20px
}
```

**Problems:**
1. Card background should be `transparent`, allowing page background to show through
2. CardContent should have `background: secondary` for subtle nesting contrast
3. Border color should be `medium`, not `light`
4. Border radius should be `sm` (6px), not `md` (8px)

### Page Layout Card (Critical)

**Reaktly's PageCardLayout:**
```scss
// This is the SINGLE card per page
background: var(--background-primary);
border-radius: 16px 0 0 0;       // Only top-left rounded
box-shadow:
  -4px 0 4px 0 rgba(0,0,0,0.006),   // Subtle left shadow (sidebar edge)
  0 0 0 1px var(--border-color-medium);  // 1px border via shadow
```

**Our PageLayout:**
```scss
background: var(--ao-background-primary);
border-radius: 16px 0 0 0;
box-shadow:
  -4px 0 4px 0 rgba(0,0,0,0.006),
  0 0 0 1px var(--ao-border-color-medium);  // ← same approach as Reaktly
```

**Issues:** The PageLayout itself is structurally correct but visually broken because:
1. The **page background** behind the card isn't set properly — it blends in
2. The card has no visual separation from the surrounding area

---

## 2. Layout Layer Structure

### Reaktly's Full Stack

```
DefaultLayout
├── background: gray3                        ← subtle gray behind everything
├── NavigationDrawer (sidebar)
└── MainContainer
    └── PageCardLayout                       ← the page card
        ├── background: primary              ← white/light surface
        ├── border-radius: 16px 0 0 0       ← top-left only
        ├── border: 1px medium
        ├── PageCardHeader                   ← breadcrumb + title + actions
        │   ├── background: secondary
        │   ├── border-bottom: 1px medium
        │   ├── Breadcrumb (left)
        │   ├── Icon + Title (left)
        │   └── ActionButton (right)
        └── StyledBodyContent                ← content area
            └── [widgets, sections]
                ├── Section (no bg, no padding)
                └── Card (transparent bg)
                    └── CardContent (bg: secondary, p: spacing-4)
```

### Our Current Stack

```
AppShell
├── .shell { display: flex; min-height: 100vh; }  ← no background set!
├── Sidebar (bg: secondary)
└── .main
    ├── .topBar (bg: transparent?)
    │   └── breadcrumbs + actions
    └── .content { children }                     ← no background!
        └── PageLayout                            ← page card
            ├── bg: primary
            ├── border-radius: 16px 0 0 0
            ├── PageBar (title + desc + actions)
            └── PageBody
                └── Section
                    ├── Card (bg: white, border: light)  ← WRONG
                    └── content...
```

### Gaps

| Layer | Reaktly | Our Dashboard | Fix |
|-------|---------|---------------|-----|
| **App background** | `gray3` (subtle gray) | None (white/transparent) | Set `.content` or `.shell` bg to a subtle page-bg color |
| **Page card border** | `box-shadow: 0 0 0 1px medium` | `box-shadow: 0 0 0 1px medium` | ✅ Same, but needs background contrast to be visible |
| **PageBar** | `background: secondary`, `border-bottom: 1px medium` | No background, no border-bottom | Add bg + border to PageBar |
| **Card bg** | `transparent` | `white` (hardcoded) | Make transparent, let page card bg show through |
| **CardContent bg** | `secondary` | `white` (hardcoded) | Set to secondary |
| **Section** | `width: auto`, no padding | Padding/margin from our custom Section | Match Reaktly's minimal Section |
| **Spacing** | `spacing-4` (16px) card padding | `spacing-5` (20px) | Reduce to 16px |

---

## 3. Implementation Plan

### Step 1: Fix Design Tokens (`generated-tokens.css` + `tokens/build.ts`)
- [ ] Add `--ao-background-page` (subtle page background, darker than primary)
- [ ] Add missing spacing stops
- [ ] Review border-radius values

### Step 2: Fix AppShell Background
- [ ] Set `.shell` or `.content` to `background: var(--ao-background-page)`
- [ ] This creates the visual contrast so the page card stands out

### Step 3: Fix PageBar Component
- [ ] Add `background: var(--ao-background-secondary)`
- [ ] Add `border-bottom: 1px solid var(--ao-border-color-medium)`
- [ ] Match Reaktly's `PageCardHeader` styling

### Step 4: Fix Card Component
- [ ] Card wrapper: `background: transparent` (not white)
- [ ] Card wrapper: `border: 1px solid var(--ao-border-color-medium)` (not light)
- [ ] Card wrapper: `border-radius: var(--ao-border-radius-sm)` (6px, not 8px)
- [ ] CardContent: `background: var(--ao-background-secondary)`
- [ ] CardContent: `padding: var(--ao-spacing-4)` (16px, not 20px)

### Step 5: Fix Section Component
- [ ] Match Reaktly's minimal approach: no padding, no max-width by default
- [ ] Add spacing only via page-level layout, not Section itself

### Step 6: Fix PageLayout Component
- [ ] Already correct structurally, just needs background contrast from Step 2

### Step 7: Review All Pages
- [ ] Each page: `<PageLayout><PageBar/><PageBody><Section>...</Section></PageBody></PageLayout>`
- [ ] No nested Cards in content (PageLayout IS the card)
- [ ] Consistent spacing using Section for semantic blocks

---

## 4. What NOT To Change

| Component | Reason |
|-----------|--------|
| Breadcrumbs in AppShell top bar | ✅ Already correct, user confirmed it looks professional |
| PageLayout structural approach | ✅ Matches Reaktly's PageCardLayout pattern |
| 50 UI components | ✅ They're fine; the issue is styling tokens and layout composition |

---

## 5. Verification Checklist

- [ ] Card has transparent background, content has secondary background
- [ ] Page card has visible border because page background contrasts
- [ ] Spacing matches Reaktly's 4px-base scale
- [ ] PageBar has the same visual weight as Reaktly's PageCardHeader
- [ ] Dark mode looks correct with proper contrast
- [ ] TypeScript compiles
- [ ] All 10 tests pass
- [ ] Dependency cruiser: 0 violations
