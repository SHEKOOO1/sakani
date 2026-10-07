import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Plus, X, Building, Target, Image, Video, Volume2, File,
  Eye
} from 'lucide-react';

interface Targeting {
  tenants?: string[];
  roles?: string[];
  bishops?: string[];
  priests?: string[];
  supervisors?: string[];
  employees?: string[];
  students?: string[];
  colleges?: string[];
  majors?: string[];
  governorates?: string[];
  churches?: string[];
  guardian_types?: string[];
  sibling_genders?: string[];
  parent_gender?: 'father' | 'mother' | null;
  graduates_only?: boolean;
  graduate_parents_only?: boolean;
  selected_student_parents?: boolean;
  exclude_tenants?: boolean;
  exclude_colleges?: boolean;
  exclude_governorates?: boolean;
  exclude_churches?: boolean;
  exclude_bishops?: boolean;
  exclude_priests?: boolean;
  exclude_supervisors?: boolean;
  exclude_employees?: boolean;
  exclude_students?: boolean;
  exclude_parents?: boolean;
}

interface BroadcastFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing: any;
  title: string;
  onTitleChange: (v: string) => void;
  content: string;
  onContentChange: (v: string) => void;
  priority: string;
  onPriorityChange: (v: any) => void;
  displayType: string;
  onDisplayTypeChange: (v: any) => void;
  startAt: string;
  onStartAtChange: (v: string) => void;
  endAt: string;
  onEndAtChange: (v: string) => void;
  targeting: Targeting;
  attachments: any[];
  onAttachmentsChange: (v: any[]) => void;
  recipientCount: number | null;
  saving: boolean;
  onSave: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tenants: any[];
  colleges: string[];
  governorates: string[];
  churches: string[];
  bishops: any[];
  supervisors: any[];
  employees: any[];
  guardianRelations: string[];
  filteredEmployees: any[];
  filteredSupervisors: any[];
  filteredPriests: any[];
  hasTenantFilter: boolean;
  toggleTarget: (key: keyof Targeting, value: string) => void;
  toggleExclude: (field: string, excludeField: string) => void;
  searchStudents: (q: string) => Promise<any[]>;
}

