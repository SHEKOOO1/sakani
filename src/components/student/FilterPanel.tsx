interface FilterCriteria {
  room_number: string;
  status: string;
  enrollment_year: string;
  major: string;
  governorate: string;
  college: string;
  university: string;
  graduation_year: string;
  gender: string;
}

interface FilterPanelProps {
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
}

export function FilterPanel({ criteria, onChange }: FilterPanelProps) {
  const set = (field: keyof FilterCriteria, value: string) => onChange({ ...criteria, [field]: value });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 p-5 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 rounded-2xl mb-6">
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">المحافظة</label>
        <input value={criteria.governorate} onChange={e => set('governorate', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">الجامعة</label>
        <input value={criteria.university} onChange={e => set('university', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">الكليه</label>
        <input value={criteria.college} onChange={e => set('college', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">التخصص</label>
        <input value={criteria.major} onChange={e => set('major', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">سنة التخرج</label>
        <input value={criteria.graduation_year} onChange={e => set('graduation_year', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">النوع</label>
        <select value={criteria.gender} onChange={e => set('gender', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white">
          <option value="">الكل</option>
          <option value="male">ذكر</option>
          <option value="female">أنثى</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">الحالة</label>
        <select value={criteria.status} onChange={e => set('status', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white">
          <option value="">الكل</option>
          <option value="active">نشط</option>
          <option value="archived">مؤرشف</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">سنة التسجيل</label>
        <input value={criteria.enrollment_year} onChange={e => set('enrollment_year', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400">رقم الغرفه</label>
        <input value={criteria.room_number} onChange={e => set('room_number', e.target.value)} placeholder="الكل" className="w-full p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none dark:text-white" />
      </div>
    </div>
  );
}