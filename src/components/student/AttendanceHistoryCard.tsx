import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { CalendarCheck, AlertTriangle, CheckCircle2, Loader2, Clock } from 'lucide-react';

const RECORD_META: Record<string, { label: string; cls: string }> = {
  present: { label: 'حاضر', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  late: { label: 'متأخر', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  absent: { label: 'غائب', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  excused: { label: 'معذور', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  travel: { label: 'سفر', cls: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300' },
};

interface Props {
  studentId: string;
  limit?: number;
}

export function AttendanceHistoryCard({ studentId, limit = 30 }: Props) {
  const { request } = useApi();
  const [records, setRecords] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await request(`/api/students/${studentId}/attendance/history?limit=${limit}`);
        setRecords(res?.data?.records || []);
        setWarnings(res?.data?.warnings || []);
      } catch {
        // الصمت عند التعذر — لا نكسر صفحة الملف
      } finally {
        setLoading(false);
      }
    })();
  }, [request, studentId, limit]);

  return (
    <div className="bg-white dark:bg-card-dark p-8 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <CalendarCheck size={20} className="text-emerald-500" />
          سجل حضور الفعاليات
        </h3>
        <span className="text-[10px] font-black text-slate-400">{collapsed ? 'عرض' : 'إخفاء'}</span>
      </button>

      {!collapsed && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-sm font-bold text-slate-400">لا توجد سجلات حضور بعد</div>
          ) : (
            <div className="mt-5 space-y-2">
              {records.map((r) => {
                const meta = RECORD_META[r.status] || RECORD_META.present;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">{r.event_title || 'فعالية'}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                        {r.session_title || 'جلسة'}
                        {r.session_start ? ` • ${new Date(r.session_start).toLocaleDateString('ar-EG')}` : ''}
                        {r.checked_in_at ? ` • تسجيل ${new Date(r.checked_in_at).toLocaleTimeString('ar-EG')}` : ''}
                        {r.late_minutes ? ` • تأخر ${r.late_minutes} دقيقة` : ''}
                        {!!r.penalty_amount && r.penalty_status === 'APPLIED' ? ` • غرامة ${r.penalty_amount} ج` : ''}
                        {!!r.penalty_points && r.penalty_status === 'APPLIED' ? ` • -${r.penalty_points} نقطة` : ''}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black shrink-0 ${meta.cls}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-500" />
                إنذارات الغياب ({warnings.length})
              </p>
              <div className="space-y-2">
                {warnings.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                    <p className="text-xs font-black text-amber-800 dark:text-amber-200">{w.warning_trigger_reason || 'إنذار حضور'}</p>
                    <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1 shrink-0">
                      <Clock size={11} />
                      {w.created_at ? new Date(w.created_at).toLocaleDateString('ar-EG') : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {records.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <CheckCircle2 size={12} className="text-emerald-500" />
              يُحدَّث تلقائياً بعد كل جلسة
            </div>
          )}
        </>
      )}
    </div>
  );
}