import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Tv, Hash, Bell, MessageCircle } from 'lucide-react';

interface StopConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  masterLoading: boolean;
}

export function StopConfirmModal({ isOpen, onClose, onConfirm, masterLoading }: StopConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => { if (!masterLoading) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-0 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 shrink-0">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">إنهاء البث المباشر</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  سيتم إنهاء البث المرئي وإزالة إشارة "مباشر" من الموقع وتنبيه المشاهدين. يمكنك بعد ذلك أرشفة التسجيل.
                </p>
              </div>
            </div>

            {/* Warning details */}
            <div className="px-6 mt-4 space-y-2">
              {[
                { icon: Tv, text: 'إزالة بطاقة البث المباشر من صفحة الراديو', color: 'text-red-500' },
                { icon: Hash, text: 'إلغاء تثبيت الإعلان العاجل من التيكر', color: 'text-amber-500' },
                { icon: Bell, text: 'إيقاف الإشعارات الفورية', color: 'text-purple-500' },
                { icon: MessageCircle, text: 'تحويل الدردشة إلى وضع القراءة فقط', color: 'text-blue-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] rounded-lg">
                  <item.icon size={16} className={`${item.color} shrink-0`} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold hover:from-red-700 hover:to-rose-700 transition-all shadow-lg shadow-red-500/25"
              >
                تأكيد إنهاء البث
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
