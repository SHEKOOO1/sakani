import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Upload, Save, Loader2 } from 'lucide-react';
import { Category } from './types';

interface PlaylistFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { name: string; description: string; cover_image: string };
  onChange: (data: any) => void;
  editingId: string | null;
  selectedCategoryId: string | null;
  onSave: () => void;
  saving: boolean;
  uploadingImage: boolean;
  coverFileRef: React.RefObject<HTMLInputElement | null>;
  categories: Category[];
  onUploadImage: (file: File, onUrl: (url: string) => void) => void;
}

export const PlaylistFormModal: React.FC<PlaylistFormModalProps> = ({
  isOpen, onClose, formData, onChange, editingId, selectedCategoryId,
  onSave, saving, uploadingImage, coverFileRef, categories, onUploadImage
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
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"><BookOpen size={20} className="text-amber-600 dark:text-amber-400" /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingId ? 'تعديل البرنامج' : 'برنامج جديد'}</h3>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              {selectedCategoryId && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/15 rounded-lg text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  التصنيف: {categories.find(c => c.id === selectedCategoryId)?.name}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">اسم البرنامج *</label>
                <input type="text" value={formData.name} onChange={e => onChange({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="مثال: برنامج ساعة لقلبك" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">الوصف</label>
                <textarea value={formData.description} onChange={e => onChange({ ...formData, description: e.target.value })} rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 px-2">صورة البرنامج</label>
                {formData.cover_image && (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                    <img src={formData.cover_image} alt="cover" className="w-full h-full object-cover" />
                    <button onClick={() => onChange({ ...formData, cover_image: '' })}
                      className="absolute top-2 left-2 p-1 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="url" value={formData.cover_image} onChange={e => onChange({ ...formData, cover_image: e.target.value })}
                    className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" placeholder="رابط الصورة (اختياري)" />
                  <label className={`shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all cursor-pointer ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span className="text-[10px] font-bold">رفع</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) onUploadImage(file, (url) => onChange({ ...formData, cover_image: url }));
                    }} disabled={uploadingImage} />
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">إلغاء</button>
              <button onClick={onSave} disabled={saving}
                className="px-6 py-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
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
