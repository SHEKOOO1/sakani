import { motion, AnimatePresence } from 'motion/react';
import { Check, Archive, MessageSquareOff, TrendingUp, Clock, ThumbsUp, Loader2 } from 'lucide-react';

interface PostWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  wizardSaving: boolean;
  archiveVideo: boolean;
  onArchiveToggle: () => void;
  chatReadOnly: boolean;
  onChatReadOnlyToggle: () => void;
  peakViewers: number;
  timer: number;
  totalLikes: number;
  formatDuration: (seconds: number) => string;
}

export function PostWizardModal({
  isOpen,
  onClose,
  onSubmit,
  wizardSaving,
  archiveVideo,
  onArchiveToggle,
  chatReadOnly,
  onChatReadOnlyToggle,
  peakViewers,
  timer,
  totalLikes,
  formatDuration,
}: PostWizardModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <Check size={22} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">تم إنهاء البث المباشر</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">خيارات ما بعد البث</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-3">
                    <Archive size={18} className="text-primary-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">أرشفة البث تلقائياً</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">حفظ التسجيل في مكتبة الفيديو</p>
                    </div>
                  </div>
                  <div
                    onClick={onArchiveToggle}
                    className={`relative w-11 h-6 rounded-full transition-colors ${archiveVideo ? 'bg-primary-500' : 'bg-slate-300 dark:bg-white/20'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${archiveVideo ? 'translate-x-5' : ''}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-3">
                    <MessageSquareOff size={18} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">جعل الدردشة للقراءة فقط</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">منع إرسال رسائل جديدة للمشاهدين</p>
                    </div>
                  </div>
                  <div
                    onClick={onChatReadOnlyToggle}
                    className={`relative w-11 h-6 rounded-full transition-colors ${chatReadOnly ? 'bg-primary-500' : 'bg-slate-300 dark:bg-white/20'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${chatReadOnly ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
              </div>

              {/* Stats Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500/5 to-purple-500/5 border border-primary-500/10">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">إحصائيات البث</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'ذروة المشاهدين', value: peakViewers, icon: TrendingUp, color: 'text-emerald-500' },
                    { label: 'مدة البث', value: formatDuration(timer), icon: Clock, color: 'text-amber-500' },
                    { label: 'الإعجابات', value: totalLikes, icon: ThumbsUp, color: 'text-blue-500' },
                  ].map((stat, i) => (
                    <div key={i} className="text-center p-3 rounded-lg bg-white/50 dark:bg-white/[0.03]">
                      <stat.icon size={16} className={`mx-auto mb-1 ${stat.color}`} />
                      <p className="text-lg font-black text-slate-800 dark:text-white">{stat.value}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={onSubmit}
                disabled={wizardSaving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-purple-600 text-white text-sm font-bold hover:from-primary-600 hover:to-purple-700 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {wizardSaving && <Loader2 size={16} className="animate-spin" />}
                {wizardSaving ? 'جاري الحفظ...' : 'إنهاء وحفظ'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
