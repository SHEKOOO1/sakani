import { motion, AnimatePresence } from 'motion/react';
import { Eye, Bell } from 'lucide-react';
import { VideoItem } from '../types';

interface LiveTickerBannerProps {
  show: boolean;
  liveVideos: VideoItem[];
  liveViewerCount: number;
  user: any;
  liveNotificationEnabled: boolean;
  onTickerClick: () => void;
  onToggleNotification: () => void;
}

export function LiveTickerBanner({ show, liveVideos, liveViewerCount, user, liveNotificationEnabled, onTickerClick, onToggleNotification }: LiveTickerBannerProps) {
  return (
    <AnimatePresence>
      {show && liveVideos.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          onClick={onTickerClick}
          className="relative rounded-xl overflow-hidden cursor-pointer group mb-6">
          <div className="absolute inset-0 bg-gradient-to-l from-red-600 via-red-700 to-blue-900 animate-pulse" />
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:200%_200%] animate-[shimmer_3s_ease-in-out_infinite]" />
          <div className="relative px-5 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400" />
              </span>
              <span className="px-2.5 py-1 bg-red-500/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-white flex items-center gap-1.5 border border-red-400/30">
                مباشر
              </span>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <motion.div
                animate={{ x: ['0%', '-100%'] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="whitespace-nowrap">
                <span className="text-sm md:text-base font-black text-white [text-shadow:0_0_10px_rgba(255,255,255,0.3)]">
                  ⚠️ انطلق الآن البث المرئي المباشر: {liveVideos[0].title}.. اضغط هنا للانضمام للمشاهدة الحية
                </span>
              </motion.div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20 text-white text-[10px] font-bold shrink-0">
              <Eye size={12} />
              {liveViewerCount} مشاهد
            </div>
            {user && (
              <button onClick={e => { e.stopPropagation(); onToggleNotification(); }}
                className={"shrink-0 p-2 rounded-lg transition-all " + (liveNotificationEnabled ? 'bg-amber-400/30 text-amber-200' : 'bg-white/15 text-white/60 hover:text-white border border-white/20')}>
                <Bell size={14} className={liveNotificationEnabled ? 'fill-amber-300' : ''} />
              </button>
            )}
            <div className="shrink-0 px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-white text-xs font-bold group-hover:bg-white/30 transition-all">
              اضغط للمشاهدة
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
