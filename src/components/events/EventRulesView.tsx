import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ListChecks, ShieldAlert, Plus, Trash2, Loader2, Save, Info, CalendarClock } from 'lucide-react';

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

interface EventRulesViewProps {
  selectedEvent: any;
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (message: string, type?: any) => void;
}

export function EventRulesView({ selectedEvent, request, showSnackbar }: EventRulesViewProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [evaluationMode, setEvaluationMode] = useState('ALL_APPLICABLE');
  const [excuseDeadlineMinutes, setExcuseDeadlineMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance/rules`);
      if (res.success) {
        setRules(res.data?.eventRules || []);
        setEvaluationMode(res.data?.evaluationMode || 'ALL_APPLICABLE');
        setExcuseDeadlineMinutes(res.data?.excuseDeadlineMinutes ?? null);
      }
    } catch (e) {
      console.error('Load event rules failed:', e);
      showSnackbar('فشل تحميل قواعد الفعالية', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent.id, request, showSnackbar]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const addRule = () => setRules((prev) => [...prev, ruleRow(prev.length)]);
  const updateRule = (idx: number, patch: any) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sort_order: i })));
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      const payload = rules.map((r, i) => ({ ...r, sort_order: i, id: r.id || undefined }));
      const res = await request(`/api/events/${selectedEvent.id}/attendance/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: payload, evaluation_mode: evaluationMode, excuseDeadlineMinutes: excuseDeadlineMinutes }),
      });
      if (res.success) {
        showSnackbar('تم حفظ قواعد الفعالية', 'success');
        loadRules();
      } else {
        showSnackbar(res.message || 'تعذر حفظ قواعد الفعالية', 'error');
      }
    } catch (e) {
      console.error('Save event rules failed:', e);
      showSnackbar('تعذر حفظ قواعد الفعالية', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="rules" className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">قواعد الحضور والغياب</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 max-w-2xl leading-relaxed">
          ضبط القوانين الخاصة بالفعالية «{selectedEvent.title}» — تُنفَّذ أولًا بأول عند تسجيل الحضور وتصنيف الغياب.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-neon-primary/10 border border-neon-primary/20">
        <Info size={18} className="text-neon-primary shrink-0 mt-0.5" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
          شرط التأخر يُقيَّم وقت تسجيل الحضور، وشرطا الغياب/الغياب غير المبرر عند تصنيف الغياب.
          القواعد وأساليبها اللي اتطبق فعلًا بتتسجل لقطة ثابتة لكل حالة — تعديل القواعد بعد كده بيطبّق على الحضور الجديد بس، ومش بيكسّر القرارات السابقة.
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
            <ListChecks size={15} className="text-neon-primary" /> قواعد الفعالية الذكية (متعددة الحالات)
          </p>
          <button type="button" onClick={addRule} className="flex items-center gap-1 text-xs font-black text-primary-600 hover:text-primary-700 transition-colors">
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
            <CalendarClock size={15} className="text-violet-600 dark:text-violet-400 shrink-0" />
            <p className="text-xs font-black text-violet-700 dark:text-violet-300 leading-tight">
              موعد تقديم الأعذار (قبل بدء الفعالية)
            </p>
          </div>
          <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 leading-relaxed mb-2">
            الطالب (أو ولي أمره) يستطيع تقديم عذر خلال هذه المدة قبل «{selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleString('ar-EG') : selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString('ar-EG') : 'الفعالية'}» ويصلك إشعار بالقبول أو الرفض.
          </p>
          <div className="flex items-center gap-2">
            <UnitInput
              value={excuseDeadlineMinutes}
              onChange={(v: string) => setExcuseDeadlineMinutes(v === '' ? null : Math.max(0, parseInt(v) || 0))}
              unit="دقيقة"
              placeholder="عدد الدقائق قبل الفعالية"
            />
            {excuseDeadlineMinutes === null && (
              <button type="button" onClick={() => setExcuseDeadlineMinutes(120)}
                className="shrink-0 text-[10px] font-black text-violet-600 dark:text-violet-300 hover:underline">
                تفعيل
              </button>
            )}
            {excuseDeadlineMinutes !== null && (
              <button type="button" onClick={() => setExcuseDeadlineMinutes(null)}
                className="shrink-0 text-[10px] font-black text-rose-500 hover:underline">
                إلغاء تفعيل
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-primary-600" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-[10px] leading-relaxed text-slate-400">لا توجد قواعد لهذه الفعالية بعد. اضغط «إضافة قاعدة» لتحديد سلوك التأخر والغياب، أو عدّلها من شاشة الإنشاء.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((r, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select value={r.condition_status || 'unexcused'} onChange={(e) => updateRule(idx, { condition_status: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                    {RULE_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <select value={r.action_type || 'NONE'} onChange={(e) => updateRule(idx, { action_type: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                    {RULE_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                {r.condition_status === 'late' && (
                  <div className="grid grid-cols-2 gap-2">
                    <UnitInput value={r.condition_min_late_minutes ?? null}
                      onChange={(v: string) => updateRule(idx, { condition_min_late_minutes: v === '' ? null : Math.max(0, parseInt(v)) })}
                      unit="دقيقة" placeholder="من تأخر" />
                    <UnitInput value={r.condition_max_late_minutes ?? null}
                      onChange={(v: string) => updateRule(idx, { condition_max_late_minutes: v === '' ? null : Math.max(0, parseInt(v)) })}
                      unit="دقيقة" placeholder="حتى" />
                  </div>
                )}
                {r.action_type === 'DEDUCT_POINTS' && (
                  <UnitInput value={r.points_amount ?? 0}
                    onChange={(v: string) => updateRule(idx, { points_amount: Math.max(0, parseInt(v) || 0) })}
                    unit="نقطة" placeholder="عدد النقاط المخصومة" />
                )}
                {r.action_type === 'FINANCIAL_FEE' && (
                  <UnitInput value={r.fee_amount ?? 0}
                    onChange={(v: string) => updateRule(idx, { fee_amount: Math.max(0, parseFloat(v) || 0) })}
                    unit="جنيه" placeholder="مبلغ الغرامة" step="0.5" />
                )}
                {r.action_type === 'SEND_NOTIFICATION' && (
                  <input type="text" placeholder="نص الإشعار..." value={r.notification_message ?? ''}
                    onChange={(e) => updateRule(idx, { notification_message: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none" />
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={r.enabled !== false} onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-neon-primary rounded" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">مفعّلة</span>
                  </label>
                  <button type="button" onClick={() => removeRule(idx)} className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors">
                    <Trash2 size={13} /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveRules} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ قواعد الفعالية
          </button>
          {saving && <span className="text-[10px] font-bold text-slate-400">جارٍ الحفظ...</span>}
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
        <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
          إدارة هذه القواعد متاحة للمشرفين وأهل السكن المسؤولين (مشرف سكن — كاهن — مساعد مشرف — مدير التطبيق) ولكل من له صلاحية إدارة حضور الفعاليات.
        </div>
      </div>
    </motion.div>
  );
}