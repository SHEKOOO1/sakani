import { motion } from 'motion/react';
import { BarChart3 } from 'lucide-react';

interface EventReportViewProps {
  studentsList: any[];
  detailedAttendance: any[];
  sessions: any[];
}

export function EventReportView({ studentsList, detailedAttendance, sessions }: EventReportViewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="report" className="space-y-12 animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white">التقرير الشامل للفعالية</h3>
          <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-[0.2em]">تحليلات مفصلة لكل الأقسام</p>
        </div>
        <button className="neon-btn neon-btn-info neon-btn-sm">
          <BarChart3 size={14}/> تصدير التقرير (Excel)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-8 bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/10 text-center">
          <p className="text-5xl font-black text-slate-900 dark:text-white leading-none">{studentsList.length}</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-4">إجمالي الطلاب</p>
        </div>
        <div className="p-8 bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/10 text-center">
          <p className="text-5xl font-black text-neon-primary leading-none">
            {detailedAttendance.filter(a => !a.session_id && a.status === 'present').length}
          </p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-4">حضور الفعالية العامة</p>
        </div>
        <div className="p-8 bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/10 text-center">
          <p className="text-5xl font-black text-neon-accent leading-none">
            {detailedAttendance.filter(a => a.status === 'absent').length}
          </p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-4">إجمالي حالات الغياب</p>
        </div>
        <div className="p-8 bg-white dark:bg-white/5 rounded-card border border-slate-100 dark:border-white/10 text-center">
          <p className="text-5xl font-black text-neon-secondary leading-none">{sessions.length}</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-4">عدد الأقسام الفرعية</p>
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-lg font-black text-slate-900 dark:text-white pl-4 border-r-4 border-neon-primary mb-6">تفاصيل حضور الأقسام</h4>
        <div className="overflow-hidden rounded-card border border-slate-100 dark:border-white/10 bg-white dark:bg-white/5">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-white dark:bg-white/5 text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                <th className="p-6">القسم / المحاضرة</th>
                <th className="p-6">نسبة الحضور</th>
                <th className="p-6">حاضر</th>
                <th className="p-6">غائب</th>
                <th className="p-6">معتذر/أخرى</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {sessions.map(session => {
                const sessionAtt = detailedAttendance.filter(a => a.session_id === session.id);
                const pCount = sessionAtt.filter(a => a.status === 'present').length;
                const aCount = sessionAtt.filter(a => a.status === 'absent').length;
                const oCount = sessionAtt.filter(a => ['excused', 'traveling', 'other'].includes(a.status)).length;
                const rate = Math.round((pCount / studentsList.length) * 100) || 0;

                return (
                  <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-6 font-black text-slate-900 dark:text-white text-sm">{session.title}</td>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-white dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-neon-secondary shadow-glow-blue" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{rate}%</span>
                      </div>
                    </td>
                    <td className="p-6 font-bold text-neon-primary text-sm">{pCount}</td>
                    <td className="p-6 font-bold text-red-500 text-sm">{aCount}</td>
                    <td className="p-6 font-bold text-slate-400 text-sm">{oCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
