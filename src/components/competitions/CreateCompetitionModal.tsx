import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Award } from 'lucide-react';

interface CriteriaItem {
  _key?: string;
  title: string;
  maxPoints: number;
}

interface FormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizePoints: number;
  questionsCount: number;
  responsibleId: string;
  criteria: CriteriaItem[];
}

interface CreateCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData;
  onChange: (data: FormData) => void;
  onSubmit: () => void;
  saving: boolean;
  employees: any[];
  students: any[];
}

export function CreateCompetitionModal({
  isOpen,
  onClose,
  formData,
  onChange,
  onSubmit,
  saving,
  employees,
  students
}: CreateCompetitionModalProps) {
  const addCriterion = () => {
    onChange({
      ...formData,
      criteria: [...formData.criteria, { _key: crypto.randomUUID(), title: '', maxPoints: 10 }]
    });
  };

  const removeCriterion = (index: number) => {
    onChange({
      ...formData,
      criteria: formData.criteria.filter((_, i) => i !== index)
    });
  };

  const updateCriterion = (index: number, field: 'title' | 'maxPoints', value: string | number) => {
    const newCriteria = [...formData.criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    onChange({ ...formData, criteria: newCriteria });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-card-dark p-12 rounded-[3rem] w-full max-w-2xl relative shadow-2xl">
            <div className="flex justify-between items-center mb-4 sm:mb-10">
              <h3 className="text-3xl font-black text-slate-800 dark:text-white">إنشاء مسابقة جديدة</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="col-span-full space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">عنوان المسابقة</label>
                <input required value={formData.title} onChange={e => onChange({ ...formData, title: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black text-xl dark:text-white" placeholder="مثال: مسابقة الحفظ السنوية" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">التفاصيل / القواعد</label>
                <textarea rows={3} value={formData.description} onChange={e => onChange({ ...formData, description: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white placeholder:font-medium" placeholder="قواعد المشاركة وشروط الفوز..." />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">تاريخ البدء</label>
                <input type="date" value={formData.startDate} onChange={e => onChange({ ...formData, startDate: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">تاريخ الانتهاء</label>
                <input type="date" value={formData.endDate} onChange={e => onChange({ ...formData, endDate: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black dark:text-white" />
              </div>
              <div className="space-y-2 font-black">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">عدد الأسئلة (للمسابقات الثقافية)</label>
                <input type="number" value={formData.questionsCount} onChange={e => { const v = parseInt(e.target.value); onChange({ ...formData, questionsCount: isNaN(v) ? 0 : v }) }} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-black dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">نقاط الجائزة</label>
                <input type="number" value={formData.prizePoints} onChange={e => { const v = parseInt(e.target.value); onChange({ ...formData, prizePoints: isNaN(v) ? 0 : v }) }} className="w-full px-6 py-4 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30 rounded-2xl outline-none font-black text-2xl text-center" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">المسؤول الرئيسي عن المسابقة</label>
                <select value={formData.responsibleId} onChange={e => onChange({ ...formData, responsibleId: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none font-bold dark:text-white">
                  <option value="">اختر مسؤولاً...</option>
                  {[...employees, ...students.map((s: any) => ({ id: s.user_id, name: `${s.name} (طالب)` }))].map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-full bg-slate-50 dark:bg-white/5 p-8 rounded-xl border border-slate-100 dark:border-white/10 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Award size={20} className="text-blue-600 dark:text-blue-400" />
                    معايير التقييم والدرجات
                  </h4>
                  <button
                    type="button"
                    onClick={addCriterion}
                    className="px-4 py-2 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                    إضافة معيار
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.criteria.map((c, idx) => (
                    <div key={c._key || `criterion-${idx}`} className="flex gap-4 items-end bg-white dark:bg-card-dark p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">عنوان المعيار</label>
                        <input
                          required
                          value={c.title}
                          onChange={e => updateCriterion(idx, 'title', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none font-bold text-sm dark:text-white"
                          placeholder="مثال: دقة الأداء"
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 mr-2 uppercase">الدرجة القصوى</label>
                        <input
                          required
                          type="number"
                          value={c.maxPoints}
                          onChange={e => { const v = parseInt(e.target.value); updateCriterion(idx, 'maxPoints', isNaN(v) ? 1 : v) }}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none font-black text-center dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCriterion(idx)}
                        className="p-3 bg-rose-50 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {formData.criteria.length === 0 && (
                    <p className="text-center py-6 text-slate-400 dark:text-slate-300 text-xs font-bold italic">لا توجد معايير مضافة حالياً. سيتم تقييم المسابقة بشكل عام.</p>
                  )}
                </div>
              </div>
              <button type="submit" disabled={saving} className="col-span-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-slate-800 transition-all mt-4 disabled:opacity-50">
                {saving ? 'جاري الحفظ...' : 'حفظ المسابقة كمسودة'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