function SearchableMultiSelect({ label, items, selected, onChange, searchPlaceholder, excluded, onToggleExclude, onAsyncSearch }: { label: string; items: any[]; selected: string[]; onChange: (v: string) => void; searchPlaceholder?: string; excluded?: boolean; onToggleExclude?: () => void; onAsyncSearch?: (q: string) => Promise<any[]> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<any[] | null>(null);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (onAsyncSearch) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (search.length < 2) { setAsyncResults([]); setAsyncLoading(false); return; }
      setAsyncLoading(true);
      timerRef.current = setTimeout(async () => {
        try {
          const res = await onAsyncSearch(search);
          setAsyncResults(res || []);
        } catch { setAsyncResults([]); }
        setAsyncLoading(false);
      }, 300);
    }
  }, [search, onAsyncSearch]);

  const filtered = onAsyncSearch ? (asyncResults || []) : items.filter(item => {
    const display = typeof item === 'string' ? item : item.name || item.id || '';
    return display.toLowerCase().includes(search.toLowerCase());
  });

  const getName = (val: string) => {
    const found = items.find(i => { const v = typeof i === 'string' ? i : i.id || i.name; return v === val; });
    if (found) return typeof found === 'string' ? found : found.name || found.id;
    if (asyncResults) {
      const afound = asyncResults.find(i => { const v = typeof i === 'string' ? i : i.id || i.name; return v === val; });
      if (afound) return typeof afound === 'string' ? afound : afound.name || afound.id;
    }
    return val;
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">{label}</label>
        {onToggleExclude && (
          <button onClick={(e) => { e.stopPropagation(); onToggleExclude(); }}
            className={`p-0.5 rounded transition-colors ${
              excluded
                ? 'text-red-400 hover:text-red-300 bg-red-50 dark:bg-red-500/10'
                : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
            }`}
            title={excluded ? 'استثناء هذه الفئة' : 'الاستهداف العادي'}>
            <Eye size={13} />
          </button>
        )}
      </div>
      <div className="relative">
        <input
          value={open ? search : ''}
          onFocus={() => setOpen(true)}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          placeholder={selected.length > 0 ? `${selected.length} مختار` : (searchPlaceholder || `اختر ${label}...`)}
          className={`w-full px-3 py-2 rounded-xl border text-sm dark:text-white focus:outline-none focus:border-neon-primary/50 cursor-pointer ${
            excluded
              ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-500'
              : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900'
          }`}
        />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {selected.filter(Boolean).map(val => {
            return (
              <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neon-primary/15 text-neon-primary text-[10px] font-bold border border-neon-primary/30">
                {getName(val)}
                <button onClick={() => onChange(val)} className="hover:text-red-400">&times;</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-1">
          {asyncLoading ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">جاري البحث...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">لا توجد نتائج</div>
          ) : (
            filtered.map((item, idx) => {
              const val = typeof item === 'string' ? (item || `str-${idx}`) : item.id || item.name || `opt-${idx}`;
              const display = typeof item === 'string' ? item : item.name || item.id || val;
              const isSel = selected.includes(val);
              return (
                <button
                  key={val}
                  onClick={() => onChange(val)}
                  className={`w-full text-right px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${
                    isSel
                      ? 'bg-neon-primary/10 text-neon-primary'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSel ? 'bg-neon-primary border-neon-primary' : 'border-slate-300 dark:border-slate-500'
                  }`}>
                    {isSel && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  {display}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function BroadcastFormModal({
  isOpen, onClose, editing,
  title, onTitleChange,
  content, onContentChange,
  priority, onPriorityChange,
  displayType, onDisplayTypeChange,
  startAt, onStartAtChange,
  endAt, onEndAtChange,
  targeting,
  attachments, onAttachmentsChange,
  recipientCount,
  saving, onSave,
  onFileUpload,
  tenants, colleges, governorates, churches, bishops, supervisors, employees, guardianRelations,
  filteredEmployees, filteredSupervisors, filteredPriests,
  hasTenantFilter,
  toggleTarget, toggleExclude,
  searchStudents,
}: BroadcastFormModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {editing ? 'تعديل الإعلان' : 'إعلان جديد'}
            </h3>
            
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
            
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">العنوان</label>
              <input value={title} onChange={e => onTitleChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50"
                placeholder="عنوان الإعلان" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">المحتوى</label>
              <textarea value={content} onChange={e => onContentChange(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50 resize-none"
                placeholder="نص الإعلان..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">الأولوية</label>
              <select value={priority} onChange={e => onPriorityChange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50">
                <option value="normal">عادي</option>
                <option value="important">مهم</option>
                <option value="urgent">عاجل</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">نوع العرض</label>
              <select value={displayType} onChange={e => onDisplayTypeChange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50">
                <option value="both">شريط أخبار + رسائل</option>
                <option value="news">شريط أخبار فقط</option>
                <option value="messages">رسائل فقط</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">بداية (اختياري)</label>
              <input type="datetime-local" value={startAt} onChange={e => onStartAtChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">نهاية (اختياري)</label>
              <input type="datetime-local" value={endAt} onChange={e => onEndAtChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-neon-primary/50" />
            </div>
          </div>

          {/* Targeting */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-neon-primary" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">الاستهداف</h4>
              {recipientCount !== null && (
                <span className="text-xs text-slate-400">~{recipientCount} مستلم</span>
              )}
            </div>

            {/* Primary filter: Tenants (المساكن) */}
            <div className="mb-4 p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Building size={16} className="text-neon-primary" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">الفلتر الرئيسي — اختر المساكن أولاً</span>
                {hasTenantFilter && (
                  <span className="text-[10px] text-neon-primary font-bold bg-neon-primary/10 px-2 py-0.5 rounded-full">
                    {targeting.tenants!.length} مسكن مختار
                  </span>
                )}
              </div>
              <SearchableMultiSelect label="المساكن" items={tenants} selected={targeting.tenants || []}
                onChange={v => toggleTarget('tenants', v)} searchPlaceholder="ابحث عن سكن..."
                excluded={!!targeting.exclude_tenants}
                onToggleExclude={() => toggleExclude('tenants', 'exclude_tenants')} />
              {hasTenantFilter && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  ✓ بقية الحقول أدناه تظهر فقط البيانات التابعة للمساكن المختارة
                </p>
              )}
            </div>

            {/* Secondary filters */}
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-600 dark:text-blue-400">نظام الفلتره الذكي:</span><br />
              • كل فئة مستقلة — اختيار طالب لا يعني إرسال لولي أمره (يجب اختيار "صلة القرابة" أو "إرسال لأهالي الطلاب المختارين" أيضاً)<br />
              • زر العين <span className="text-red-400">❌</span> يستثني الفئة بالكامل دون المساس بالفئات الأخرى<br />
              • الخريجون: زر "للطلاب الخريجين فقط" أو "لأهالي الخريجين فقط" أو الاثنان معاً (2026)<br />
              • مثال: اختر طالب [أ] + ولي أمره، ثم اضغط عين على الطلاب ← الطالب محجوب لكن ولي أمره يستقبل<br />
              • مثال: اختر "أب" من صلة القرابة ثم اضغط عين على أولياء الأمور ← كل الأولياء محجوبين
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tenants already shown above as primary filter */}

              <SearchableMultiSelect label="الطلاب" items={[]} selected={targeting.students || []}
                onChange={v => toggleTarget('students', v)} searchPlaceholder={hasTenantFilter ? "...ابحث عن طالب في المساكن المختارة" : "ابحث عن طالب..."}
                excluded={!!targeting.exclude_students}
                onToggleExclude={() => toggleExclude('students', 'exclude_students')}
                onAsyncSearch={searchStudents} />

              {/* Graduate targeting */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">الخريجون</label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => toggleTarget('graduates_only', 'graduates_only')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      targeting.graduates_only
                        ? 'bg-vibrant/20 text-vibrant border-vibrant/40'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                    }`}>
                    🎓 للطلاب الخريجين فقط
                  </button>
                  <button onClick={() => toggleTarget('graduate_parents_only', 'graduate_parents_only')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      targeting.graduate_parents_only
                        ? 'bg-vibrant/20 text-vibrant border-vibrant/40'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                    }`}>
                    لأهالي الخريجين فقط
                  </button>
                </div>
                {targeting.students && targeting.students.length > 0 && (
                  <button onClick={() => toggleTarget('selected_student_parents', 'selected_student_parents')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors w-full ${
                      targeting.selected_student_parents
                        ? 'bg-vibrant/20 text-vibrant border-vibrant/40'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                    }`}>
                    إرسال أيضاً لأهالي الطلاب المختارين
                  </button>
                )}
              </div>

              <SearchableMultiSelect label="الموظفين" items={filteredEmployees} selected={targeting.employees || []}
                onChange={v => toggleTarget('employees', v)} searchPlaceholder={hasTenantFilter ? "...ابحث عن موظف في المساكن المختارة" : "ابحث عن موظف..."}
                excluded={!!targeting.exclude_employees}
                onToggleExclude={() => toggleExclude('employees', 'exclude_employees')} />

              <SearchableMultiSelect label="المشرفين" items={filteredSupervisors} selected={targeting.supervisors || []}
                onChange={v => toggleTarget('supervisors', v)} searchPlaceholder={hasTenantFilter ? "...ابحث عن مشرف في المساكن المختارة" : "ابحث عن مشرف..."}
                excluded={!!targeting.exclude_supervisors}
                onToggleExclude={() => toggleExclude('supervisors', 'exclude_supervisors')} />

              <SearchableMultiSelect label="الآباء الكهنة" items={filteredPriests} selected={targeting.priests || []}
                onChange={v => toggleTarget('priests', v)} searchPlaceholder={hasTenantFilter ? "...ابحث عن كاهن في المساكن المختارة" : "ابحث عن كاهن..."}
                excluded={!!targeting.exclude_priests}
                onToggleExclude={() => toggleExclude('priests', 'exclude_priests')} />

              <SearchableMultiSelect label="الكليات" items={colleges} selected={targeting.colleges || []}
                onChange={v => toggleTarget('colleges', v)} searchPlaceholder="ابحث عن كلية..."
                excluded={!!targeting.exclude_colleges}
                onToggleExclude={() => toggleExclude('colleges', 'exclude_colleges')} />
              <SearchableMultiSelect label="المحافظات" items={governorates} selected={targeting.governorates || []}
                onChange={v => toggleTarget('governorates', v)} searchPlaceholder="ابحث عن محافظة..."
                excluded={!!targeting.exclude_governorates}
                onToggleExclude={() => toggleExclude('governorates', 'exclude_governorates')} />
              <SearchableMultiSelect label="الكنائس" items={churches} selected={targeting.churches || []}
                onChange={v => toggleTarget('churches', v)} searchPlaceholder="ابحث عن كنيسة..."
                excluded={!!targeting.exclude_churches}
                onToggleExclude={() => toggleExclude('churches', 'exclude_churches')} />
              <SearchableMultiSelect label="الأساقفة" items={bishops} selected={targeting.bishops || []}
                onChange={v => toggleTarget('bishops', v)} searchPlaceholder="ابحث عن أسقف..."
                excluded={!!targeting.exclude_bishops}
                onToggleExclude={() => toggleExclude('bishops', 'exclude_bishops')} />

              {/* Guardian types - dynamic relation types from DB */}
              <SearchableMultiSelect label="صلة القرابة" items={guardianRelations} selected={targeting.guardian_types || []}
                onChange={v => toggleTarget('guardian_types', v)} searchPlaceholder="ابحث عن صلة قرابة..."
                excluded={!!targeting.exclude_parents}
                onToggleExclude={() => toggleExclude('guardian_types', 'exclude_parents')} />

              {/* Sibling genders */}
              {['brother', 'sister'].some(t => (targeting.guardian_types || []).includes(t)) && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">جنس الأخ/الأخت</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'male', label: 'ذكر' },
                      { value: 'female', label: 'أنثى' },
                    ].map(g => {
                      const isSel = (targeting.sibling_genders || []).includes(g.value);
                      return (
                        <button key={g.value} onClick={() => toggleTarget('sibling_genders', g.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            isSel
                              ? 'bg-neon-primary/20 text-neon-primary border-neon-primary/40'
                              : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                          }`}>
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Selected targets summary */}
            {(targeting.tenants?.length || targeting.colleges?.length || targeting.governorates?.length || targeting.churches?.length || targeting.students?.length || targeting.guardian_types?.length || targeting.priests?.length || targeting.supervisors?.length || targeting.employees?.length || targeting.exclude_tenants || targeting.exclude_colleges || targeting.exclude_governorates || targeting.exclude_churches || targeting.exclude_students || targeting.exclude_parents || targeting.exclude_priests || targeting.exclude_supervisors || targeting.exclude_employees) && (
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-400">
                {targeting.tenants?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">مساكن: {targeting.tenants.length}</span> : null}
                {targeting.colleges?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كليات: {targeting.colleges.length}</span> : null}
                {targeting.governorates?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">محافظات: {targeting.governorates.length}</span> : null}
                {targeting.churches?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كنائس: {targeting.churches.length}</span> : null}
                {targeting.students?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">طلاب: {targeting.students.length}</span> : null}
                {targeting.graduates_only ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">🎓 طلاب خريجين</span> : null}
                {targeting.graduate_parents_only ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">🎓 أهالي الخريجين</span> : null}
                {targeting.selected_student_parents ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">أهالي الطلاب المختارين</span> : null}
                {targeting.priests?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">كهنة: {targeting.priests.length}</span> : null}
                {targeting.supervisors?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">مشرفين: {targeting.supervisors.length}</span> : null}
                {targeting.employees?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">موظفين: {targeting.employees.length}</span> : null}
                {targeting.guardian_types?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">أولياء: {targeting.guardian_types.join(', ')}</span> : null}
                {targeting.sibling_genders?.length ? <span className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">جنس الأخوة: {targeting.sibling_genders.map((g: string) => g === 'male' ? 'ذكر' : 'أنثى').join(', ')}</span> : null}
                {targeting.exclude_students ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ طلاب</span> : null}
                {targeting.exclude_parents ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ أولياء أمور</span> : null}
                {targeting.exclude_employees ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ موظفين</span> : null}
                {targeting.exclude_supervisors ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ مشرفين</span> : null}
                {targeting.exclude_priests ? <span className="bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 border border-red-200 dark:border-red-500/20">❌ كهنة</span> : null}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">المرفقات</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs text-slate-600 dark:text-slate-300">
                  {att.type === 'image' ? <Image size={14} /> : att.type === 'video' ? <Video size={14} /> : att.type === 'voice' ? <Volume2 size={14} /> : <File size={14} />}
                  <span className="truncate max-w-[100px]">{att.original_name}</span>
                  <button onClick={() => onAttachmentsChange(attachments.filter(a => a.id !== att.id))} className="text-red-400 hover:text-red-300">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:border-neon-primary/30 transition-colors">
              <Plus size={16} />
              إضافة ملف
              <input type="file" onChange={onFileUpload} className="hidden" />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              إلغاء
            </button>
            <button onClick={onSave} disabled={saving || !title.trim() || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-neon-primary text-black font-bold rounded-xl hover:bg-neon-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إرسال'}
              {!saving && <Send size={16} />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
