import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { List, X, Save, Loader2 } from 'lucide-react';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { name: string; description: string; cover_image: string };
  onChange: (data: any) => void;
  editingId: string | null;
  onSave: () => void;
  saving: boolean;
  uploadingImage: boolean;
  coverFileRef: React.RefObject<HTMLInputElement | null>;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen, onClose, formData, onChange, editingId, onSave, saving,
  uploadingImage, coverFileRef
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg relative overflow-hidden border border-slate-100 dark:border-white/10">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg"><List size={20} className="text-primary-600 dark:text-primary-400" /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingId ? 'تعديل التصنيف' : 'تصنيف جديد'}</h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">اسم التصنيف *</label>
                <input type="text" value={formData.name} onChange={e => onChange({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="مثال: برامج عائلية" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">الوصف</label>
                <textarea value={formData.description} onChange={e => onChange({ ...formData, description: e.target.value })} rows={2}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all resize-none" />
              </div>
            </div>
            <div className="p-6 md:p-8 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">إلغاء</button>
              <button onClick={onSave} disabled={saving}
                className="px-6 py-3 bg-gradient-to-br from-primary-600 to-vibrant-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
