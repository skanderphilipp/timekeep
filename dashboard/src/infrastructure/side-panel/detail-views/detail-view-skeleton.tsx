import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for side panel detail views.
 *
 * Renders placeholder blocks that match the layout of a typical detail view.
 */
export function DetailViewSkeleton() {
  return (
    <div style={{ padding: "0" }}>
      {/* Header skeleton */}
      <div style={{ padding: "16px 24px" }}>
        <Skeleton width="60%" height="24px" />
      </div>

      <div style={{ padding: "0 24px" }}>
        <Skeleton width="100%" height="1px" />
      </div>

      {/* Detail list skeleton */}
      <div
        style={{
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <Skeleton width="30%" height="12px" />
          <Skeleton width="50%" height="16px" />
        </div>
        <div>
          <Skeleton width="25%" height="12px" />
          <Skeleton width="40%" height="16px" />
        </div>
        <div>
          <Skeleton width="35%" height="12px" />
          <Skeleton width="60%" height="16px" />
        </div>
      </div>
    </div>
  );
}
