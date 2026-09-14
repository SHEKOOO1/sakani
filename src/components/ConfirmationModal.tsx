import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد الحذف',
  cancelText = 'إلغاء',
  type = 'danger'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl ${type === 'danger' ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'}`}>
                <AlertTriangle size={24} />
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              {message}
            </p>
          </div>

          <div className="p-6 bg-slate-50 flex gap-3">
            <button
              onClick={onConfirm}
              className={`flex-1 neon-btn neon-btn-sm shadow-glow ${
                type === 'danger' 
                  ? 'neon-btn-danger' 
                  : 'neon-btn-primary'
              }`}
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="flex-1 neon-btn neon-btn-info neon-btn-sm"
            >
              {cancelText}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
