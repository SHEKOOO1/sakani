import { TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';

export function QuickActionCard({ label, value, icon, color, onClick, subtitle }: any) {
  const colors: any = {
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/30',
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400 hover:bg-ocean-100 dark:hover:bg-ocean-500/30',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400 hover:bg-vibrant-100 dark:hover:bg-vibrant-500/30',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-warm-500/30'
  };
  return (
    <button onClick={onClick} className={`rounded-xl border border-slate-100 p-5 shadow-sm transition-all text-right group dark:border-white/10 dark:bg-card-dark ${colors[color]}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-card-dark">{icon}</div>
        <span className="text-xl font-black">{value}</span>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      {subtitle && <p className="text-[8px] font-bold opacity-50 mt-0.5">{subtitle}</p>}
    </button>
  );
}

export function AlertBadge({ label, value, icon, color, onClick }: any) {
  const colors: any = {
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
    warm: 'bg-warm-50 dark:bg-warm-500/10 text-warm-600 dark:text-warm-400 border-warm-100 dark:border-warm-500/20',
    primary: 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-500/20',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/10 text-vibrant-600 dark:text-vibrant-400 border-vibrant-100 dark:border-vibrant-500/20'
  };
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 ${colors[color]} flex items-center gap-3 hover:brightness-95 transition-all`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/60 dark:bg-white/10">{icon}</div>
      <div className="text-right">
        <p className="text-lg font-black">{value ?? 0}</p>
        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      </div>
    </button>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: any = {
    pending: 'bg-warm-400',
    assigned: 'bg-primary-400',
    in_progress: 'bg-vibrant-400',
    completed: 'bg-ocean-400',
    rejected: 'bg-rose-400'
  };
  return <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${colors[status] || 'bg-slate-300'}`} />;
}

export function StatusBadge({ status }: { status: string }) {
  const labels: any = {
    pending: 'معلق',
    assigned: 'تم التكليف',
    in_progress: 'قيد التنفيذ',
    completed: 'منجز',
    rejected: 'مرفوض'
  };
  const colors: any = {
    pending: 'bg-warm-100 dark:bg-warm-500/20 text-warm-700 dark:text-warm-300',
    assigned: 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300',
    in_progress: 'bg-vibrant-100 dark:bg-vibrant-500/20 text-vibrant-700 dark:text-vibrant-300',
    completed: 'bg-ocean-100 dark:bg-ocean-500/20 text-ocean-700 dark:text-ocean-300',
    rejected: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
  };
  return (
    <span className={`text-[9px] font-black px-2 py-1 rounded-lg shrink-0 ${colors[status] || 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'}`}>
      {labels[status] || status}
    </span>
  );
}

export function DecisionIcon({ action }: { action: string }) {
  const icons: any = {
    add_points: <TrendingUp size={16} className="text-ocean-500" />,
    deduct_points: <TrendingDown size={16} className="text-rose-500" />,
    issue_warning: <ShieldAlert size={16} className="text-warm-500" />,
    approve_reward: <CheckCircle2 size={16} className="text-ocean-500" />,
    reject_reward: <XCircle size={16} className="text-rose-500" />,
    mark_absent: <Clock size={16} className="text-rose-500" />
  };
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
      {icons[action] || <Activity size={16} className="text-slate-400 dark:text-slate-300" />}
    </div>
  );
}
