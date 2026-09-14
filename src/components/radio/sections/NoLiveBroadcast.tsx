import { Bell, Tv } from 'lucide-react';

interface NoLiveBroadcastProps {
  user: any;
  liveNotificationEnabled: boolean;
  onToggleNotification: () => void;
}

export function NoLiveBroadcast({ user, liveNotificationEnabled, onToggleNotification }: NoLiveBroadcastProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-8 shadow-sm">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
          <Tv size={32} className="text-slate-300" />
        </div>
        <p className="text-base font-black text-slate-900 dark:text-white mb-1">لا توجد بثوث مباشرة حالياً</p>
        <p className="text-[11px] text-slate-500 font-bold">تفقد مكتبة الفيديو للمحتوى المسجل أو انتظر البث المباشر القادم</p>
        {user && (
          <button onClick={onToggleNotification}
            className={"mt-4 inline-flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-bold transition-all " + (liveNotificationEnabled ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-500/10')}>
            <Bell size={14} className={liveNotificationEnabled ? 'fill-amber-500' : ''} />
            {liveNotificationEnabled ? 'التنبيهات مفعّلة للبث المباشر' : 'فعّل التنبيهات للبث المباشر'}
          </button>
        )}
      </div>
    </div>
  );
}
