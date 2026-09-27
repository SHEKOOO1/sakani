import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ListChecks, ShieldAlert, Plus, Trash2, Loader2, Save, Info, CalendarClock } from 'lucide-react';
import { ExcuseDeadlineInput } from './ExcuseDeadlineInput';

type TierType = 'FEE' | 'POINTS' | 'ABSENT';
interface TierRow {
  type: TierType;
  minMinutes: number | null;
  maxMinutes: number | null;
  amount: number;
}

const emptyRow = (): TierRow => ({ type: 'FEE', minMinutes: 5, maxMinutes: null, amount: 5 });

// سطر شرح صغير يظهر أسفل الحقل أو الزر ليبيّن وظيفته بالضبط
function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed mt-1">{children}</p>
  );
}

// حقل رقمي تُعرض بجانبه وحدة القياس دائمًا (دقيقة / نقطة / جنيه)
function UnitInput({ value, onChange, unit, placeholder, min = 0, step = 1, disabled }: any) {
  return (
    <div className="relative">
      <input type="number" dir="ltr" min={min} step={step} placeholder={placeholder}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-16 pr-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none text-right placeholder:text-right placeholder:font-bold disabled:opacity-40"
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
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [gracePeriod, setGracePeriod] = useState<number | null>(0);
  const [excuseDeadlineMinutes, setExcuseDeadlineMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance/rules`);
      if (res.success) {
        const eventRule = res.data?.eventRule;
        const rows: TierRow[] = [];
        if (eventRule?.tiers && Array.isArray(eventRule.tiers)) {
          for (const t of eventRule.tiers) {
            if (t.penalty > 0) rows.push({ type: 'FEE', minMinutes: t.minMinutes, maxMinutes: t.maxMinutes, amount: t.penalty });
            if (t.points > 0) rows.push({ type: 'POINTS', minMinutes: t.minMinutes, maxMinutes: t.maxMinutes, amount: t.points });
          }
        }
        if (eventRule?.absent_after_minutes != null) {
          rows.push({ type: 'ABSENT', minMinutes: eventRule.absent_after_minutes, maxMinutes: null, amount: 0 });
        }
        setTiers(rows.length > 0 ? rows : []);
        setGracePeriod(eventRule?.grace_period_minutes ?? 0);
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

  const addRow = () => setTiers((prev) => [...prev, emptyRow()]);
  const updateRow = (idx: number, patch: Partial<TierRow>) => {
    setTiers((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveRules = async () => {
    for (const [i, r] of tiers.entries()) {
      if (r.minMinutes == null || String(r.minMinutes).trim() === '') {
        showSnackbar(`حدد «من (دقيقة)» في الشريحة ${i + 1}`, 'error');
        return;
      }
      if (r.maxMinutes != null && r.maxMinutes < r.minMinutes) {
        showSnackbar(`«حتى» في الشريحة ${i + 1} أقل من «من»`, 'error');
        return;
      }
      if ((r.type === 'FEE' || r.type === 'POINTS') && (r.amount == null || r.amount <= 0)) {
        showSnackbar(`حدد قيمة الجزاء في الشريحة ${i + 1}`, 'error');
        return;
      }
    }

    // غياب يقطع كل الغرامات: أي شريحة تمتد بعده تُقتطع قبل حد الغياب
    const absentAfter = Math.min(...tiers.filter((r) => r.type === 'ABSENT').map((r) => r.minMinutes ?? Infinity));
    const cut = absentAfter !== Infinity ? absentAfter - 1 : Infinity;

    const tierPayload = tiers
      .filter((r) => r.type === 'FEE' || r.type === 'POINTS')
      .map((r) => ({
        minMinutes: Math.max(0, Math.floor(Number(r.minMinutes) || 0)),
        maxMinutes: r.maxMinutes != null ? Math.min(Math.max(0, Math.floor(Number(r.maxMinutes) || 0)), cut) : null,
        penalty: r.type === 'FEE' ? Number(r.amount) || 0 : 0,
        points: r.type === 'POINTS' ? Math.floor(Number(r.amount) || 0) : 0,
      }))
      .sort((a, b) => a.minMinutes - b.minMinutes);

    const hasFees = tierPayload.some((t) => t.penalty > 0);
    const hasPoints = tierPayload.some((t) => t.points > 0);

    setSaving(true);
    try {
      const res = await request(`/api/events/${selectedEvent.id}/attendance/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule: {
            grace_period_minutes: Math.max(0, Math.floor(Number(gracePeriod) || 0)),
            penalty_mode: hasFees && hasPoints ? 'BOTH' : hasFees ? 'FINANCIAL' : hasPoints ? 'POINTS' : 'NONE',
            base_penalty: 0,
            base_points: 0,
            additional_penalty: 0,
            additional_penalty_unit: 'PER_MINUTE',
            additional_penalty_block_minutes: 1,
            maximum_penalty: null,
            maximum_points_deduction: null,
            absent_after_minutes: absentAfter !== Infinity ? absentAfter : null,
            auto_apply_penalty: true,
            enabled: true,
            tiers: tierPayload,
            required_attendance: true,
            counts_toward_absence_limit: true,
            attendance_weight: 1,
          },
          rules: [],
          excuseDeadlineMinutes,
        }),
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

  const typeLabel = (t: TierType) =>
    t === 'FEE' ? 'غرامة مالية' : t === 'POINTS' ? 'خصم نقاط' : 'يُحتسب غياباً';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="rules" className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">قواعد الحضور والغياب</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 max-w-2xl leading-relaxed">
          ضبط قواعد التأخير والغياب للفعالية «{selectedEvent.title}» — تُطبَّق آليًا وقت تسجيل الحضور.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-neon-primary/10 border border-neon-primary/20">
        <Info size={18} className="text-neon-primary shrink-0 mt-0.5" />
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
          عند تسجيل الحضور يُحسب التأخر بالدقائق، وتُطبق الشريحة التي تنتمي إليها: من 5 حتى 10 دقائق ← الغرامة الأولى، من 10 حتى 30 ← الثانية، وهكذا.
          والوقت الواقع بين شريحتين يظل على الشريحة الأقل حتى الوصول للشريحة الأعلى. وعند الوصول لشريحة «يُحتسب غياباً» يُعد الطالب غائبًا ولا تُفرض عليه أي غرامة.
          كل قرار يُسجَّل لقطة ثابتة — تعديل القواعد بعد ذلك يطبَّق على الحضور الجديد فقط ولا يغيّر القرارات السابقة.
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-slate-700 dark:text-white flex items-center gap-2">
            <ListChecks size={15} className="text-neon-primary" /> شرائح التأخير والجزاءات
          </p>
          <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-black text-primary-600 hover:text-primary-700 transition-colors">
            <Plus size={14} /> إضافة قاعدة
          </button>
        </div>
        <FieldHint>
          كل قاعدة = نوع الجزاء فقط + النطاق الزمني للتأخير الذي تُطبَّق فيه. أضف عدة قواعد لتغطية التأخير المتصاعد، وآخرها غالبًا «يُحتسب غياباً».
        </FieldHint>

        <label className="block mb-4">
          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">مهلة سماح قبل احتساب التأخير (دقيقة)</span>
          <UnitInput value={gracePeriod} onChange={(v: string) => setGracePeriod(v === '' ? null : Math.max(0, parseInt(v) || 0))} unit="دقيقة" placeholder="مثلاً 5 = لا غرامة قبل مرور 5 دقائق" />
          <FieldHint>
            التأخير الأقل من هذه المهلة يُعد حضورًا في الموعد: لا غرامة ولا يُسجل متأخرًا. اتركها 0 لتفعيل القواعد من أول دقيقة.
          </FieldHint>
        </label>

        <div className="mb-5 p-3.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarClock size={15} className="text-violet-600 dark:text-violet-400 shrink-0" />
            <p className="text-xs font-black text-violet-700 dark:text-violet-300 leading-tight">
              موعد تقديم الأعذار (قبل بدء الفعالية)
            </p>
          </div>
          <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 leading-relaxed mb-2">
            الطالب (أو ولي أمره) يستطيع تقديم عذر خلال هذه المدة قبل «{selectedEvent.start_time ? new Date(selectedEvent.start_time).toLocaleString('ar-EG') : selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString('ar-EG') : 'الفعالية'}» ويصلك إشعار بالقبول أو الرفض.
          </p>
          <ExcuseDeadlineInput valueMinutes={excuseDeadlineMinutes} onChange={setExcuseDeadlineMinutes} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-primary-600" />
          </div>
        ) : tiers.length === 0 ? (
          <p className="text-[10px] leading-relaxed text-slate-400">لا توجد قواعد لهذه الفعالية بعد. اضغط «إضافة قاعدة» وحدد النوع والنطاق، وسيُطبَّق السلوك الافتراضي (لا جزاء) حتى تُضيف.</p>
        ) : (
          <div className="space-y-3">
            {tiers.map((r, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <select value={r.type} onChange={(e) => updateRow(idx, { type: e.target.value as TierType })}
                    className="shrink-0 px-2.5 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none">
                    <option value="FEE">غرامة مالية</option>
                    <option value="POINTS">خصم نقاط</option>
                    <option value="ABSENT">يُحتسب غياباً</option>
                  </select>
                  <button type="button" onClick={() => removeRow(idx)} className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors">
                    <Trash2 size={13} /> حذف
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <UnitInput value={r.minMinutes}
                    onChange={(v: string) => updateRow(idx, { minMinutes: v === '' ? null : Math.max(0, parseInt(v) || 0) })}
                    unit="دقيقة" placeholder="من (تأخر)" />
                  <UnitInput value={r.maxMinutes}
                    onChange={(v: string) => updateRow(idx, { maxMinutes: v === '' ? null : Math.max(0, parseInt(v) || 0) })}
                    unit="دقيقة" placeholder="حتى (فارغ = بلا حد)" disabled={r.type === 'ABSENT'} />
                  {r.type !== 'ABSENT' && (
                    <UnitInput value={r.amount}
                      onChange={(v: string) => updateRow(idx, { amount: Math.max(0, parseFloat(v) || 0) })}
                      unit={r.type === 'FEE' ? 'جنيه' : 'نقطة'}
                      placeholder={r.type === 'FEE' ? 'مبلغ الغرامة' : 'عدد النقاط'} step="0.5" />
                  )}
                </div>
                <FieldHint>
                  {r.type === 'FEE' && 'تؤخذ غرامة مالية بهذا المبلغ عندما يتأخر الطالب في هذا النطاق الزمني.'}
                  {r.type === 'POINTS' && 'تُخصم هذه النقاط السلوكية عندما يتأخر الطالب في هذا النطاق الزمني.'}
                  {r.type === 'ABSENT' && 'عند بلوغ هذا التقدير من التأخر يُعد الطالب غائبًا، وكل غرامة تمتد بعده تُقتطع تلقائيًا.'}
                </FieldHint>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveRules} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-vibrant-600 text-white text-xs font-black hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ القواعد
          </button>
          {saving && <span className="text-[10px] font-bold text-slate-400">جارٍ الحفظ...</span>}
        </div>
        <FieldHint>
          الحفظ يُثبّت الشرائح ومهلة السماح وموعد الأعذار. يُطبَّق على الحضور الجديد فقط، ولا يغيّر القرارات المسجلة سابقًا.
        </FieldHint>
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