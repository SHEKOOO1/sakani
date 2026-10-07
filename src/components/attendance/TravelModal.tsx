import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  MessageSquare,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface TravelModalProps {
  open: boolean;
  onClose: () => void;
  destination: string;
  reason: string;
  onDestinationChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
}

export function TravelModal({
  open,
  onClose,
  destination,
  reason,
  onDestinationChange,
  onReasonChange,
  loading,
  onSubmit,
}: TravelModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-l from-primary-50 to-vibrant-50 dark:from-primary-900/20 dark:to-vibrant-900/20">
              <div>
                <h3 className="font-black text-slate-800 text-2xl">تسجيل حالة سفر</h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">إخطار رسمي للمشرفين والأهل</p>
              </div>
              
                <button onClick={onClose} aria-label="إغلاق" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X  size={24} className="text-slate-400" />
              
                </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">الوجهة (إلى أين ستذهب؟)</label>
                <div className="relative">
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="text"
                    value={destination}
                    onChange={e => onDestinationChange(e.target.value)}
                    className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold placeholder:text-slate-300 border border-transparent focus:border-emerald-500/20"
                    placeholder="مثال: القاهرة - منزل الأسرة"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">سبب السفر</label>
                <div className="relative">
                  <MessageSquare className="absolute right-4 top-4 text-slate-300" size={18} />
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={e => onReasonChange(e.target.value)}
                    className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none font-bold placeholder:text-slate-300 border border-transparent focus:border-emerald-500/20"
                    placeholder="اكتب سبب السفر بالتفصيل هنا..."
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0" />
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                  سيتم إرسال رسالة فورية إلى المشرف المقيم وإلى ولي أمرك المسجل في النظام تبلغهم بسفرك في هذا التوقيت.
                </p>
              </div>

              <button
                onClick={onSubmit}
                disabled={loading}
                className="w-full py-5 bg-gradient-to-l from-primary-600 to-vibrant-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-primary-500/20 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />} إتمام تسجيل السفر
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
