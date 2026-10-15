import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AppPermission } from '../../types/permissions';
import {
  AlertTriangle, MapPinOff, ShieldAlert, CheckCircle2, Loader2, RefreshCw,
  Gavel, BellRing, MapPin,
} from 'lucide-react';

type CaseRow = {
  id: string;
  student_id: string;
  student_name?: string;
  lock_date: string;
  state: string;
  evidence_lat?: number | null;
  evidence_lng?: number | null;
  evidence_at?: string | null;
  ack_at?: string | null;
  decision_action?: string | null;
  decision_notes?: string | null;
  fine_amount?: number | null;
  escalated_to_priest?: number | boolean | null;
  escalation_count?: number | null;
  created_at?: string | null;
};

const ACTIONS: { value: string; label: string }[] = [
  { value: 'warning', label: 'إنذار رسمي' },
  { value: 'points', label: 'خصم نقاط' },
  { value: 'fine', label: 'غرامة مالية' },
  { value: 'review_only', label: 'مراجعة فقط (إغلاق بلا إجراء)' },
  { value: 'terminate', label: 'إنهاء الإقامة وأرشفة' },
];

const ACTION_LABEL: Record<string, string> = {
  warning: 'إنذار', points: 'خصم نقاط', fine: 'غرامة', review_only: 'مراجعة', terminate: 'إنهاء',
};

function stateMeta(c: CaseRow) {
  if (c.state === 'closed') return { label: 'مُغلقة', cls: 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300' };
  if (c.state === 'unconfirmed') return { label: 'غير مؤكدة — يحتاج حضور', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' };
  return { label: 'مفتوحة', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' };
}

export function AbsenceCasesPage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar, showError, confirm } = useSnackbar();
  const tenantId = user?.tenantId || '';

  const canManage = hasPermission(AppPermission.MANAGE_ATTENDANCE);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all' | 'closed'>('open');
  const [active, setActive] = useState<CaseRow | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/absence-cases`);
      setRows(res?.data || []);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر تحميل حالات الغياب');
    } finally {
      setLoading(false);
    }
  }, [request, tenantId, showError]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'closed') return rows.filter((r) => r.state === 'closed');
    return rows.filter((r) => r.state !== 'closed');
  }, [rows, filter]);

  const openCount = rows.filter((r) => r.state === 'open').length;
  const unconfirmedCount = rows.filter((r) => r.state === 'unconfirmed').length;

  const runCheck = async () => {
    if (!tenantId) return;
    setRunning(true);
    try {
      const res = await request(`/api/tenants/${tenantId}/absence-cases/run-check`, { method: 'POST' });
      const opened = res?.data?.open ?? 0;
      showSnackbar(opened ? `تم فتح ${opened} حالة غياب جديدة` : 'تم الفحص — لا حالات جديدة', 'success');
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر تنفيذ الفحص');
    } finally {
      setRunning(false);
    }
  };

  const ack = async (c: CaseRow) => {
    if (!tenantId) return;
    try {
      await request(`/api/tenants/${tenantId}/absence-cases/${c.id}/ack`, { method: 'POST' });
      showSnackbar('تم تأكيد الاستلام', 'success');
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'تعذر تأكيد الاستلام');
    }
  };

  const submitDecision = async (c: CaseRow, body: Record<string, any>) => {
    if (!tenantId) return;
    await request(`/api/tenants/${tenantId}/absence-cases/${c.id}/decision`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ShieldAlert className="text-rose-500" /> حالات الغياب عن السكن
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">متابعة الطلاب غير الموجودين داخل نطاق السكن بعد موعد الإغلاق واتخاذ القرار المناسب.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-3 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-400 hover:text-primary-500" title="تحديث">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={runCheck} disabled={running} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 disabled:opacity-50 shadow-lg">
              {running ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
              فحص الآن
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="مفتوحة" value={openCount} cls="text-rose-600 dark:text-rose-400" />
        <Stat label="غير مؤكدة" value={unconfirmedCount} cls="text-amber-600 dark:text-amber-400" />
        <Stat label="الإجمالي" value={rows.length} cls="text-slate-600 dark:text-slate-300" />
      </div>

      <div className="flex gap-2">
        {([['open', 'المفتوحة'], ['all', 'الكل'], ['closed', 'المُغلقة']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filter === key ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-white/10'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center text-sm font-bold text-slate-400">لا توجد حالات مطابقة</div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => <CaseCard key={c.id} c={c} canManage={canManage} onAck={() => ack(c)} onDecide={() => setActive(c)} />)}
        </div>
      )}

      {active && tenantId && (
        <DecisionModal
          caseRow={active}
          onClose={() => setActive(null)}
          onConfirm={confirm}
          onSubmit={async (body) => {
            await submitDecision(active, body);
            setActive(null);
            showSnackbar('تم تسجيل القرار', 'success');
            await load();
          }}
          onError={(msg) => showError(msg)}
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

function CaseCard({ c, canManage, onAck, onDecide }: { c: CaseRow; canManage: boolean; onAck: () => void; onDecide: () => void }) {
  const meta = stateMeta(c);
  const confirmedOutside = c.state === 'open';
  return (
    <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-slate-100 dark:border-white/[0.05] shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${confirmedOutside ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
          {confirmedOutside ? <MapPinOff size={18} /> : <AlertTriangle size={18} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-slate-800 dark:text-white">{c.student_name || 'طالب'}</p>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${meta.cls}`}>{meta.label}</span>
            {!!c.escalated_to_priest && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">أُحيل للكاهن</span>}
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
            <span>تاريخ الإغلاق: {c.lock_date}</span>
            {c.evidence_at && <span className="flex items-center gap-1"><MapPin size={11} /> آخر قراءة: {new Date(c.evidence_at).toLocaleString('ar-EG')}</span>}
            {c.decision_action && <span>القرار: {ACTION_LABEL[c.decision_action] || c.decision_action}</span>}
            {c.fine_amount ? <span>غرامة: {c.fine_amount}</span> : null}
            {!!c.escalation_count && c.escalation_count > 0 && <span>تصعيدات: {c.escalation_count}</span>}
          </p>
        </div>
      </div>

      {canManage && c.state !== 'closed' && (
        <div className="flex items-center gap-2">
          {!c.ack_at && (
            <button onClick={onAck} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-200 font-black text-xs hover:bg-slate-200 dark:hover:bg-white/10">
              <CheckCircle2 size={14} /> تأكيد الاستلام
            </button>
          )}
          <button onClick={onDecide} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-black text-xs hover:bg-primary-700 shadow-lg">
            <Gavel size={14} /> اتخاذ قرار
          </button>
        </div>
      )}
    </div>
  );
}

