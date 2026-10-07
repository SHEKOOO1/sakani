import { ReactNode } from 'react';

interface MiniStatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: 'ocean' | 'warm' | 'rose' | 'primary';
}

export function MiniStatCard({ label, value, icon, color }: MiniStatCardProps) {
  const colors: Record<string, string> = {
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/[0.04] dark:bg-card-dark text-center">
      <div className={`mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <p className="text-xl font-black text-slate-800 dark:text-white">{value}</p>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-300">{label}</p>
    </div>
  );
}
