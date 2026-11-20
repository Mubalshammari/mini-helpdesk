export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-stone-200 dark:bg-stone-700 ${className}`} />
}

export function TicketDetailSkeleton() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-8 h-8 w-full rounded-full" />
    </div>
  )
}
