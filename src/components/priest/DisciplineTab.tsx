import { motion } from 'motion/react';
import { Target, Search } from 'lucide-react';

interface DisciplineTabProps {
  discipline: any[];
  disciplineSearch: string;
  onDisciplineSearchChange: (val: string) => void;
}

export function DisciplineTab({ discipline, disciplineSearch, onDisciplineSearchChange }: DisciplineTabProps) {
  const filteredDiscipline = discipline.filter((d: any) =>
    d.name?.toLowerCase().includes(disciplineSearch.toLowerCase())
  );
  return (
    <motion.div key="discipline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-white/[0.04] dark:bg-card-dark overflow-hidden">
        <div className="border-b border-slate-50 p-6 dark:border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Target className="text-primary-600 dark:text-primary-400" size={20} />
                سجل الانضباط والسلوك
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-300 font-bold mt-1">نقاط السلوك والتحذيرات لكل طالب خلال آخر 30 يوماً</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={15} />
              <input type="text" value={disciplineSearch} onChange={e => onDisciplineSearchChange(e.target.value)}
                placeholder="بحث بالاسم..." className="pr-10 pl-5 py-2.5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold outline-none w-full dark:text-white" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">الطالب</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">النقاط (آخر 30 يوم)</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">إنذارات نشطة</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300 text-center">إنذارات حرجة</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">آخر إنذار</th>
                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-300">التقييم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/10">
              {filteredDiscipline.map((d: any) => {
                const evaluation = d.points >= 80 ? 'ممتاز' : d.points >= 60 ? 'جيد' : d.points >= 30 ? 'متوسط' : 'منخفض';
                const evalColor = d.points >= 80 ? 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400' : d.points >= 60 ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' : d.points >= 30 ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400';
                return (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-black text-slate-500 dark:bg-white/10 dark:text-slate-300 text-xs">{d.name?.charAt(0)}</div>
                        <div className="font-black text-slate-700 dark:text-slate-200 text-sm">{d.name}</div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-lg font-black text-slate-800 dark:text-white">{d.points}</span>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1 rounded-full font-black text-xs ${(d.active_warnings || 0) > 0 ? 'bg-warm-50 dark:bg-warm-500/20 text-warm-600 dark:text-warm-400' : 'bg-ocean-50 dark:bg-ocean-500/20 text-ocean-600 dark:text-ocean-400'}`}>
                        {d.active_warnings || 0}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1 rounded-full font-black text-xs ${(d.critical_warnings || 0) > 0 ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300'}`}>
                        {d.critical_warnings || 0}
                      </span>
                    </td>
                    <td className="p-5 text-xs font-bold text-slate-400 dark:text-slate-300">
                      {d.last_warning_date ? new Date(d.last_warning_date).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1.5 rounded-full font-black text-[10px] ${evalColor}`}>{evaluation}</span>
                    </td>
                  </tr>
                );
              })}
              {filteredDiscipline.length === 0 && (
                <tr><td colSpan={6} className="p-16 text-center text-slate-300 dark:text-slate-400 font-bold">لا توجد بيانات سلوك متاحة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
