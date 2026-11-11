export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-surface-2/60" />
      ))}
    </div>
  );
}
