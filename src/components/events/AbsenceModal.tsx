import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface AbsenceFormData {
  status: string;
  reason: string;
  notifyParent: boolean;
  notifyPriest: boolean;
}

interface AbsenceModalProps {
  isOpen: boolean;
  student: any | null;
  formData: AbsenceFormData;
  onFormDataChange: (data: AbsenceFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function AbsenceModal({ isOpen, student, formData, onFormDataChange, onSubmit, onClose }: AbsenceModalProps) {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-lg bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 shadow-huge rounded-ultra p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة غياب: {student.name}</h3>
          <p className="text-slate-500 text-sm font-bold">يرجى تحديد تفاصيل الغياب لاتخاذ الإجراء المناسب</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">حالة الحضور</label>
            <select
              value={formData.status}
              onChange={(e) => onFormDataChange({ ...formData, status: e.target.value })}
              className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-bold"
            >
              <option value="absent">غائب</option>
              <option value="excused">معتذر (بعذر)</option>
              <option value="traveling">مسافر</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">السبب / الملاحظات</label>
            <textarea
              value={formData.reason}
              onChange={(e) => onFormDataChange({ ...formData, reason: e.target.value })}
              className="w-full px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl outline-none text-slate-900 dark:text-white font-black min-h-[100px] resize-none"
              placeholder="اكتب السبب هنا..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10 transition-all">
              <input
                type="checkbox"
                checked={formData.notifyParent}
                onChange={(e) => onFormDataChange({ ...formData, notifyParent: e.target.checked })}
                className="w-5 h-5 accent-neon-primary"
              />
              <span className="text-xs font-black text-slate-900 dark:text-white">إبلاغ ولي الأمر</span>
            </label>
            <label className="flex items-center gap-3 p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10 transition-all">
              <input
                type="checkbox"
                checked={formData.notifyPriest}
                onChange={(e) => onFormDataChange({ ...formData, notifyPriest: e.target.checked })}
                className="w-5 h-5 accent-neon-secondary"
              />
              <span className="text-xs font-black text-slate-900 dark:text-white">إبلاغ الأب الكاهن</span>
            </label>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onSubmit}
            className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-glow-pink"
          >
            تحديث الحالة
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 font-black rounded-2xl border border-slate-100 dark:border-white/10"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}
