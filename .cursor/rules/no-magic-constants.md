# Rule: No Magic Constants

Every literal value that carries domain meaning MUST be extracted into a named
constant. The constant lives in the appropriate `shared/` or `lib/` file.

## What Counts as a Magic Constant

| Category | Example | Must Go To |
|----------|---------|------------|
| Route path | `"/devices/new"`, `"/login"` | `shared/paths.ts` → `AppRoute.*` |
| API path segment | `"devices"`, `"api-keys"` | `shared/paths.ts` → `ApiPath.*` |
| TanStack Query key | `["devices"]`, `["api-keys"]` | `dashboard/src/lib/query-keys.ts` → `QueryKeys.*` |
| Timeout / interval | `15_000`, `30_000`, `60_000` | `dashboard/src/lib/constants.ts` |
| Port number | `4370`, `65535` | `dashboard/src/lib/constants.ts` |
| HTTP status code list | `[408, 413, 429, ...]` | `dashboard/src/lib/constants.ts` |
| Time unit (seconds) | `60`, `3600`, `86400` | `dashboard/src/lib/constants.ts` |
| Pagination size | `20`, `50` | `dashboard/src/lib/constants.ts` |
| Poll/refresh interval | `30_000`, `60_000` | `dashboard/src/lib/constants.ts` |
| Entity type string | `"device"`, `"punch"` | Already typed via `EntityType` — use the type union |
| Any number > 1 in business logic | `5`, `300` | Named constant next to usage OR in `constants.ts` |

## Where Constants Live

```
shared/paths.ts              ← Framework-agnostic route + API paths
shared/*.ts                  ← Domain catalogs (roles, permissions, etc.)

dashboard/src/lib/
├── constants.ts             ← Runtime config (timeouts, ports, sizes)
├── query-keys.ts            ← TanStack Query key factory
└── navigation.ts            ← Re-exports AppRoute + helpers
```

## Enforcement Checklist (per change)

Before committing any code, scan the diff for:

1. **Bare string paths** — any `"/..."` string literal in `navigate()`, `<Link to>`, `<Route path>`, `<Navigate to>`, `useQuery({ queryKey: ["..."] })` → VIOLATION
2. **Bare numbers** — any `15_000`, `30_000`, `4370`, `65535`, `60`, `3600` etc. that carry domain meaning → VIOLATION
3. **Bare arrays of numbers** — any `[408, 413, ...]` in retry/status logic → VIOLATION

### Exceptions

- **React Router route patterns with parameters** (e.g. `"/devices/:sn/edit"`) are accepted — they're route definitions, not navigation calls.
- **i18n/Lingui `msg` strings** containing example values (e.g. `msg`\"192.168.1.100:4370\"`) are accepted — they're user-facing documentation.
- **Locale files** (`.po`, `.ts` in `locales/`) are auto-generated — do not touch.
- **Test files** may use literal values when they test the constant's behavior.
- **CSS/SCSS values** — design tokens handle those via `var(--ao-*)`.
- **`0`, `1`, `-1`** — too common to extract; use judgment.
- **`1000`** for ms→s conversion — universal constant, acceptable as-is.

## How to Add a New Constant

### For a new route:
1. Add to `shared/paths.ts` → `AppRoute` or `ApiPath`
2. Use `AppRoute.*` everywhere — never type the string

### For a new TanStack Query key:
1. Add to `dashboard/src/lib/query-keys.ts` → `QueryKeys`
2. Use `QueryKeys.*` in both `useQuery` and `invalidateQueries`

### For a new runtime constant:
1. Add to `dashboard/src/lib/constants.ts` with a `SCREAMING_SNAKE_CASE` name
2. Include a JSDoc comment explaining the unit and domain meaning

## Rationale

Magic values spread across 7+ files cause:
- **Drift** — a change in one place is missed in another
- **Opacity** — `4370` means nothing vs `DEFAULT_ZKTECO_PORT`
- **Fragility** — changing a timeout requires hunting through every file
- **Cache bugs** — mismatched query keys mean stale or duplicate data

This rule exists because the codebase accumulated 17 hardcoded paths,
6 instances of `4370` in 5 files, 10+ ad-hoc query key arrays, and
duplicated timeout values before this rule was enacted. The cost of
extracting a constant is seconds. The cost of not doing it is a bug
that survives review.
