import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ClipboardCheck, Loader2, RefreshCw, Search, FileText, ArrowRight, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AppPermission } from '../../types/permissions';

interface Entry {
  id: string;
  student_id: string;
  student_name: string | null;
  mark: string;
  presence_status: string | null;
  is_traveling: number | boolean | null;
  evidence_at: string | null;
  note: string | null;
  absence_case_id: string | null;
}

interface RollCall {
  id: string;
  tenant_id: string;
  lock_date: string;
  lock_time: string | null;
  state: 'open' | 'submitted';
  present_count: number;
  absent_count: number;
  unmarked_count: number;
  excluded_count: number;
  notes: string | null;
  started_at: string;
  submitted_at: string | null;
}

interface Counts { present: number; absent: number; unmarked: number; excluded: number }

type FilterKey = 'all' | 'unmarked' | 'absent' | 'present';

function summarize(entries: Entry[]): Counts {
  const c: Counts = { present: 0, absent: 0, unmarked: 0, excluded: 0 };
  for (const e of entries) {
    if (e.is_traveling) { c.excluded += 1; continue; }
    if (e.mark === 'present') c.present += 1;
    else if (e.mark === 'absent') c.absent += 1;
    else c.unmarked += 1;
  }
  return c;
}

const presenceLabel: Record<string, string> = {
  inside: 'داخل النطاق', outside: 'خارج النطاق', unknown: 'غير معروف',
};

