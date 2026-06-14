function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-app bg-app-surface-muted/80 ${className}`}
      aria-hidden
    />
  );
}

export default function AppPageFallback() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[82rem] space-y-5" role="status" aria-label="Loading page">
      <div className="app-card space-y-4 p-6 sm:p-8">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-8 w-64 max-w-full" />
        <SkeletonBlock className="h-4 w-full max-w-md" />
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="app-card space-y-4 p-5 sm:p-6">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
