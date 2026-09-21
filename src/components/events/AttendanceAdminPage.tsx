import { useState, useCallback, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  ShieldCheck, Settings2, AlertTriangle, Loader2, RefreshCw, Save, CheckCircle2,
  XCircle, Gavel, FileText, Calendar, Users, Filter, ChevronDown, Plus, Trash2, ListChecks
} from 'lucide-react';

type Tab = 'risk' | 'policy' | 'rules';

const RULE_CONDITIONS = [
  { value: 'late', label: 'تأخر' },
  { value: 'absent', label: 'غياب (مبرر أو غير مبرر)' },
  { value: 'unexcused', label: 'غياب غير مبرر' },
];
const RULE_ACTIONS = [
  { value: 'NONE', label: 'لا يوجد إجراء' },
  { value: 'DEDUCT_POINTS', label: 'خصم نقاط سلوكية' },
  { value: 'FINANCIAL_FEE', label: 'غرامة مالية' },
  { value: 'SEND_NOTIFICATION', label: 'إرسال إشعار' },
  { value: 'EXCLUDE_FROM_RESIDENCE', label: 'مراجعة إنهاء السكن' },
];
const ruleRow = (sort_order: number) => ({
  id: undefined as string | undefined,
  condition_status: 'unexcused',
  condition_min_late_minutes: null as number | null,
  condition_max_late_minutes: null as number | null,
  action_type: 'FINANCIAL_FEE',
  points_amount: 0,
  fee_amount: 0,
  notification_message: null as string | null,
  enabled: true,
  sort_order,
});

// حقل رقمي تُعرض بجانبه وحدة القياس دائمًا (دقيقة / نقطة / جنيه)
function UnitInput({ value, onChange, unit, placeholder, min = 0, step = 1 }: any) {
  return (
    <div className="relative">
      <input type="number" dir="ltr" min={min} step={step} placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-16 pr-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none text-right placeholder:text-right placeholder:font-bold"
        inputMode="decimal" />
      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-[10px] font-black text-slate-400 pointer-events-none">
        {unit}
      </span>
    </div>
  );
}

