import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface RenameMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineName: string;
  onMachineNameChange: (name: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function RenameMachineModal({ isOpen, onClose, machineName, onMachineNameChange, onSave, saving }: RenameMachineModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md relative"
          >
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">تغيير اسم الغسالة</h3>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X />
              
                </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest pr-2">الاسم الجديد</label>
                <input
                  type="text"
                  value={machineName}
                  onChange={(e) => onMachineNameChange(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white"
                />
              </div>
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الاسم الجديد'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
