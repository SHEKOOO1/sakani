import { useState, useEffect } from 'react';

function UnitInput({ value, onChange, unit, placeholder, min = 0 }: any) {
  return (
    <div className="relative">
      <input type="number" dir="ltr" min={min} step={1} placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full pl-16 pr-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none text-right placeholder:text-right placeholder:font-bold"
        inputMode="numeric" />
      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-[10px] font-black text-slate-400 pointer-events-none">
        {unit}
      </span>
    </div>
  );
}

// موعد تقديم الأعذار: ثلاثة حقول مستقلة (أيام / ساعات / دقائق).
// الموعد النهائي = مجموع الحقول المعبأة فقط، والترك الكل فارغًا = إلغاء الموعد.
export function ExcuseDeadlineInput({ valueMinutes, onChange }: { valueMinutes: number | null; onChange: (m: number | null) => void }) {
  const [days, setDays] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (valueMinutes == null) { setDays(null); setHours(null); setMinutes(null); return; }
    setDays(Math.floor(valueMinutes / 1440));
    setHours(Math.floor((valueMinutes % 1440) / 60));
    setMinutes(valueMinutes % 60);
  }, [valueMinutes]);

  const commit = (next: { days: number | null; hours: number | null; minutes: number | null }) => {
    setDays(next.days); setHours(next.hours); setMinutes(next.minutes);
    const total = (next.days ?? 0) * 1440 + (next.hours ?? 0) * 60 + (next.minutes ?? 0);
    onChange(total > 0 ? total : null);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <UnitInput value={days} onChange={(v: number | null) => commit({ days: v, hours, minutes })} unit="أيام" placeholder="أيام" />
        <UnitInput value={hours} onChange={(v: number | null) => commit({ days, hours: v, minutes })} unit="ساعات" placeholder="ساعات" />
        <UnitInput value={minutes} onChange={(v: number | null) => commit({ days, hours, minutes: v })} unit="دقائق" placeholder="دقائق" />
      </div>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed mt-1.5">
        الموعد النهائي = مجموع الحقول المعبأة فقط (الأيام + الساعات + الدقائق)، وأي حقل يبقى فارغًا لا يُحسب.
        اترك كل الحقول فارغة لإلغاء الموعد نهائيًا.
      </p>
    </div>
  );
}