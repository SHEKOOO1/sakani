import { motion } from 'motion/react';
import { ShieldAlert, Home } from 'lucide-react';

export function NotAuthorizedPage({ onBack }: { onBack?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[80vh] p-8"
    >
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-3">غير مصرح بالوصول</h1>
        <p className="text-sm font-bold text-slate-400 dark:text-slate-300 mb-8">عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
        >
          <Home size={20} />
          العودة للرئيسية
        </button>
      </div>
    </motion.div>
  );
}
