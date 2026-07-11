# Rule: Data State Pipeline

Every page that fetches data MUST use a consistent loading → error → empty → data
pipeline. No page is allowed to invent its own error display or state-handling pattern.

## The Pipeline

```
Loading → Error → Empty → Data
   │         │        │       │
   ▼         ▼        ▼       ▼
Spinner   PageError  EmptyState  children
```

## Required Patterns

### 1. Error display MUST use `<PageError>`

```tsx
// ✅ CORRECT
if (error) {
  return (
    <PageLayout>
      <PageBody>
        <PageHeader title={_(msg`Devices`)} description={...} />
        <PageError onRetry={() => refetch()} />
      </PageBody>
    </PageLayout>
  );
}

// ❌ VIOLATION — using EmptyState for errors
{error && <EmptyState title="Failed to load" />}

// ❌ VIOLATION — using Callout for page-level errors (Callout is for inline alerts)
{error && <Callout variant="error" ... />}

// ❌ VIOLATION — raw div / custom component
{error && <div role="alert">...</div>}
```

### 2. Error states MUST have a retry button

```tsx
// ✅ CORRECT — retry button always present
<PageError onRetry={() => refetch()} />

// ❌ VIOLATION — no retry
<PageError />
```

### 3. Empty states MUST use `<EmptyState>`

```tsx
// ✅ CORRECT
<EmptyState
  title={_(msg`No devices`)}
  description={_(msg`Add your first device to get started.`)}
  action={<Button to={AppRoute.devices.new}>Add Device</Button>}
/>

// ❌ VIOLATION — custom empty display
<p>No data found.</p>
```

### 4. Loading states MUST use `<Spinner>` or `<Skeleton>`

```tsx
// ✅ CORRECT — in-place spinner (preferred: keeps layout stable)
{isLoading && <Spinner />}

// ✅ CORRECT — early return (acceptable for simple pages)
if (isLoading) return <PageLayout><PageBody><Spinner /></PageBody></PageLayout>;

// ✅ CORRECT — skeleton (for content-heavy pages)
{isLoading && <DashboardSkeleton />}

// ❌ VIOLATION — no loading indicator
// (user sees blank page with no feedback)
```

### 5. Error takes priority over loading

```tsx
// ✅ CORRECT
if (error) return <ErrorPage />;
if (isLoading) return <LoadingPage />;

// ❌ VIOLATION — loading checked before error
// (user sees spinner forever when error occurs during refetch)
if (isLoading) return <LoadingPage />;
if (error) return <ErrorPage />;
```

### 6. Error state MUST NOT be confused with empty state

```tsx
// ✅ CORRECT — error is handled BEFORE empty is evaluated
if (error) return <ErrorPage />;
const items = query.data ?? [];
if (items.length === 0) return <EmptyPage />;

// ❌ VIOLATION — showing "No items" when the real problem is a network error
const items = query.data ?? [];  // data is undefined on error → items = []
if (items.length === 0) return <EmptyState title="No items" />;
```

## Component Reference

| State | Component | Import |
|-------|-----------|--------|
| Error | `PageError` | `@/components/ui` |
| Loading | `Spinner` | `@/components/ui` |
| Loading (content) | `Skeleton` | `@/components/ui` |
| Empty | `EmptyState` | `@/components/ui` |
| Data boundary | `DataBoundary` | `@/components/ui` |

### PageError API

```tsx
type PageErrorProps = {
  message?: string;       // custom message, defaults to "Server Unreachable"
  onRetry?: () => void;   // retry callback → shows retry button
  icon?: ReactNode;       // custom icon, defaults to server-off icon
};
```

### DataBoundary API (for list pages)

```tsx
type DataBoundaryProps<T> = {
  data: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
  children: (data: T[]) => ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  emptyFallback?: ReactNode;
  onRetry?: () => void;
};
```

## Enforcement Checklist

Before committing any page component, verify:

1. **Error state** — does the page use `PageError` (not EmptyState, not Callout, not raw div)?
2. **Retry button** — does `PageError` have an `onRetry` callback?
3. **Empty state** — does it use `EmptyState` with proper `action` prop?
4. **Loading state** — does the page show a `Spinner` or `Skeleton`?
5. **Priority** — is error checked before loading?
6. **No confusion** — is error checked before the data array is accessed?

## Rationale

Before this rule was enacted, the codebase had:
- **5 different error display patterns** across 9 pages
- **7 of 9 pages missing retry buttons**
- **1 page showing "No API keys" when the backend was unreachable** (critical bug)
- **1 page silently hiding health check failures** (critical bug)
- **EmptyState misused as error display in 4 pages**

The cost of using `<PageError onRetry={refetch} />` instead of `<EmptyState>` is zero.
The cost of confusing error and empty states is a production bug that misleads users.
