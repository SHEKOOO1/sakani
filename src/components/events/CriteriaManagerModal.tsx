import { motion } from 'motion/react';
import { X, Target, Plus } from 'lucide-react';

interface CriteriaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: any[];
  formData: { title: string; max_score: number };
  onFormDataChange: (data: any) => void;
  onAddCriterion: () => void;
  onRemoveCriterion?: (index: number) => void;
}

export function CriteriaManagerModal({
  isOpen, onClose, criteria, formData, onFormDataChange, onAddCriterion, onRemoveCriterion
}: CriteriaManagerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge overflow-hidden rounded-ultra"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-neon-secondary/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-neon-secondary/10 text-neon-secondary rounded-2xl"><Target size={24} /></div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة معايير التقييم</h3>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
        </div>
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">اسم المعيار</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
                className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-black outline-none"
                placeholder="مثال: الحضور، التفاعل، الروح الرياضية..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الدرجة</label>
              <input
                type="number"
                value={formData.max_score}
                onChange={(e) => onFormDataChange({ ...formData, max_score: parseInt(e.target.value) })}
                className="w-full px-4 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-black text-center outline-none"
                placeholder="10"
              />
            </div>
          </div>

          <button
            onClick={onAddCriterion}
            className="w-full py-4 border-2 border-dashed border-neon-secondary/30 text-neon-secondary font-black rounded-2xl hover:bg-neon-secondary hover:text-black transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> إضافة معيار جديد
          </button>

          <div className="pt-6 border-t border-slate-100 dark:border-white/5">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">المعايير الحالية</p>
            <div className="space-y-2">
              {criteria.map((c: any, i: number) => (
                <div key={c.id || `criterion-${i}`} className="p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{c.title}</span>
                    <span className="px-2 py-0.5 bg-neon-secondary/10 text-neon-secondary text-[8px] font-black rounded-lg">{c.max_score} نقطة</span>
                  </div>
                  <button onClick={() => onRemoveCriterion?.(i)} aria-label="حذف" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
