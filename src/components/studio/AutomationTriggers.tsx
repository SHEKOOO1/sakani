import { Sparkles, Hash, Bell, Check, Loader2, StopCircle, Tv, Users, TrendingUp, Clock } from 'lucide-react';

interface AutomationTriggersProps {
  pinnedToTicker: boolean;
  onPinToTicker: () => void;
  streamUrl: string;
  pushNotificationSent: boolean;
  pushSending: boolean;
  onSendPush: () => void;
  isLive: boolean;
  masterLoading: boolean;
  onMasterGoLive: () => void;
  masterHover: boolean;
  onMasterHoverChange: (hover: boolean) => void;
  timer: number;
  viewerCount: number;
  peakViewers: number;
  formatDuration: (seconds: number) => string;
}

export function AutomationTriggers({
  pinnedToTicker, onPinToTicker, streamUrl,
  pushNotificationSent, pushSending, onSendPush,
  isLive, masterLoading, onMasterGoLive, masterHover, onMasterHoverChange,
  timer, viewerCount, peakViewers, formatDuration
}: AutomationTriggersProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
          <Sparkles size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">أزرار التحكم الآلي</h3>
          <p className="text-[9px] text-slate-500 font-bold mt-0.5">Live Automation Triggers</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`p-4 rounded-xl border transition-all ${
          pinnedToTicker
            ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${pinnedToTicker ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-white dark:bg-white/[0.05]'}`}>
                <Hash size={16} className={pinnedToTicker ? 'text-amber-600' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">تثبيت في شريط الأخبار</p>
                <p className="text-[8px] text-slate-400 font-bold">تحويل الشريط إلى إعلان وامض</p>
              </div>
            </div>
            <button onClick={onPinToTicker} disabled={!streamUrl}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                pinnedToTicker ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${!streamUrl ? 'opacity-40' : ''}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                pinnedToTicker ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`} />
            </button>
          </div>
          {pinnedToTicker && (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg">
              ✓ تم تثبيت البث في شريط الأخبار — سيظهر للمستخدمين كنص وامض
            </p>
          )}
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          pushNotificationSent
            ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${pushNotificationSent ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-white dark:bg-white/[0.05]'}`}>
                <Bell size={16} className={pushNotificationSent ? 'text-emerald-600' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">إشعار فوري (Push)</p>
                <p className="text-[8px] text-slate-400 font-bold">تنبيه لجميع المستخدمين</p>
              </div>
            </div>
            <button onClick={onSendPush} disabled={pushSending || pushNotificationSent || !streamUrl}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                pushNotificationSent ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${(!streamUrl || pushNotificationSent) ? 'opacity-40' : ''}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                pushNotificationSent ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`} />
            </button>
          </div>
          {pushSending && (
            <div className="flex items-center gap-2 text-[9px] text-primary-600 font-bold">
              <Loader2 size={12} className="animate-spin" /> جاري إرسال الإشعار...
            </div>
          )}
          {pushNotificationSent && (
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
              <Check size={12} /> تم إرسال الإشعار لجميع المستخدمين
            </p>
          )}
        </div>

        <div className="relative pt-3">
          {!isLive && (
            <div className="absolute -top-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          )}
          <button
            onClick={onMasterGoLive}
            disabled={masterLoading}
            onMouseEnter={() => onMasterHoverChange(true)}
            onMouseLeave={() => onMasterHoverChange(false)}
            className={`relative w-full py-5 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 border-2 overflow-hidden ${
              isLive
                ? masterHover
                  ? 'bg-gradient-to-br from-red-600 to-rose-700 text-white border-red-400/50 shadow-lg shadow-red-500/40 scale-[1.02]'
                  : 'bg-gradient-to-br from-emerald-600 to-green-600 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/30'
                : 'bg-gradient-to-br from-red-600 to-rose-600 text-white border-red-400/50 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]'
            } ${!isLive && !masterLoading ? 'animate-pulse-shadow' : ''} ${masterLoading ? 'opacity-70' : ''}`}
          >
            {!isLive && (
              <div className="absolute inset-0 rounded-2xl border-2 border-red-400/20 animate-pulse" />
            )}
            {masterLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : isLive ? (
              masterHover ? (
                <>
                  <StopCircle size={24} />
                  إنهاء البث المباشر فوراً 🛑
                </>
              ) : (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                  </span>
                  البث المباشر نشط الآن
                  <span className="font-mono text-lg text-white/80" dir="ltr">{formatDuration(timer)}</span>
                </>
              )
            ) : (
              <>
                <Tv size={24} />
                إطلاق البث المرئي الشامل
              </>
            )}
          </button>

          {isLive && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl">
                <Users size={14} className="text-primary-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{viewerCount} مشاهد</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl">
                <TrendingUp size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">ذروة {peakViewers}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl">
                <Clock size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono" dir="ltr">{formatDuration(timer)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
