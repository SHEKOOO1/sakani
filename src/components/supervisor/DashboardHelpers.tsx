import { TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, XCircle, Clock, Activity, ChevronLeft } from 'lucide-react';

export function QuickActionCard({ label, value, icon, color, onClick, subtitle }: any) {
  const chip: any = {
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    ocean: 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400',
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400'
  };
  const number: any = {
    primary: 'text-primary-700 dark:text-primary-300',
    ocean: 'text-ocean-700 dark:text-ocean-300',
    rose: 'text-rose-700 dark:text-rose-300',
    vibrant: 'text-vibrant-700 dark:text-vibrant-300',
    warm: 'text-warm-700 dark:text-warm-300'
  };
  const c = chip[color] || chip.primary;
  const n = number[color] || number.primary;
  return (
    <button
      onClick={onClick}
      className="group relative rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-white dark:bg-card-dark p-5 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c}`}>{icon}</div>
        <span className={`text-2xl font-black leading-none ${n}`}>{value}</span>
      </div>
      <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
      {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-300">{subtitle}</p>}
      {onClick && (
        <div className="absolute left-3 bottom-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:text-primary-500 dark:bg-white/10 dark:text-slate-500 dark:group-hover:text-primary-400">
          <ChevronLeft size={14} />
        </div>
      )}
    </button>
  );
}

export function AlertBadge({ label, value, icon, color, onClick }: any) {
  const chip: any = {
    rose: 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    warm: 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400',
    primary: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    vibrant: 'bg-vibrant-50 dark:bg-vibrant-500/20 text-vibrant-600 dark:text-vibrant-400'
  };
  const ring: any = {
    rose: 'border-rose-100 dark:border-rose-500/20',
    warm: 'border-warm-100 dark:border-warm-500/20',
    primary: 'border-primary-100 dark:border-primary-500/20',
    vibrant: 'border-vibrant-100 dark:border-vibrant-500/20'
  };
  const c = chip[color] || chip.primary;
  const r = ring[color] || ring.primary;
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-right transition-all dark:bg-card-dark ${r} ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-black text-slate-800 dark:text-white">{value ?? 0}</p>
        <p className="truncate text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
      </div>
      {onClick && <ChevronLeft size={16} className="shrink-0 text-slate-300 dark:text-slate-500" />}
    </Comp>
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
    <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${colors[status] || 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'}`}>
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
  const key = (action || '').toLowerCase();
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
      {icons[key] || <Activity size={16} className="text-slate-400 dark:text-slate-300" />}
    </div>
  );
}