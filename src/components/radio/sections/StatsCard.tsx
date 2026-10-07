import { Users, Eye, Wifi } from 'lucide-react';

interface StatsCardProps {
  displayListeners: number;
  liveVideosCount: number;
  liveViewerCount: number;
  displayViewers: number;
}

export function StatsCard({ displayListeners, liveVideosCount, liveViewerCount, displayViewers }: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <h3 className="text-xs font-black text-slate-900 dark:text-white mb-4">إحصائيات البث المباشر</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-primary-50 dark:bg-primary-500/10 rounded-xl text-center">
          <Users size={20} className="mx-auto text-primary-500 mb-1.5" />
          <p className="text-lg font-black text-primary-600 dark:text-primary-400">{displayListeners}</p>
          <p className="text-[9px] font-bold text-primary-500/70">مستمع</p>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-center">
          <Eye size={20} className="mx-auto text-purple-500 mb-1.5" />
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">{liveVideosCount > 0 ? liveViewerCount : displayViewers}</p>
          <p className="text-[9px] font-bold text-purple-500/70">مشاهد</p>
        </div>
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-center">
          <Wifi size={20} className="mx-auto text-emerald-500 mb-1.5" />
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">320kbps</p>
          <p className="text-[9px] font-bold text-emerald-500/70">الجودة</p>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-center">
          <span className="relative flex h-5 w-5 mx-auto mb-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500" />
          </span>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400">مستقر</p>
          <p className="text-[9px] font-bold text-amber-500/70">حالة الاتصال</p>
        </div>
      </div>
    </div>
  );
}
