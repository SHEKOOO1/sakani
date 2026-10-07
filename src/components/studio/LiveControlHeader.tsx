import { motion } from 'motion/react';
import { Tv, Wifi, RefreshCw, Users } from 'lucide-react';

interface LiveControlHeaderProps {
  streamOnline: boolean;
  isLive: boolean;
  timer: number;
  viewerCount: number;
  onRefresh: () => void;
  formatDuration: (seconds: number) => string;
}

export function LiveControlHeader({ streamOnline, isLive, timer, viewerCount, onRefresh, formatDuration }: LiveControlHeaderProps) {
  return (
    <div className="relative bg-gradient-to-br from-red-900 via-rose-900 to-primary-900 rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(217,70,239,0.1),transparent_50%)]" />
      <div className="relative p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl border border-white/20">
              <Tv size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">غرفة البث المباشر</h1>
              <p className="text-sm text-white/60 font-bold mt-1">Live Control Room — راديو 5:14</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${
              streamOnline ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${streamOnline ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${streamOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </span>
              <Wifi size={14} />
              <span className="text-[10px] font-bold">{streamOnline ? 'البث الصوتي نشط' : 'متوقف'}</span>
            </div>
            
              <button onClick={onRefresh} aria-label="تحديث" className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw  size={18} />
            
              </button>
          </div>
        </div>
        {isLive && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-4 p-3 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-black text-white">البث المباشر نشط الآن</span>
            <span className="text-xs font-bold text-white/70 font-mono" dir="ltr">{formatDuration(timer)}</span>
            <div className="flex items-center gap-1.5 mr-auto">
              <Users size={14} className="text-white/70" />
              <span className="text-xs font-bold text-white/70">{viewerCount} مشاهد</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
