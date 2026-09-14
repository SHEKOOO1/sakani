import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface SessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: {
    title: string;
    description: string;
    start_time: string;
    type: 'lecture' | 'workshop' | 'session' | 'session_prayer' | 'game' | 'other';
  };
  onFormDataChange: (data: any) => void;
}

export function SessionCreateModal({ isOpen, onClose, onSubmit, formData, onFormDataChange }: SessionCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge overflow-hidden rounded-ultra"
      >
        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">إضافة قسم فرعي جديد</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
           aria-label="إغلاق"><X /></button>
        </div>
        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">عنوان القسم</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
              className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-bold focus:border-neon-secondary/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="مثال: القداس الإلهي، ورشة البرمجة..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تاريخ ووقت البدء</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => onFormDataChange({ ...formData, start_time: e.target.value })}
                className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">نوع النشاط</label>
              <select
                value={formData.type}
                onChange={(e) => onFormDataChange({ ...formData, type: e.target.value as any })}
                className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-bold"
              >
                <option value="lecture">محاضرة</option>
                <option value="workshop">ورشة عمل</option>
                <option value="session_prayer">صلاة / قداس</option>
                <option value="game">مسابقة / لعبة</option>
                <option value="other">أخرى</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-neon-secondary text-black font-black rounded-2xl shadow-glow-blue transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            حفظ القسم الجديد
          </button>
        </form>
      </motion.div>
    </div>
  );
}
