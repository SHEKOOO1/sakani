
export function StatCard({ label, value, icon, color }: any) {
  const colors: any = {
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400'
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-white/[0.04] dark:bg-card-dark">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-300">{label}</p>
      <h3 className="mt-0.5 text-2xl font-black text-slate-800 dark:text-white">{value}</h3>
    </div>
  );
}

export function AnnualStatCard({ label, value, icon, color }: any) {
  const colors: any = {
    ocean: 'bg-ocean-50 dark:bg-ocean-500/10',
    rose: 'bg-rose-50 dark:bg-rose-500/10',
    primary: 'bg-primary-50 dark:bg-primary-500/10'
  };
  const textColors: any = {
    ocean: 'text-ocean-700 dark:text-ocean-300',
    rose: 'text-rose-700 dark:text-rose-300',
    primary: 'text-primary-700 dark:text-primary-300'
  };
  return (
    <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-5 dark:bg-white/5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">{label}</p>
        <p className={`text-2xl font-black ${textColors[color]}`}>{value}</p>
      </div>
    </div>
  );
}

export function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark flex items-center justify-between">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</span>
      <span className={`text-xl font-black ${accent ? 'text-ocean-600 dark:text-ocean-400' : 'text-slate-800 dark:text-white'}`}>{value}</span>
    </div>
  );
}
