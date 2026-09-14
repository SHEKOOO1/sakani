import { motion } from 'motion/react';
import { TrendingUp, FileText } from 'lucide-react';

interface RecentActivityProps {
  activities: any[];
  onNavigate?: (view: string) => void;
}

export default function RecentActivity({ activities, onNavigate }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.04] dark:bg-card-dark">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-50 dark:bg-ocean-500/10"><TrendingUp size={16} className="text-ocean-600 dark:text-ocean-400" /></div>
          <h2 className="font-black text-sm text-slate-800 dark:text-white">آخر النشاطات</h2>
        </div>
      </div>
      <div className="space-y-2">
        {activities?.length > 0 ? activities.map((act: any) => (
          <motion.div key={act.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-xl border-r-[3px] p-3 ${act.points > 0 ? 'bg-ocean-50/50 dark:bg-ocean-500/10 border-ocean-500 dark:border-ocean-400' : 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-500 dark:border-rose-400'}`}
          >
            <div className="flex justify-between items-start">
              <p className={`text-xs font-black ${act.points > 0 ? 'text-ocean-700 dark:text-ocean-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {act.points > 0 ? `+${act.points} نقطة` : `${act.points} نقطة`}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-300 font-medium">{new Date(act.created_at).toLocaleDateString('ar-EG')}</span>
            </div>
            {act.reason && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{act.reason}</p>}
          </motion.div>
        )) : (
          <div className="py-6 text-center">
            <FileText size={22} className="mx-auto text-slate-200 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-300 font-bold">لا يوجد سجل نشاط</p>
          </div>
        )}
        <button onClick={() => onNavigate?.('profile')} className="w-full py-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-300 transition-colors">عرض السجل الكامل</button>
      </div>
    </div>
  );
}