const RISK_META: Record<string, { label: string; cls: string }> = {
  ok: { label: 'طبيعي', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  elevated: { label: 'تنبيه', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  medium: { label: 'إنذار نهائي', cls: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  high: { label: 'مراجعة تأديبية', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  critical: { label: 'مراجعة إنهاء السكن', cls: 'bg-red-100 dark:bg-red-600/15 text-red-700 dark:text-red-300' },
};

const CASE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'مفتوحة', cls: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  UNDER_REVIEW: { label: 'قيد المراجعة', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  APPROVED: { label: 'مقبولة', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  REJECTED: { label: 'مرفوضة', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  CLOSED: { label: 'مغلقة', cls: 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300' },
};

function NumberField(props: { label: string; value: any; onChange: (v: any) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">{props.label}</span>
      <input
        type="number"
        value={props.value ?? ''}
        onChange={(e) => props.onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="mt-1 w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/40 outline-none"
      />
      {props.hint && <span className="text-[10px] text-slate-400 font-bold">{props.hint}</span>}
    </label>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => props.onChange(!props.value)} className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
      <span className="text-xs font-black text-slate-700 dark:text-white">{props.label}</span>
      <span className={`w-10 h-5.5 p-0.5 rounded-full transition-colors ${props.value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} style={{ height: 22, width: 40 }}>
        <span className={`block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${props.value ? 'translate-x-0' : 'translate-x-4.5'}`} style={{ width: 18, height: 18, transform: props.value ? 'translateX(0)' : 'translateX(18px)' }} />
      </span>
    </button>
  );
}

export function AttendanceAdminPage() {
  const { request } = useApi();
  const [tab, setTab] = useState<Tab>('risk');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/admin/my-tenants');
        const list = res?.data || [];
        setTenants(list);
        if (list.length > 0) setTenantId((prev) => prev || list[0].id);
      } catch { }
    })();
  }, [request]);

  // ── Risk / cases ──
  const [risk, setRisk] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [excuses, setExcuses] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);

  const loadRisk = useCallback(async (tid: string) => {
    setRiskLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        request(`/api/tenants/${tid}/attendance/risk-report`),
        request(`/api/tenants/${tid}/attendance/cases`),
      ]);
      setRisk(r1?.data || []);
      setCases(r2?.data?.cases || []);
      setExcuses(r2?.data?.pendingExcuses || []);
      setWarnings(r2?.data?.warnings || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل تقرير المخاطر');
    } finally {
      setRiskLoading(false);
    }
  }, [request]);

  const decideExcuse = async (excuse: any, decision: 'APPROVED' | 'REJECTED') => {
    setBusy(`excuse-${excuse.id}`);
    try {
      await request(`/api/attendance/excuses/${excuse.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: null }),
      });
      flash(true, decision === 'APPROVED' ? 'تم قبول العذر' : 'تم رفض العذر');
      if (tenantId) await loadRisk(tenantId);
    } catch (e: any) {
      flash(false, e.message || 'تعذر البت في العذر');
    } finally {
      setBusy(null);
    }
  };

  const decideCase = async (c: any, decision: 'APPROVED' | 'REJECTED' | 'CLOSED') => {
    setBusy(`case-${c.id}`);
    try {
      await request(`/api/tenants/${tenantId}/attendance/cases/${c.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: null }),
      });
      flash(true, 'تم تسجيل القرار (لا يتغير وضع الطالب تلقائياً)');
      if (tenantId) await loadRisk(tenantId);
    } catch (e: any) {
      flash(false, e.message || 'تعذر حفظ القرار');
    } finally {
      setBusy(null);
    }
  };

  // ── Policy ──
  const [policy, setPolicy] = useState<any>(null);
  const [policyHist, setPolicyHist] = useState<any[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);

  const loadPolicy = useCallback(async (tid: string) => {
    setPolicyLoading(true);
    try {
      const res = await request(`/api/tenants/${tid}/attendance/policy`);
      setPolicy(res?.data?.policy || null);
      setPolicyHist(res?.data?.history || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل السياسة');
    } finally {
      setPolicyLoading(false);
    }
  }, [request]);

  const savePolicy = async () => {
    if (!policy) return;
    setBusy('policy');
    try {
      const res = await request(`/api/tenants/${tenantId}/attendance/policy`, {
        method: 'PUT',
        body: JSON.stringify({ ...policy, note: policy.note || null }),
      });
      flash(true, (res as any)?.message || 'تم تحديث السياسة');
      await loadPolicy(tenantId);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحديث السياسة');
    } finally {
      setBusy(null);
    }
  };

  // ── Rules ──
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [rules, setRules] = useState<{ eventRule: any; sessionRules: any[] } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [ruleForm, setRuleForm] = useState<any>(null);
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, any>>({});
  const [eventRules, setEventRules] = useState<any[]>([]);
  const [evaluationMode, setEvaluationMode] = useState('ALL_APPLICABLE');
  const [excuseDeadlineMinutes, setExcuseDeadlineMinutes] = useState<number | null>(null);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewNote, setReviewNote] = useState('');

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await request('/api/events/operator/events');
      setEvents(res?.data || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل الفعاليات');
    } finally {
      setEventsLoading(false);
    }
  }, [request]);

  const loadRules = useCallback(async (ev: any) => {
    setSelectedEvent(ev);
    setRules(null);
    setRuleForm(null);
    setEventRules([]);
    setReviewQueue([]);
    setExcuseDeadlineMinutes(null);
    try {
      const res = await request(`/api/events/${ev.id}/attendance/rules`);
      const r = res?.data || { eventRule: null, sessionRules: [] };
      setRules(r);
      setEventRules(Array.isArray(r.eventRules) ? r.eventRules : []);
      setEvaluationMode(r.evaluationMode || 'ALL_APPLICABLE');
      setExcuseDeadlineMinutes(r.excuseDeadlineMinutes ?? null);
      setRuleForm(r.eventRule || {
        grace_period_minutes: 0, penalty_mode: 'NONE', base_penalty: 0, base_points: 0,
        additional_penalty: 0, additional_penalty_unit: 'PER_MINUTE', additional_penalty_block_minutes: 1,
        maximum_penalty: null, maximum_points_deduction: null, absent_after_minutes: null,
        auto_apply_penalty: true, enabled: true, tiers: null, required_attendance: true,
        counts_toward_absence_limit: true, attendance_weight: 1,
      });
      const sRes = await request(`/api/events/${ev.id}/sessions`);
      setSessions(sRes?.data || []);
      const overrides: Record<string, any> = {};
      for (const sr of r.sessionRules || []) {
        overrides[sr.session_id] = sr;
      }
      setSessionOverrides(overrides);
      const revRes = await request(`/api/events/${ev.id}/attendance/review`);
      setReviewQueue(revRes?.data || []);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تحميل قواعد الفعالية');
    }
  }, [request]);

  const saveEventRules = async () => {
    if (!selectedEvent) return;
    setBusy('eventrules');
    try {
      await request(`/api/events/${selectedEvent.id}/attendance/rules`, {
        method: 'PUT',
        body: JSON.stringify({ evaluation_mode: evaluationMode, rules: eventRules, excuseDeadlineMinutes }),
      });
      flash(true, 'تم حفظ قواعد الفعالية الذكية');
      await loadRules(selectedEvent);
    } catch (e: any) {
      flash(false, e.message || 'تعذر حفظ القواعد');
    } finally {
      setBusy(null);
    }
  };

  const classifyReview = async (atdId: string, classification: string) => {
    if (!selectedEvent) return;
    setBusy(`rev-${atdId}`);
    try {
      await request(`/api/events/${selectedEvent.id}/attendance/${atdId}/review`, {
        method: 'POST',
        body: JSON.stringify({ classification, reason: reviewNote.trim() || undefined }),
      });
      flash(true, 'تم تصنيف الغياب');
      setReviewNote('');
      await loadRules(selectedEvent);
    } catch (e: any) {
      flash(false, e.message || 'تعذر تصنيف الغياب');
    } finally {
      setBusy(null);
    }
  };

  const updateEventRule = (idx: number, patch: any) => {
    setEventRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addEventRule = () => {
    setEventRules((prev) => [...prev, ruleRow(prev.length)]);
  };
  const removeEventRule = (idx: number) => {
    setEventRules((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sort_order: i })));
  };

  const saveEventRule = async () => {
    if (!selectedEvent || !ruleForm) return;
    setBusy('rule');
    try {
      await request(`/api/events/${selectedEvent.id}/attendance/rules`, {
        method: 'PUT',
        body: JSON.stringify(ruleForm),
      });
      flash(true, 'تم حفظ قواعد الفعالية');
      await loadRules(selectedEvent);
    } catch (e: any) {
      flash(false, e.message || 'تعذر حفظ قواعد الفعالية');
    } finally {
      setBusy(null);
    }
  };

  const saveSessionRule = async (sid: string) => {
    if (!selectedEvent) return;
    const form = sessionOverrides[sid];
    if (!form) return;
    setBusy(`srule-${sid}`);
    try {
      await request(`/api/events/${selectedEvent.id}/sessions/${sid}/rules`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      flash(true, 'تم حفظ قواعد الجلسة');
      await loadRules(selectedEvent);
    } catch (e: any) {
      flash(false, e.message || 'تعذر حفظ قواعد الجلسة');
    } finally {
      setBusy(null);
    }
  };

  const setSessionField = (sid: string, key: string, value: any) => {
    setSessionOverrides((prev) => ({ ...prev, [sid]: { ...prev[sid], [key]: value } }));
  };

  const selectTenant = (tid: string) => {
    setTenantId(tid);
  };

  useEffect(() => {
    if (tenantId && tab === 'risk') loadRisk(tenantId);
    if (tenantId && tab === 'policy') loadPolicy(tenantId);
    if (tab === 'rules') loadEvents();
  }, [tenantId, tab, loadRisk, loadPolicy, loadEvents]);

  const badge = (k: string) => {
    const m = RISK_META[k] || RISK_META.ok;
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${m.cls}`}>{m.label}</span>;
  };

  const renderTenantPicker = () => (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      <Filter size={15} className="text-slate-400" />
      {tenants.map((t) => (
        <button
          key={t.id}
          onClick={() => selectTenant(t.id)}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${tenantId === t.id ? 'bg-gradient-to-r from-primary-600 to-vibrant-600 text-white shadow-lg shadow-primary-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );

  const renderRisk = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 dark:text-white">تقرير الغياب والإنذارات</h2>
        <button onClick={() => loadRisk(tenantId)} disabled={riskLoading} className="flex items-center gap-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
          {riskLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
          <p className="text-sm font-black text-slate-700 dark:text-white">الطلاب الأكثر غياباً</p>
          <span className="text-[10px] font-bold text-slate-400">{risk.length} طالب</span>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-[28rem] overflow-y-auto custom-scrollbar">
          {riskLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
          ) : risk.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <CheckCircle2 size={28} />
              <p className="text-sm font-bold">لا توجد حالات غياب محصورة في العتبات</p>
            </div>
          ) : risk.map((r) => (
            <div key={r.student_id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-white">{r.name}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {r.unexcusedCount} غياب غير مبرر • حضور {r.attendanceRate}% • وزن {r.weightedUnexcused}
                </p>
              </div>
              {badge(r.riskLevel)}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center gap-2">
            <Gavel size={15} className="text-rose-500" />
            <p className="text-sm font-black text-slate-700 dark:text-white">الحالات التأديبية</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-72 overflow-y-auto">
            {cases.length === 0 ? (
              <p className="p-5 text-center text-xs font-bold text-slate-400">لا توجد حالات</p>
            ) : cases.map((c) => {
              const m = CASE_STATUS[c.status] || CASE_STATUS.OPEN;
              return (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{c.student_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {c.stage} • {c.state} • {c.attended}/${c.total_required} حضور
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${m.cls}`}>{m.label}</span>
                    {['OPEN', 'UNDER_REVIEW'].includes(c.status) && (
                      <>
                        <button onClick={() => decideCase(c, 'APPROVED')} disabled={busy === `case-${c.id}`} className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100" title="قبول"><CheckCircle2 size={14} /></button>
                        <button onClick={() => decideCase(c, 'REJECTED')} disabled={busy === `case-${c.id}`} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100" title="رفض"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center gap-2">
            <FileText size={15} className="text-sky-500" />
            <p className="text-sm font-black text-slate-700 dark:text-white">الأعذار المعلقة</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-72 overflow-y-auto">
            {excuses.length === 0 ? (
              <p className="p-5 text-center text-xs font-bold text-slate-400">لا توجد أعذار معلقة</p>
            ) : excuses.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{e.student_name}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                    {e.event_title || 'فعالية'} • {e.session_title || ''} • {e.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => decideExcuse(e, 'APPROVED')} disabled={busy === `excuse-${e.id}`} className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100" title="قبول العذر"><CheckCircle2 size={14} /></button>
                  <button onClick={() => decideExcuse(e, 'REJECTED')} disabled={busy === `excuse-${e.id}`} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100" title="رفض العذر"><XCircle size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <p className="text-sm font-black text-slate-700 dark:text-white">آخر الإنذارات ({warnings.length})</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-56 overflow-y-auto">
            {warnings.map((w) => (
              <div key={w.id} className="px-5 py-2.5 flex items-center justify-between">
                <p className="text-xs font-black text-slate-700 dark:text-white">{w.student_name}</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {w.warning_trigger_reason || `غياب ${w.absence_count || ''}`} • {w.created_at ? new Date(w.created_at).toLocaleDateString('ar-EG') : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPolicy = () => {
    if (!policy) {
      return (
        <div className="flex items-center justify-center py-16 text-slate-400">
          {policyLoading ? <Loader2 size={24} className="animate-spin" /> : <p className="text-sm font-bold">لا توجد سياسة محمّلة</p>}
        </div>
      );
    }
    const set = (k: string, v: any) => setPolicy((p: any) => ({ ...p, [k]: v }));
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">سياسة الحضور والغياب — إصدار {policy.version}</h2>
          <button onClick={savePolicy} disabled={busy === 'policy'} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
            {busy === 'policy' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ إصدار جديد
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
          <p className="text-sm font-black text-slate-700 dark:text-white mb-3">عتبات الإنذار والتأديب (أيام غياب غير مبرر — تُفرض تصاعدياً)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField label="إنذار أول" value={policy.warning_1_threshold} onChange={(v) => set('warning_1_threshold', v)} />
            <NumberField label="إنذار ثانٍ" value={policy.warning_2_threshold} onChange={(v) => set('warning_2_threshold', v)} />
            <NumberField label="إنذار نهائي" value={policy.final_warning_threshold} onChange={(v) => set('final_warning_threshold', v)} />
            <NumberField label="مراجعة تأديبية" value={policy.disciplinary_review_threshold} onChange={(v) => set('disciplinary_review_threshold', v)} />
            <NumberField label="مراجعة إنهاء السكن" value={policy.residence_termination_review_threshold} onChange={(v) => set('residence_termination_review_threshold', v)} />
            <NumberField label="مهلة تقديم العذر (ساعة)" value={policy.excuse_time_limit_hours} onChange={(v) => set('excuse_time_limit_hours', v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <Toggle label="تفعيل عتبات الغياب" value={policy.enforce_absence_thresholds} onChange={(v) => set('enforce_absence_thresholds', v)} />
            <Toggle label="احتساب الوزني (أهمية الفعالية)" value={policy.weighted_attendance_enabled} onChange={(v) => set('weighted_attendance_enabled', v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Toggle label="إشعار ولي الأمر عند الغياب" value={policy.parent_notify_on_absence} onChange={(v) => set('parent_notify_on_absence', v)} />
            <Toggle label="إشعار ولي الأمر عند التأخير" value={policy.parent_notify_on_late} onChange={(v) => set('parent_notify_on_late', v)} />
            <Toggle label="إشعار ولي الأمر عند الإنذار" value={policy.parent_notify_on_warning} onChange={(v) => set('parent_notify_on_warning', v)} />
          </div>
          <label className="block mt-4">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">ملاحظة الإصدار</span>
            <input value={policy.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="سبب التعديل (اختياري)" className="mt-1 w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/40 outline-none" />
          </label>
        </div>

        {policyHist.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5">
              <p className="text-sm font-black text-slate-700 dark:text-white">سجل الإصدارات</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-56 overflow-y-auto">
              {policyHist.map((h) => (
                <div key={h.id} className="px-5 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-black text-slate-700 dark:text-white">الإصدار {h.version}</p>
                  <p className="text-[10px] font-bold text-slate-400">
                    {h.note || 'تعديل'} • {h.changed_at ? new Date(h.changed_at).toLocaleString('ar-EG') : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEventsPicker = () => (
    <div className="space-y-3">
      <h2 className="text-lg font-black text-slate-800 dark:text-white">اختر فعالية لتكوين قواعد الحضور</h2>
      {eventsLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : events.length === 0 ? (
        <p className="p-8 text-center text-sm font-bold text-slate-400">لا توجد فعاليات</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.map((ev) => (
            <button key={ev.id} onClick={() => loadRules(ev)} className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] hover:border-primary-300 dark:hover:border-primary-500/40 transition-all text-right flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-300"><Calendar size={18} /></div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{ev.title}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{ev.event_date ? new Date(ev.event_date).toLocaleDateString('ar-EG') : 'بدون تاريخ'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderRules = () => {
    if (!selectedEvent) return renderEventsPicker();
    return (
      <div className="space-y-5">
        <button onClick={() => { setSelectedEvent(null); setRules(null); }} className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-300 hover:text-primary-600 transition-colors">
          <ChevronDown size={14} className="rotate-90" /> العودة لاختيار الفعالية
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">قواعد {selectedEvent.title}</h2>
          <button onClick={() => loadRules(selectedEvent)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600"><RefreshCw size={15} /></button>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
          <p className="text-sm font-black text-slate-700 dark:text-white mb-3">قاعدة الفعالية الافتراضية</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField label="مهلة التأخير (دقيقة)" value={ruleForm?.grace_period_minutes} onChange={(v) => setRuleForm((f: any) => ({ ...f, grace_period_minutes: v }))} />
            <NumberField label="عدم الحضور بعد (دقيقة)" value={ruleForm?.absent_after_minutes} onChange={(v) => setRuleForm((f: any) => ({ ...f, absent_after_minutes: v === '' ? null : v }))} />
            <NumberField label="الوزن (أهمية الحضور)" value={ruleForm?.attendance_weight} onChange={(v) => setRuleForm((f: any) => ({ ...f, attendance_weight: v }))} />
            <NumberField label="الغرامة الأساسية (ج)" value={ruleForm?.base_penalty} onChange={(v) => setRuleForm((f: any) => ({ ...f, base_penalty: v }))} />
            <NumberField label="خصم النقاط الأساسي (نقطة)" value={ruleForm?.base_points} onChange={(v) => setRuleForm((f: any) => ({ ...f, base_points: v }))} />
            <NumberField label="غرامة إضافية" value={ruleForm?.additional_penalty} onChange={(v) => setRuleForm((f: any) => ({ ...f, additional_penalty: v }))} />
            <NumberField label="الحد الأقصى للغرامة (ج)" value={ruleForm?.maximum_penalty} onChange={(v) => setRuleForm((f: any) => ({ ...f, maximum_penalty: v === '' ? null : v }))} />
            <NumberField label="الحد الأقصى لخصم النقاط" value={ruleForm?.maximum_points_deduction} onChange={(v) => setRuleForm((f: any) => ({ ...f, maximum_points_deduction: v === '' ? null : v }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <Toggle label="الحضور إلزامي" value={!!ruleForm?.required_attendance} onChange={(v) => setRuleForm((f: any) => ({ ...f, required_attendance: v }))} />
            <Toggle label="يُحتسب في حد الغياب" value={!!ruleForm?.counts_toward_absence_limit} onChange={(v) => setRuleForm((f: any) => ({ ...f, counts_toward_absence_limit: v }))} />
            <Toggle label="تطبيق الغرامة تلقائياً" value={!!ruleForm?.auto_apply_penalty} onChange={(v) => setRuleForm((f: any) => ({ ...f, auto_apply_penalty: v }))} />
            <Toggle label="مفعّلة" value={!!ruleForm?.enabled} onChange={(v) => setRuleForm((f: any) => ({ ...f, enabled: v }))} />
          </div>
          <button onClick={saveEventRule} disabled={busy === 'rule' || !ruleForm} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
            {busy === 'rule' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ قاعدة الفعالية
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
              <ListChecks size={15} className="text-neon-primary" /> قواعد الفعالية الذكية (متعددة الحالات)
            </p>
            <button type="button" onClick={addEventRule} className="flex items-center gap-1 text-xs font-black text-primary-600 hover:text-primary-700 transition-colors">
              <Plus size={14} /> إضافة قاعدة
            </button>
          </div>
          <label className="block mb-3">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">ترتيب تطبيق القواعد</span>
            <select value={evaluationMode} onChange={(e) => setEvaluationMode(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-primary-500/40 outline-none">
              <option value="ALL_APPLICABLE">كل القواعد المطبّقة تُنفَّذ (تراكمي)</option>
              <option value="FIRST_APPLICABLE">أول قاعدة تنطبق فقط (الأولوية بالترتيب)</option>
            </select>
          </label>
          <div className="mb-4 p-3.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar size={15} className="text-violet-600 dark:text-violet-400 shrink-0" />
              <p className="text-xs font-black text-violet-700 dark:text-violet-300 leading-tight">موعد تقديم الأعذار (قبل بدء الفعالية)</p>
            </div>
            <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 leading-relaxed mb-2">
              الطالب (أو ولي أمره) يقدّم عذراً قبل هذا الموعد، ويصلك إشعار بالقبول أو الرفض.
            </p>
            <div className="flex items-center gap-2">
              <UnitInput value={excuseDeadlineMinutes}
                onChange={(v: string) => setExcuseDeadlineMinutes(v === '' ? null : Math.max(0, parseInt(v) || 0))}
                unit="دقيقة" placeholder="عدد الدقائق قبل الفعالية" />
              {excuseDeadlineMinutes === null ? (
                <button type="button" onClick={() => setExcuseDeadlineMinutes(120)}
                  className="shrink-0 text-[10px] font-black text-violet-600 dark:text-violet-300 hover:underline">تفعيل</button>
              ) : (
                <button type="button" onClick={() => setExcuseDeadlineMinutes(null)}
                  className="shrink-0 text-[10px] font-black text-rose-500 hover:underline">إلغاء تفعيل</button>
              )}
            </div>
          </div>
          {eventRules.length === 0 ? (
            <p className="text-[10px] leading-relaxed text-slate-400">لا توجد قواعد ذكية بعد. تُنفَّذ القواعد عند تسجيل الحضور (شرط التأخر) وعند تصنيف الغياب (غياب / غياب غير مبرر).</p>
          ) : (
            <div className="space-y-2">
              {eventRules.map((r, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select value={r.condition_status || 'unexcused'} onChange={(e) => updateEventRule(idx, { condition_status: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                      {RULE_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select value={r.action_type || 'NONE'} onChange={(e) => updateEventRule(idx, { action_type: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                      {RULE_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  {r.condition_status === 'late' && (
                    <div className="grid grid-cols-2 gap-2">
                      <UnitInput value={r.condition_min_late_minutes ?? null}
                        onChange={(v: string) => updateEventRule(idx, { condition_min_late_minutes: v === '' ? null : Math.max(0, parseInt(v)) })}
                        unit="دقيقة" placeholder="من تأخر" />
                      <UnitInput value={r.condition_max_late_minutes ?? null}
                        onChange={(v: string) => updateEventRule(idx, { condition_max_late_minutes: v === '' ? null : Math.max(0, parseInt(v)) })}
                        unit="دقيقة" placeholder="حتى" />
                    </div>
                  )}
                  {r.action_type === 'DEDUCT_POINTS' && (
                    <UnitInput value={r.points_amount ?? 0}
                      onChange={(v: string) => updateEventRule(idx, { points_amount: Math.max(0, parseInt(v) || 0) })}
                      unit="نقطة" placeholder="عدد النقاط المخصومة" />
                  )}
                  {r.action_type === 'FINANCIAL_FEE' && (
                    <UnitInput value={r.fee_amount ?? 0}
                      onChange={(v: string) => updateEventRule(idx, { fee_amount: Math.max(0, parseFloat(v) || 0) })}
                      unit="جنيه" placeholder="مبلغ الغرامة" step="0.5" />
                  )}
                  {r.action_type === 'SEND_NOTIFICATION' && (
                    <input type="text" placeholder="نص الإشعار..." value={r.notification_message ?? ''}
                      onChange={(e) => updateEventRule(idx, { notification_message: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none" />
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={r.enabled !== false} onChange={(e) => updateEventRule(idx, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-neon-primary rounded" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">مفعّلة</span>
                    </label>
                    <button type="button" onClick={() => removeEventRule(idx)} className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors">
                      <Trash2 size={13} /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={saveEventRules} disabled={busy === 'eventrules'} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
            {busy === 'eventrules' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ قواعد الفعالية الذكية
          </button>
        </div>

        <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
            <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
              <Gavel size={15} className="text-rose-500" /> مراجعة الغياب المعلقة
            </p>
            {reviewQueue.length > 0 && <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-black">{reviewQueue.length} حالة</span>}
          </div>
          {reviewQueue.length === 0 ? (
            <p className="p-6 text-center text-xs font-bold text-slate-400">لا توجد غيابات معلقة للمراجعة</p>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5">
                <input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="ملاحظة تُسجَّل مع التصنيف..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/40 outline-none"
                />
              </div>
              <div className="divide-y divide-slate-50 dark:divide-white/5 max-h-80 overflow-y-auto custom-scrollbar">
                {reviewQueue.map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">{r.student_name || r.student_id}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                        {r.session_title || 'جلسة'} • {r.absence_reason || 'بدون سبب'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => classifyReview(r.id, 'UNEXCUSED')} disabled={busy === `rev-${r.id}`} className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700 disabled:opacity-50 transition-colors">غير مبرر</button>
                      <button onClick={() => classifyReview(r.id, 'EXCUSED')} disabled={busy === `rev-${r.id}`} className="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[10px] font-black hover:bg-sky-700 disabled:opacity-50 transition-colors">معذور</button>
                      <button onClick={() => classifyReview(r.id, 'TRAVEL')} disabled={busy === `rev-${r.id}`} className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-black hover:bg-violet-700 disabled:opacity-50 transition-colors">سفر</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50 dark:border-white/5 flex items-center gap-2">
            <Settings2 size={15} className="text-slate-400" />
            <p className="text-sm font-black text-slate-700 dark:text-white">استثناءات الجلسات</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {sessions.length === 0 ? (
              <p className="p-5 text-center text-xs font-bold text-slate-400">لا توجد جلسات</p>
            ) : sessions.map((s) => {
              const ov = sessionOverrides[s.id];
              const clamped = Number(ov?.grace_period_minutes ?? ruleForm?.grace_period_minutes ?? 0);
              return (
                <div key={s.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{s.title || 'جلسة'}</p>
                    {ov && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">استثناء مخصص</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <NumberField label="مهلة التأخير (دقيقة)" value={ov?.grace_period_minutes} onChange={(v) => setSessionField(s.id, 'grace_period_minutes', v)} />
                    <NumberField label="الغرامة الأساسية (ج)" value={ov?.base_penalty} onChange={(v) => setSessionField(s.id, 'base_penalty', v)} />
                    <NumberField label="خصم النقاط" value={ov?.base_points} onChange={(v) => setSessionField(s.id, 'base_points', v)} />
                    <NumberField label="الوزن" value={ov?.attendance_weight} onChange={(v) => setSessionField(s.id, 'attendance_weight', v)} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] font-bold text-slate-400">الغرامة الافتراضية الموروثة: {clamped} دقيقة مهلة</span>
                    <button onClick={() => saveSessionRule(s.id)} disabled={!ov || busy === `srule-${s.id}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-800 text-[10px] font-black hover:bg-slate-900 disabled:opacity-40 transition-colors">
                      {busy === `srule-${s.id}` ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} حفظ استثناء الجلسة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'risk', label: 'المخاطر والحالات', icon: AlertTriangle },
    { key: 'policy', label: 'السياسة والعتبات', icon: ShieldCheck },
    { key: 'rules', label: 'قواعد الفعاليات', icon: Settings2 },
  ];

  return (
    <div className="p-5 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">إدارة حضور الفعاليات</h1>
          <p className="text-[11px] text-slate-400 font-bold">السياسة • قواعد الفعاليات • المخاطر والحالات التأديبية</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black ${toast.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
          {toast.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="flex items-center gap-1 mb-5 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-colors ${tab === t.key ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab !== 'rules' && tenantId === '' && (
        <div className="p-8 text-center text-sm font-bold text-slate-400">لا تتوفر سكنات</div>
      )}
      {tab !== 'rules' && tenantId && renderTenantPicker()}

      {tab === 'risk' && tenantId && renderRisk()}
      {tab === 'policy' && tenantId && renderPolicy()}
      {tab === 'rules' && renderRules()}

      {tab === 'rules' && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <Users size={13} />
          تُفرض الغرامات تلقائياً عند إغلاق الجلسة وتُنشأ الإنذارات والحالات حسب سياسة السكن. مثال: في التطبيق الفعلي اختر السكن أولاً لتظهر القواعد المتعلقة به.
        </div>
      )}
    </div>
  );
}