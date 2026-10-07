import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface WarningsTabProps {
  warnings: any[];
}

function levelColor(level: string) {
  switch (level) {
    case 'critical': return 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300';
    case 'high': return 'bg-warm-50 dark:bg-warm-500/20 text-warm-700 dark:text-warm-300';
    case 'medium': return 'bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300';
    default: return 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300';
  }
}

export function WarningsTab({ warnings }: WarningsTabProps) {
  return (
    <motion.div key="warnings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
        <div className="border-b border-slate-50 p-6 dark:border-white/5">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
            <AlertTriangle className="text-warm-600 dark:text-warm-400" size={20} />
            جميع الإنذارات النشطة
          </h3>
          <p className="text-xs text-rose-500 dark:text-rose-400 font-bold mt-1">إجمالي {warnings.length} إنذار نشط — إدارة ومتابعة سلوك الطلاب</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الطالب</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">المستوى</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">السبب</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">التاريخ</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">إشعار الأب</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">إشعار ولي الأمر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/10">
              {warnings.map((w: any) => (
                <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-50 font-black text-warm-600 dark:bg-warm-500/20 dark:text-warm-400 text-xs">{w.student_name?.charAt(0)}</div>
                      <div className="font-black text-slate-700 dark:text-slate-200 text-sm">{w.student_name}</div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full font-black text-[10px] ${levelColor(w.level)}`}>{w.level}</span>
                  </td>
                  <td className="p-5 text-xs font-bold text-slate-500 dark:text-slate-300 max-w-xs">{w.reason}</td>
                  <td className="p-5 text-xs text-slate-400 dark:text-slate-300 font-bold">{new Date(w.created_at).toLocaleDateString('ar-EG')}</td>
                  <td className="p-5 text-center">
                    {w.notify_priest ? <CheckCircle size={15} className="text-ocean-500 dark:text-ocean-400 inline" /> : <X size={15} className="text-slate-300 dark:text-slate-600 inline" />}
                  </td>
                  <td className="p-5 text-center">
                    {w.notify_parent ? <CheckCircle size={15} className="text-ocean-500 dark:text-ocean-400 inline" /> : <X size={15} className="text-slate-300 dark:text-slate-600 inline" />}
                  </td>
                </tr>
              ))}
              {warnings.length === 0 && (
                <tr><td colSpan={6} className="p-16 text-center text-slate-300 dark:text-slate-400 font-bold">لا يوجد إنذارات نشطة حالياً <CheckCircle size={18} className="text-ocean-300 dark:text-ocean-400 inline mr-2" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
