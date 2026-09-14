import { motion, AnimatePresence } from 'motion/react';
import { Archive } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  notes: string;
  onReasonChange: (reason: string) => void;
  onNotesChange: (notes: string) => void;
  onArchive: () => void;
}

export function ArchiveModal({
  isOpen, onClose, reason, notes,
  onReasonChange, onNotesChange, onArchive
}: ArchiveModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-[3rem] shadow-2xl w-full max-w-md relative text-right"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Archive className="text-amber-500" size={24} />
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">أرشفة سجل الطالب</h3>
              </div>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">سبب المغادرة</label>
                <select value={reason} onChange={e => onReasonChange(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold text-lg dark:text-white">
                  <option value="graduated">تخرج من الجامعة</option>
                  <option value="finished">انتهاء فترة السكن</option>
                  <option value="withdrawn">انسحاب بناءً على طلب الطالب</option>
                  <option value="dismissed">فصل إداري نهائي</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 px-2">ملاحظات إدارية</label>
                <textarea rows={3} value={notes} onChange={e => onNotesChange(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-white/5 rounded-2xl outline-none font-bold text-sm dark:text-white" placeholder="اكتب أي ملاحظات تتعلق بسبب المغادرة..." />
              </div>
              <button onClick={onArchive} className="neon-btn neon-btn-danger w-full py-5 text-sm shadow-glow-sm">
                تأكيد الأرشفة وإخلاء المسكن
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
