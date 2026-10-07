import { motion } from 'motion/react';
import { ShieldAlert, Bell, CheckCircle } from 'lucide-react';

interface ReportsTabProps {
  reports: any[];
  onApproveReport: (id: string) => void;
}

export function ReportsTab({ reports, onApproveReport }: ReportsTabProps) {
  return (
    <motion.div key="reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="space-y-4">
        {reports.length > 0 ? reports.map((r: any) => (
          <div key={r.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  r.type === 'penalty' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                  r.type === 'warning' ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                }`}>
                  {r.type === 'penalty' ? <ShieldAlert size={24}/> : <Bell size={24}/>}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 dark:text-white">{r.title}</h4>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{r.studentNames?.join(', ')}</p>
                    <span className="text-slate-200 dark:text-slate-600">•</span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold">{new Date(r.createdAt).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApproveReport(r.id)}
                  className="bg-primary-600 dark:bg-primary-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-all"
                >
                  اعتماد وتفعيل
                </button>
                <button className="bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-5 py-2 rounded-xl text-xs font-black hover:bg-slate-50 dark:hover:bg-white/10 transition-all">
                  رفض وبحث
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-white/5">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{r.description}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[10px] font-black text-primary-600 dark:text-primary-400 flex items-center gap-2">
                <CheckCircle size={13} />
                مرسل بواسطة المشرف: {r.supervisorName}
              </p>
              <button className="text-[10px] font-black text-rose-500 dark:text-rose-400 hover:underline">طلب توضيح إضافي</button>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-white/10 dark:bg-card-dark">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-white/5">
              <Bell size={32} className="text-slate-200 dark:text-slate-600" />
            </div>
            <h4 className="text-lg font-black text-slate-400 dark:text-slate-300">لا يوجد بلاغات معلقة</h4>
            <p className="text-xs font-bold text-slate-300 dark:text-slate-400 mt-2">سيتم ظهور البلاغات والتقارير المرسلة من قبل المشرفين هنا.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