function DecisionModal({ caseRow, onClose, onSubmit, onError, onConfirm }: {
  caseRow: CaseRow;
  onClose: () => void;
  onSubmit: (body: Record<string, any>) => Promise<void>;
  onError: (msg: string) => void;
  onConfirm: (opts: { title: string; message: string; type?: 'danger' | 'warning' | 'info' }) => Promise<boolean>;
}) {
  const [action, setAction] = useState('warning');
  const [notes, setNotes] = useState('');
  const [points, setPoints] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [warningPenalty, setWarningPenalty] = useState<'none' | 'points' | 'fine'>('none');
  const [warningAmount, setWarningAmount] = useState('');
  const [escalateToPriest, setEscalateToPriest] = useState(false);
  const [priestNote, setPriestNote] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls = 'w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-300 dark:text-white';

  const submit = async () => {
    const body: Record<string, any> = { action, notes, escalateToPriest, priestNote };
    if (action === 'points') {
      const n = Number(points);
      if (!Number.isFinite(n) || n <= 0) return onError('أدخل عدد نقاط صحيح');
      body.points = n;
    }
    if (action === 'fine') {
      const n = Number(fineAmount);
      if (!Number.isFinite(n) || n <= 0) return onError('أدخل قيمة غرامة صحيحة');
      body.fineAmount = n;
    }
    if (action === 'warning' && warningPenalty !== 'none') {
      const n = Number(warningAmount);
      if (!Number.isFinite(n) || n <= 0) {
        return onError(warningPenalty === 'points' ? 'أدخل عدد نقاط صحيح' : 'أدخل قيمة غرامة صحيحة');
      }
      body.penalty = { type: warningPenalty, amount: n };
    }
    if (action === 'terminate') {
      const ok = await onConfirm({
        title: 'تأكيد إنهاء الإقامة',
        message: `سيتم أرشفة ملف الطالب ${caseRow.student_name || ''} وإنهاء إقامته نهائياً. هل أنت متأكد؟`,
        type: 'danger',
      });
      if (!ok) return;
      body.confirm = true;
    }
    setSaving(true);
    try {
      await onSubmit(body);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'تعذر حفظ القرار');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-card-dark rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Gavel size={18} className="text-primary-500" /> قرار بشأن {caseRow.student_name || 'طالب'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-black">إغلاق</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">نوع القرار</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {action === 'points' && (
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">عدد النقاط المخصومة</label>
              <input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} className={inputCls} />
            </div>
          )}

          {action === 'fine' && (
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">قيمة الغرامة</label>
              <input type="number" min={1} value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} className={inputCls} />
            </div>
          )}

          {action === 'warning' && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
              <label className="block text-xs font-black text-slate-500 dark:text-slate-300">عقوبة مقرونة بالإنذار (اختياري)</label>
              <div className="flex gap-2">
                {([['none', 'بدون عقوبة'], ['points', 'خصم نقاط'], ['fine', 'غرامة مالية']] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setWarningPenalty(key)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${warningPenalty === key ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-white/10'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {warningPenalty !== 'none' && (
                <input type="number" min={1} value={warningAmount} onChange={(e) => setWarningAmount(e.target.value)}
                  className={inputCls}
                  placeholder={warningPenalty === 'points' ? 'عدد النقاط المخصومة' : 'قيمة الغرامة'} />
              )}
              <p className="text-[10px] font-bold text-slate-400">سيتم إخطار الطالب وولي الأمر بالإنذار وسبب العقوبة عند الحفظ.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">ملاحظات القرار</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="سبب القرار أو تفاصيل إضافية..." />
          </div>

          <label className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-200">
            <input type="checkbox" checked={escalateToPriest} onChange={(e) => setEscalateToPriest(e.target.checked)} className="accent-violet-500" />
            إحالة الحالة إلى الأب الكاهن المسؤول
          </label>

          {escalateToPriest && (
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-300 mb-1.5">ملاحظة للكاهن</label>
              <textarea value={priestNote} onChange={(e) => setPriestNote(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </div>
          )}

          {action === 'terminate' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
              إنهاء الإقامة إجراء نهائي: يُؤرشف ملف الطالب ويُخرجه من غرفته. سيُطلب تأكيد إضافي.
            </div>
          )}

          <button onClick={submit} disabled={saving} className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            حفظ القرار
          </button>
        </div>
      </div>
    </div>
  );
}
