import { History, CheckCircle2, Settings } from 'lucide-react';

interface LaundrySidebarProps {
  queue: any[];
}

export function LaundrySidebar({ queue }: LaundrySidebarProps) {
  return (
    <div className="xl:col-span-4 space-y-8">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-10 text-white relative overflow-hidden group">
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <History size={32} />
            </div>
            <div>
              <h4 className="text-2xl font-black tracking-tight">إحصائيات اليوم</h4>
              <p className="text-slate-400 text-sm font-medium italic">سجلات الغسيل الفورية</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">تم إنجازه</p>
              <p className="text-3xl font-black">{queue.filter((q: any) => q.status === 'completed').length}</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">في الانتظار</p>
              <p className="text-3xl font-black">{queue.filter((q: any) => q.status === 'waiting').length}</p>
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">قواعد المغسلة</h5>
            {[
              'يرجى عدم التأخر عن استلام الملابس.',
              'المسؤول لديه الصلاحية بتخطي أي طالب متأخر.',
              'الطابور مستمر حتى يتم إغلاقه يدوياً.'
            ].map((rule, i) => (
              <div key={i} className="flex gap-3 text-xs font-bold text-slate-400">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
        <svg className="absolute -bottom-20 -right-20 text-white/5 group-hover:text-blue-500/5 transition-all duration-1000" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      </div>
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-10 shadow-sm">
        <h4 className="text-xl font-black text-slate-800 dark:text-white mb-8 flex items-center gap-3">
          <Settings size={20} className="text-primary-600" />
          آخر الحركات
        </h4>
        <div className="space-y-6">
          {queue.filter((q: any) => q.status === 'called').slice(0, 3).map((q: any) => (
            <div key={q.id} className="flex gap-4 group">
              <div className="w-1.5 h-12 bg-blue-500 rounded-full shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800">استدعاء {q.student_name}</p>
                <p className="text-[10px] text-slate-400 font-black mt-1">الغسالة: {q.machine_name || '---'}</p>
              </div>
            </div>
          ))}
          {queue.filter((q: any) => q.status === 'called').length === 0 && (
            <p className="text-xs text-slate-400 italic">لا توجد حركات نشطة حالياً</p>
          )}
        </div>
      </div>
    </div>
  );
}
