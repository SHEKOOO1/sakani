import { motion } from 'motion/react';
import { BarChart3, RefreshCw, Loader2, Radio, Tv, BookOpen, Music, MessageCircle, Hash, Bell, Users, Ban, EyeOff } from 'lucide-react';

function StatCard({ label, value, icon: Icon, color, small }: { label: string; value: number; icon: any; color: string; small?: boolean }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    pink: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    slate: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400',
    primary: 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400',
  };
  return (
    <div className={"bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-xl " + (small ? 'p-3' : 'p-4')}>
      <div className="flex items-center gap-2 mb-2">
        <div className={"p-1.5 rounded-lg " + (colors[color] || colors.slate)}>
          <Icon size={small ? 12 : 16} />
        </div>
        <span className={"font-bold " + (small ? 'text-[9px]' : 'text-[10px]') + " text-slate-500 dark:text-slate-400"}>{label}</span>
      </div>
      <p className={"font-black text-slate-900 dark:text-white " + (small ? 'text-lg' : 'text-2xl')}>{value.toLocaleString('ar-EG')}</p>
    </div>
  );
}

interface RadioStatsPanelProps {
  radioStats: any;
  radioBroadcastStats: any;
  radioChatStats: any;
  fetchRadioStats: () => void;
}

export function RadioStatsPanel({ radioStats, radioBroadcastStats, radioChatStats, fetchRadioStats }: RadioStatsPanelProps) {
  return (
    <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
            <BarChart3 size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">إحصائيات الراديو</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">Radio 5:14 Analytics</p>
          </div>
            <button onClick={fetchRadioStats} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw size={16} /></button>
        </div>
        {radioStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="البثوث" value={radioStats.broadcasts} icon={Radio} color="amber" />
            <StatCard label="الفيديوهات" value={radioStats.videos} icon={Tv} color="red" />
            <StatCard label="البرامج" value={radioStats.playlists} icon={BookOpen} color="emerald" />
            <StatCard label="الأغاني" value={radioStats.tracks} icon={Music} color="violet" />
            <StatCard label="رسائل الشات" value={radioStats.chatMessages} icon={MessageCircle} color="blue" />
            <StatCard label="رسائل اليوم" value={radioStats.chatMessagesToday} icon={MessageCircle} color="cyan" />
            <StatCard label="التعليقات" value={radioStats.videoComments} icon={Hash} color="purple" />
            <StatCard label="التذكيرات" value={radioStats.reminders} icon={Bell} color="orange" />
            <StatCard label="مشتركي المباشر" value={radioStats.liveSubscriptions} icon={Users} color="pink" />
            <StatCard label="المحظورين" value={radioStats.bannedUsers} icon={Ban} color="rose" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
              <Loader2 size={32} className="text-slate-300 dark:text-slate-600" />
            </motion.div>
          </div>
        )}
      </div>

      {radioBroadcastStats && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"><Radio size={18} className="text-amber-600 dark:text-amber-400" /></div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">تفاصيل البثوث</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="إجمالي" value={radioBroadcastStats.total} icon={Radio} color="slate" small />
            <StatCard label="نشط" value={radioBroadcastStats.active} icon={Radio} color="emerald" small />
            <StatCard label="صوتي" value={radioBroadcastStats.audio} icon={Music} color="primary" small />
            <StatCard label="مرئي" value={radioBroadcastStats.video + radioBroadcastStats.both} icon={Tv} color="red" small />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {radioBroadcastStats.all.slice(0, 30).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] text-[10px] font-bold text-slate-600 dark:text-slate-400">
                <span className="truncate">{b.title}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] ${b.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                  {b.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {radioChatStats && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><MessageCircle size={18} className="text-blue-600 dark:text-blue-400" /></div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">نشاط الشات</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="إجمالي الرسائل" value={radioChatStats.total} icon={MessageCircle} color="blue" small />
            <StatCard label="رسائل اليوم" value={radioChatStats.today} icon={MessageCircle} color="cyan" small />
            <StatCard label="مستخدمين فريدين" value={radioChatStats.uniqueUsers} icon={Users} color="violet" small />
            <StatCard label="مخفية" value={radioChatStats.hidden} icon={EyeOff} color="rose" small />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {radioChatStats.recent.slice(0, 20).map((m: any) => (
              <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] text-[10px]">
                <span className="font-black text-slate-700 dark:text-slate-300 shrink-0">{m.user_name}:</span>
                <span className="text-slate-500 dark:text-slate-400 truncate">{m.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
