import { motion } from 'motion/react';
import { UserMinus } from 'lucide-react';

interface ExpulsionTabProps {
  expulsionCandidates: any[];
  onApproveExpulsion: (id: string) => void;
  onRejectExpulsion: (id: string) => void;
}

export function ExpulsionTab({ expulsionCandidates, onApproveExpulsion, onRejectExpulsion }: ExpulsionTabProps) {
  return (
    <motion.div key="expulsion" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
        <div className="border-b border-slate-50 p-6 dark:border-white/5">
          <h3 className="text-lg font-black text-slate-800 dark:text-white">قائمة مقترحات الفصل</h3>
          <p className="text-xs text-rose-500 dark:text-rose-400 font-bold mt-1">طلاب مقترح فصلهم بناءً على تجاوزات سلوكية أو إدارية مكررة.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الطالب</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">تاريخ الاقتراح</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">عدد الإنذارات</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">سبب الفصل المقترح</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/10">
              {expulsionCandidates.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 font-black text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 text-xs">{(c?.name || '?').charAt(0)}</div>
                      <div className="font-black text-slate-700 dark:text-slate-200 text-sm">{c.name}</div>
                    </div>
                  </td>
                  <td className="p-5 text-xs text-slate-400 dark:text-slate-300 font-bold">{new Date(c.suggestedAt).toLocaleDateString('ar-EG')}</td>
                  <td className="p-5 text-center">
                    <span className="px-3 py-1 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full font-black text-xs">{c.warningCount}</span>
                  </td>
                  <td className="p-5 text-xs font-bold text-slate-500 dark:text-slate-300 max-w-md">{c.reason}</td>
                  <td className="p-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onApproveExpulsion(c.id)} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black hover:bg-rose-700 transition-all">اعتماد الفصل</button>
                      <button onClick={() => onRejectExpulsion(c.id)} className="px-4 py-2 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-slate-50 dark:hover:bg-white/10 transition-all">رفض وحفظ</button>
                    </div>
                  </td>
                </tr>
              ))}
              {expulsionCandidates.length === 0 && (
                <tr><td colSpan={5} className="p-16 text-center text-slate-300 dark:text-slate-400 font-bold">لا يوجد طلاب مقترح فصلهم حالياً</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
