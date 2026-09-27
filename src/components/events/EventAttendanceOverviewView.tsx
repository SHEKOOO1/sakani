import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ListChecks, Loader2, RefreshCw, CheckCircle2, XCircle, CalendarClock,
  Users, AlarmClock, Banknote, FileText, BadgeCheck,
} from 'lucide-react';
import { AppPermission } from '../../types/permissions';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  present: { label: 'حاضر', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  late: { label: 'متأخر', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  absent: { label: 'غائب', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  excused: { label: 'معذور', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  travel: { label: 'سفر', cls: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  none: { label: 'بلا تسجيل', cls: 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300' },
};

const EXCUSE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'بانتظار المراجعة', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  APPROVED: { label: 'مقبول', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  REJECTED: { label: 'مرفوض', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

const COUNT_CARDS: { key: string; label: string; cls: string; icon: any }[] = [
  { key: 'present', label: 'حاضر', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20', icon: CheckCircle2 },
  { key: 'late', label: 'متأخر', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/20', icon: AlarmClock },
  { key: 'absent', label: 'غائب', cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-500/20', icon: XCircle },
  { key: 'excused', label: 'معتذر', cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-100 dark:border-sky-500/20', icon: FileText },
  { key: 'travel', label: 'سفر', cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-500/20', icon: BadgeCheck },
];

interface EventAttendanceOverviewViewProps {
  selectedEvent: any;
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (message: string, type?: any) => void;
  hasPermission?: (perm: AppPermission) => boolean;
}

export function EventAttendanceOverviewView({ selectedEvent, request, showSnackbar, hasPermission }: EventAttendanceOverviewViewProps) {
  const [data, setData] = useState<any>({ counts: {}, rows: [], event: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance/overview`);
      if (res.success && res.data) setData(res.data);
    } catch (e) {
      console.error('Load overview failed:', e);
      showSnackbar('فشل تحميل كشف الحضور', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent.id, request, showSnackbar]);

  useEffect(() => { load(); }, [load]);

  const decide = async (excuse: any, decision: 'APPROVED' | 'REJECTED') => {
    setBusy(`exc-${excuse.id}`);
    try {
      const res = await request(`/api/attendance/excuses/${excuse.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: null }),
      });
      if (res.success) {
        showSnackbar(decision === 'APPROVED' ? 'تم قبول العذر' : 'تم رفض العذر', 'success');
        load();
      } else {
        showSnackbar(res.message || 'تعذر البت في العذر', 'error');
      }
    } catch (e) {
      console.error('Decide excuse failed:', e);
      showSnackbar('تعذر البت في العذر', 'error');
    } finally {
      setBusy(null);
    }
  };

  const deadline = data.event?.excuseDeadlineMinutes != null && data.event?.excuseDeadlineMinutes > 0
    ? `آخر موعد لتقديم العذر: قبل الفعالية بـ ${data.event.excuseDeadlineMinutes} دقيقة`
    : 'لا يوجد موعد محدد للأعذار (ممكن تقديم عذر في أي وقت قبل الفعالية)';

  const rules = data.rules;
  const ruleSummary = rules ? (() => {
    const parts: string[] = [];
    if (rules.required_attendance) parts.push('الحضور إلزامي');
    if (rules.grace_period_minutes > 0) parts.push(`مهلة سماح ${rules.grace_period_minutes} دقيقة`);
    if (rules.absent_after_minutes) parts.push(`يُعد غائباً بعد ${rules.absent_after_minutes} دقيقة`);
    if (rules.penalty_mode && rules.penalty_mode !== 'NONE') {
      const extra = rules.additional_penalty
        ? rules.additional_penalty_unit === 'PER_MINUTE'
          ? ` + ${rules.additional_penalty} ج/${rules.additional_penalty_block_minutes} دقيقة`
          : ` + ${rules.additional_penalty} ج/دقيقة`
        : '';
      parts.push(`الغرامة الأساسية ${rules.base_penalty} ج${extra}${rules.maximum_penalty ? ` (السقف ${rules.maximum_penalty} ج)` : ''}`);
      if (rules.base_points > 0) parts.push(`خصم ${rules.base_points} نقطة${rules.maximum_points_deduction ? ` (سقف ${rules.maximum_points_deduction})` : ''}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'بعمل وفق قوانين الفعالية المخصصة';
  })() : null;

  const total = Object.keys(data.counts).reduce((s, k) => s + (typeof data.counts[k] === 'number' ? data.counts[k] : 0), 0);

  const canDecide = hasPermission ? hasPermission(AppPermission.MANAGE_EVENT_ATTENDANCE) : true;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="overview" className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">كشف الحضور والأعذار</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 max-w-2xl leading-relaxed">
          نظرة مجمّعة على كل طلاب السكن في «{selectedEvent.title}» — الحالة (حاضر/متأخر/غائب/معتذر) وفق قوانين الفعالية، والغرامات الموقعة، وأعذار الطلاب مع القبول أو الرفض.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
        <CalendarClock size={18} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{deadline}</div>
      </div>

      {ruleSummary && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-ocean-50 dark:bg-ocean-500/10 border border-ocean-200 dark:border-ocean-500/20">
          <ListChecks size={18} className="text-ocean-600 dark:text-ocean-400 shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="text-ocean-700 dark:text-ocean-300 font-black">قوانين الفعالية: </span>
            {ruleSummary}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full sm:w-auto">
          {COUNT_CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border ${c.cls}`}>
                <Icon size={15} className="shrink-0" />
                <span className="text-[11px] font-black">{data.counts[c.key] ?? 0}</span>
                <span className="text-[10px] font-black opacity-80">{c.label}</span>
              </div>
            );
          })}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-200 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
            <ListChecks size={15} className="text-neon-primary" /> جدول الحضور والمخالفات
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[10px] text-slate-500 dark:text-slate-300 font-black">{total} طالب</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={22} className="animate-spin text-primary-600" />
          </div>
        ) : data.rows.length === 0 ? (
          <p className="py-10 text-center text-[11px] font-bold text-slate-400">لا يوجد طلاب مسجلون في هذا السكن بعد — الكشف يعرض كل طلاب السكن حتى لو لم يسجلوا حضوراً.</p>
        ) : (
          <div className="space-y-2">
            {data.rows.map((row: any, idx: number) => {
              const meta = STATUS_META[row.status] || STATUS_META.none;
              const excuse = row.excuse;
              const esc = excuse ? EXCUSE_STATUS[excuse.status] || EXCUSE_STATUS.PENDING : null;
              const hasPenalty = row.penalty_financial > 0 || row.penalty_points > 0;
              return (
                <div key={row.student_id || idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${meta.cls}`}>{meta.label}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{row.name || 'طالب'}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">
                          {[row.student_id_number, row.class_name].filter(Boolean).join(' • ') || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {row.late_minutes > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[10px] font-black">
                          <AlarmClock size={11} /> تأخر {row.late_minutes} دقيقة
                        </span>
                      )}
                      {row.penalty_financial > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[10px] font-black">
                          <Banknote size={11} /> {row.penalty_financial} جنيه
                        </span>
                      )}
                      {row.penalty_points > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 text-[10px] font-black">
                          خصم {row.penalty_points} نقطة
                        </span>
                      )}
                      {!hasPenalty && <span className="text-[10px] font-bold text-slate-300 dark:text-slate-500">بلا مخالفات</span>}
                    </div>
                  </div>

                  {row.penalty_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {row.penalty_reasons.map((r: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-lg bg-white dark:bg-white/5 border border-rose-100 dark:border-rose-500/20 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(row.presence) && row.presence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-black text-slate-400">تفاصيل الوجود:</span>
                      {row.presence.map((p: any, i: number) => {
                        const pm = STATUS_META[p.status] || STATUS_META.none;
                        return (
                          <span key={i} className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${pm.cls}`}>
                            {pm.label}
                            {Number(p.late_minutes || 0) > 0 ? ` (+${p.late_minutes})` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {excuse && (
                    <div className={`p-3 rounded-xl border ${excuse.status === 'PENDING' ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          {esc && <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${esc.cls}`}>{esc.label}</span>}
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                            عذر: {excuse.reason}
                            {excuse.submitted_at ? ` — ${new Date(excuse.submitted_at).toLocaleString('ar-EG')}` : ''}
                          </p>
                        </div>
                        {excuse.status === 'PENDING' && canDecide && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => decide(excuse, 'APPROVED')} disabled={busy === `exc-${excuse.id}`}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                              {busy === `exc-${excuse.id}` ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} قبول العذر
                            </button>
                            <button onClick={() => decide(excuse, 'REJECTED')} disabled={busy === `exc-${excuse.id}`}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700 disabled:opacity-50 transition-colors">
                              <XCircle size={11} /> رفض العذر
                            </button>
                          </div>
                        )}
                      </div>
                      {(excuse.decided_notes || excuse.decided_at) && (
                        <p className="text-[9px] font-bold text-slate-400 mt-1.5">
                          {excuse.decided_at ? `تم البت بتاريخ ${new Date(excuse.decided_at).toLocaleString('ar-EG')}` : ''}
                          {excuse.decided_notes ? ` — ملاحظة: ${excuse.decided_notes}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
        <Users size={13} className="shrink-0" />
        يعرض الكشف كل طلاب السكن (حاضر/متأخر/غائب/معتذر) مع الغرامات الموقعة وفق قوانين الفعالية. الطلاب الذين لم يسجلوا حضوراً ولا قدموا عذراً تظهر حالتهم «بلا تسجيل».
        {canDecide && ' — أزرار قبول/رفض الأعذار تظهر لمن يملك صلاحية إدارة الحضور.'}
      </div>
    </motion.div>
  );
}