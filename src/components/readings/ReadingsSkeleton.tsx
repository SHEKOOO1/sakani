
export default function ReadingsSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden animate-pulse">
      <div className="p-8 pb-6 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-200 dark:bg-white/10 rounded-2xl" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-slate-200 dark:bg-white/10 rounded-lg" />
            <div className="h-3 w-48 bg-slate-200 dark:bg-white/10 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="p-8 space-y-6">
        <div className="h-28 bg-slate-100 dark:bg-white/5 rounded-2xl" />
        <div className="h-14 bg-slate-100 dark:bg-white/5 rounded-2xl" />
        <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-2xl" />
      </div>
    </div>
  );
}
