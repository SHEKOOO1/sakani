export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-white/10 rounded-2xl ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8" dir="rtl">
      <Skeleton className="h-48 rounded-[2.5rem]" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Skeleton className="h-32 rounded-[2rem]" />
        <Skeleton className="h-32 rounded-[2rem]" />
        <Skeleton className="h-32 rounded-[2rem]" />
        <Skeleton className="h-32 rounded-[2rem]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Skeleton className="h-64 rounded-[2.5rem]" />
        <Skeleton className="h-64 rounded-[2.5rem]" />
        <Skeleton className="h-64 rounded-[2.5rem]" />
      </div>
    </div>
  );
}
