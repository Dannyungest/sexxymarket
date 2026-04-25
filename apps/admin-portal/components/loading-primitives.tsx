import { SurfaceCard } from "@sexxymarket/ui";

export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton" style={{ height: 96, borderRadius: 16 }} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap" style={{ marginTop: 10 }} aria-hidden="true">
      <div className="panel-stack" style={{ gap: 8 }}>
        <div className="skeleton" style={{ height: 34, borderRadius: 10 }} />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: 56, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel-stack" style={{ marginTop: 10, gap: 10 }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="panel-stack" style={{ gap: 6 }}>
          <div className="skeleton" style={{ width: 140, height: 12 }} />
          <div className="skeleton" style={{ height: 42 }} />
        </div>
      ))}
    </div>
  );
}

export function PageSectionSkeleton() {
  return (
    <SurfaceCard style={{ padding: "1rem" }} aria-hidden="true">
      <div className="skeleton" style={{ width: 120, height: 12, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "min(100%, 320px)", height: 28, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: "100%", height: 48 }} />
    </SurfaceCard>
  );
}