const MARK_OPTIONS: { value: 'present' | 'absent' | 'unmarked'; label: string; active: string; idle: string }[] = [
  { value: 'present', label: 'حاضر', active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20', idle: 'bg-white dark:bg-card-dark text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20' },
  { value: 'absent', label: 'غائب', active: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20', idle: 'bg-white dark:bg-card-dark text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20' },
  { value: 'unmarked', label: 'لم يُحدد', active: 'bg-slate-700 text-white', idle: 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-white/10' },
];

function markLabel(mark: string) {
  return mark === 'present' ? 'حاضر' : mark === 'absent' ? 'غائب' : 'لم يُحدد';
}

export function RollCallPage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, showError, confirm } = useSnackbar();
  const navigate = useNavigate();
  const tenantId = user?.tenantId || '';
  const canManage = hasPermission(AppPermission.MANAGE_ATTENDANCE);

  const [loading, setLoading] = useState(true);
  const [rollCall, setRollCall] = useState<any | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unmarked' | 'absent' | 'present'>('all');
  const [noteFor, setNoteFor] = useState<Entry | null>(null);

  const apply = useCallback((data: any) => {
    if (!data) { setRollCall(null); setEntries([]); return; }
    const { entries: rows, ...session } = data;
    setRollCall(session);
    setEntries(((rows || []) as Entry[]).map((r) => ({ ...r, is_traveling: r.is_traveling ? 1 : 0 })));
  }, []);

  const load = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/roll-call`);
      apply(res?.data ?? null);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر تحميل المناداة');
    } finally {
      setLoading(false);
    }
  }, [request, tenantId, apply, showError]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: when any student answers on their phone, re-pull the sheet so
  // the supervisor sees answers arrive without pressing refresh.
  useEffect(() => {
    if (!tenantId) return;
    const socket = io({ transports: ['websocket', 'polling'], withCredentials: true });
    socket.on('connect', () => socket.emit('join-tenant', tenantId));
    socket.on('roll-call-entry-updated', () => { void load(); });
    return () => { socket.disconnect(); };
  }, [tenantId, load]);

  const counts = useMemo(() => summarize(entries), [entries]);
  const isOpen = rollCall?.state === 'open';

  const visible = useMemo(() => {
    const q = search.trim();
    return entries.filter((e) => {
      if (filter === 'unmarked' && e.mark !== 'unmarked') return false;
      if (filter === 'absent' && e.mark !== 'absent') return false;
      if (filter === 'present' && e.mark !== 'present') return false;
      if (q && !(e.student_name || '').includes(q)) return false;
      return true;
    });
  }, [entries, filter, search]);

  const setMark = (studentId: string, mark: 'present' | 'absent' | 'unmarked') =>
    setEntries((prev) => prev.map((e) => (e.student_id === studentId ? { ...e, mark } : e)));

  const bulkMark = (mark: 'present' | 'absent' | 'unmarked') =>
    setEntries((prev) => prev.map((e) => (e.is_traveling ? e : { ...e, mark })));

  const start = async () => {
    if (!tenantId) return;
    setStarting(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/roll-call`, { method: 'POST' });
      apply(res?.data);
      showSnackbar(res?.message || 'تم بدء المناداة', 'success');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر بدء المناداة');
    } finally {
      setStarting(false);
    }
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!tenantId || !rollCall) return false;
    setSaving(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/roll-call/${rollCall.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify({ entries: entries.map((e) => ({ studentId: e.student_id, mark: e.mark, note: e.note ?? null })) }),
      });
      apply(res?.data);
      return true;
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر حفظ المناداة');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!tenantId || !rollCall) return;
    const pending = counts.unmarked;
    const ok = await confirm({
      title: 'تثبيت المناداة',
      message: pending > 0
        ? `يوجد ${pending} طالب لم يُحدد بعد. سيتم فتح حالة "غير مؤكدة" لهم للمراجعة. هل تريد المتابعة؟`
        : `سيتم تثبيت المناداة وفتح ${counts.absent} حالة غياب. لن يُخطَر أحد تلقائيًا قبل اتخاذ قرار. هل تريد المتابعة؟`,
      type: pending > 0 ? 'warning' : 'info',
    });
    if (!ok) return;
    if (!(await saveDraft())) return;
    setSubmitting(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/roll-call/${rollCall.id}/submit`, { method: 'POST' });
      showSnackbar(res?.message || 'تم تثبيت المناداة', 'success');
      apply(res?.data);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر تثبيت المناداة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ClipboardCheck className="text-primary-500" /> مناداة الليل
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">تحقق يدوي من وجود الطلاب داخل السكن بعد موعد الإغلاق — لا تُفتح أي حالة غياب إلا بتأكيد بشري.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-3 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-400 hover:text-primary-500" title="تحديث">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isOpen && canManage && (
            <>
              <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-200 font-black text-sm hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                حفظ
              </button>
              <button onClick={submit} disabled={submitting || saving} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 disabled:opacity-50 shadow-lg">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                تثبيت المناداة
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : !rollCall ? (
        <div className="bg-white dark:bg-card-dark p-10 rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-500/10 text-primary-500 flex items-center justify-center">
            <Users size={24} />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-800 dark:text-white">لا توجد مناداة لهذه الليلة</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">ابدأ المناداة لعرض جميع المقيمين وتأكيد من هو داخل السكن.</p>
          {canManage ? (
            <button onClick={start} disabled={starting} className="mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 disabled:opacity-50 shadow-lg">
              {starting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              بدء مناداة الليلة
            </button>
          ) : (
            <p className="text-[11px] font-bold text-slate-400 mt-3">لا تملك صلاحية بدء المناداة.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="حاضر" value={counts.present} cls="text-emerald-600 dark:text-emerald-400" />
            <Stat label="غائب" value={counts.absent} cls="text-rose-600 dark:text-rose-400" />
            <Stat label="لم يُحدد" value={counts.unmarked} cls="text-amber-600 dark:text-amber-400" />
            <Stat label="معفى (مسافر)" value={counts.excluded} cls="text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..."
                className="w-full pr-10 pl-4 py-3 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-300 text-slate-800 dark:text-white placeholder:text-slate-400" />
            </div>
            {([['all', 'الكل'], ['unmarked', 'لم يُحدد'], ['absent', 'الغائبون'], ['present', 'الحاضرون']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key as typeof filter)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${filter === key ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-white/10'}`}>
                {label}
              </button>
            ))}
          </div>

          {isOpen && canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-slate-400">تحديد جماعي:</span>
              <button onClick={() => bulkMark('present')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-black hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                <CheckCircle2 size={13} /> الكل حاضر
              </button>
              <button onClick={() => bulkMark('unmarked')} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-200 text-[11px] font-black hover:bg-slate-200 dark:hover:bg-white/10">
                إعادة تعيين
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black text-slate-400">
              تاريخ الإغلاق: {rollCall.lock_date}
              {rollCall.lock_time ? ` — ${rollCall.lock_time}` : ''}
              {rollCall.state === 'submitted' ? ' — مُثبَّتة' : ' — قيد المناداة'}
            </p>
            <button onClick={() => navigate('/absence-cases')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-primary-600 dark:text-primary-400 text-[11px] font-black hover:border-primary-300">
              حالات الغياب <ArrowRight size={13} />
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">لا يوجد طلاب مطابقون للفلتر</div>
          ) : (
            <div className="space-y-2">
              {visible.map((e) => (
                <div key={e.student_id} className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-slate-100 dark:border-white/[0.05] shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">{e.student_name || 'طالب'}</p>
                      {e.is_traveling ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">مسافر (معفى)</span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${e.presence_status === 'inside' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : e.presence_status === 'outside' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300'}`}>
                          {presenceLabel[e.presence_status || 'unknown'] || presenceLabel.unknown}
                        </span>
                      )}
                      {e.note && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300">ملاحظة</span>}
                    </div>
                    {e.evidence_at && <p className="text-[10px] font-bold text-slate-400 mt-1">آخر قراءة موقع: {new Date(e.evidence_at).toLocaleString('ar-EG')}</p>}
                  </div>

                  {e.is_traveling ? (
                    <span className="text-[11px] font-black text-indigo-500 dark:text-indigo-300 px-3 py-2">معفى من المناداة</span>
                  ) : isOpen && canManage ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        {MARK_OPTIONS.map((o) => (
                          <button key={o.value} onClick={() => setMark(e.student_id, o.value)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${e.mark === o.value ? o.active : o.idle}`}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setNoteFor(e)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary-500" title="ملاحظة">
                        <FileText size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-full text-[11px] font-black ${e.mark === 'present' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : e.mark === 'absent' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300'}`}>
                      {markLabel(e.mark)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {noteFor && (
        <NoteModal
          entry={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={(note) => {
            setEntries((prev) => prev.map((x) => (x.student_id === noteFor.student_id ? { ...x, note } : x)));
            setNoteFor(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className={`text-2xl font-black mt-1 ${cls}`}>{value}</p>
    </div>
  );
}

function NoteModal({ entry, onClose, onSave }: { entry: Entry; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState(entry.note || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-card-dark rounded-[2rem] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-500" />
          <h3 className="text-base font-black text-slate-800 dark:text-white">ملاحظة عن {entry.student_name || 'طالب'}</h3>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-300 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none"
          placeholder="مثال: متأخر بإذن مسبق، أو ملاحظة للمشرف..." />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-200 font-black text-sm hover:bg-slate-200 dark:hover:bg-white/10">إلغاء</button>
          <button onClick={() => onSave(note.trim())} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 shadow-lg">حفظ</button>
        </div>
      </div>
    </div>
  );
}
