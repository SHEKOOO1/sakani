import { motion } from 'motion/react';
import { Tv, Radio, Link2, CalendarDays, Check, Eye, Loader2, Play, Clock, Calendar } from 'lucide-react';

interface LiveStreamInjectionCardProps {
  isLive: boolean;
  injectionMode: 'now' | 'schedule';
  onInjectionModeChange: (mode: 'now' | 'schedule') => void;
  streamTitle: string;
  onStreamTitleChange: (v: string) => void;
  streamUrl: string;
  onStreamUrlChange: (v: string) => void;
  scheduledAt: string;
  onScheduledAtChange: (v: string) => void;
  saving: boolean;
  onInject: () => void;
  scheduledBroadcasts: any[];
  extractYoutubeId: (url: string) => string | null;
}

export function LiveStreamInjectionCard({
  isLive, injectionMode, onInjectionModeChange,
  streamTitle, onStreamTitleChange,
  streamUrl, onStreamUrlChange,
  scheduledAt, onScheduledAtChange,
  saving, onInject, scheduledBroadcasts, extractYoutubeId
}: LiveStreamInjectionCardProps) {
  return (
    <div className={`relative rounded-xl border-2 transition-all overflow-hidden ${
      isLive
        ? 'border-emerald-500/40 bg-emerald-500/5'
        : injectionMode === 'now'
          ? 'border-red-500/30 bg-red-500/[0.02]'
          : 'border-amber-500/30 bg-amber-500/[0.02]'
    }`}>
      {injectionMode === 'now' && !isLive && (
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-[80px] animate-pulse pointer-events-none" />
      )}
      <div className="relative p-6">
        {/* Toggle */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isLive ? 'bg-emerald-50 dark:bg-emerald-500/10' :
              injectionMode === 'now' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-amber-50 dark:bg-amber-500/10'
            }`}>
              <Tv size={20} className={isLive ? 'text-emerald-500' : injectionMode === 'now' ? 'text-red-500' : 'text-amber-500'} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">إضافة بث مرئي</h3>
              <p className="text-[9px] text-slate-500 font-bold mt-0.5">Live Stream Injection</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
            <button onClick={() => onInjectionModeChange('now')}
              className={`relative px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                injectionMode === 'now'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}>
              🔴 بث مباشر الآن
            </button>
            <button onClick={() => onInjectionModeChange('schedule')}
              className={`relative px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                injectionMode === 'schedule'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}>
              📅 جدولة لاحقاً
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
              <Radio size={12} className="text-primary-500" />
              عنوان البث
            </label>
            <input type="text" value={streamTitle} onChange={e => onStreamTitleChange(e.target.value)}
              className={`w-full p-3 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all ${
                injectionMode === 'now' && !isLive
                  ? 'bg-red-50/50 dark:bg-red-500/5 border-2 border-red-200 dark:border-red-500/20 focus:border-red-500/50'
                  : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 focus:border-primary-500/30'
              }`}
              placeholder="مثال: عظة يوم الرب" />
          </div>

          {/* YouTube URL */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
              <Link2 size={12} className="text-blue-500" />
              رابط البث (YouTube / Facebook)
            </label>
            <div className="flex gap-2">
              <input type="url" value={streamUrl} onChange={e => onStreamUrlChange(e.target.value)}
                className={`flex-1 p-3 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 transition-all font-mono ${
                  injectionMode === 'now' && !isLive && streamUrl.trim()
                    ? 'bg-red-50/50 dark:bg-red-500/5 border-2 border-red-200 dark:border-red-500/20 focus:border-red-500/50'
                    : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 focus:border-primary-500/30'
                }`}
                placeholder="https://youtube.com/watch?v=... أو رابط فيسبوك" />
              {streamUrl && (extractYoutubeId(streamUrl) || /facebook\.com|fb\.watch|fb\.com/i.test(streamUrl)) && (
                <div className="shrink-0 px-3 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                  <Check size={16} className="text-emerald-500" />
                </div>
              )}
            </div>
          </div>

          {/* Schedule Date */}
          {injectionMode === 'schedule' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                <CalendarDays size={12} className="text-amber-500" />
                موعد البث
              </label>
              <input type="datetime-local" value={scheduledAt} onChange={e => onScheduledAtChange(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white focus:border-amber-500/30 transition-all" />
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={onInject} disabled={saving || !streamTitle.trim() || !streamUrl.trim() || isLive}
              className="flex-1 py-3 bg-gradient-to-br from-red-600 to-rose-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : injectionMode === 'now' ? <Play size={18} fill="currentColor" /> : <Clock size={18} />}
              {injectionMode === 'now' ? 'بدء البث فوراً' : 'حفظ الجدولة'}
            </button>
            {injectionMode === 'now' && streamUrl && !isLive && (
              <button onClick={() => window.open(streamUrl, '_blank')}
                className="px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
                <Eye size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live broadcasts summary */}
      {scheduledBroadcasts.filter((b: any) => b.is_active).length > 0 && (
        <div className="border-t border-slate-100 dark:border-white/10 px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">جداول البث المجدولة</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {scheduledBroadcasts.filter((b: any) => b.is_active).slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-white/[0.05] rounded-lg border border-slate-100 dark:border-white/10">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{b.title}</span>
                {b.scheduled_at && (
                  <span className="text-[8px] text-slate-400">{new Date(b.scheduled_at).toLocaleDateString('ar-EG')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
