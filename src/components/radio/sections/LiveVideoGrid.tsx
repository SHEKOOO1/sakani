import { motion } from 'motion/react';
import { Eye, Play } from 'lucide-react';
import { VideoItem } from '../types';

interface LiveVideoGridProps {
  liveVideos: VideoItem[];
  liveViewerCount: number;
  onOpenVideo: (video: VideoItem) => void;
}

export function LiveVideoGrid({ liveVideos, liveViewerCount, onOpenVideo }: LiveVideoGridProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <h3 className="text-sm font-black text-slate-900 dark:text-white">البث المرئي المباشر</h3>
        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
          <Eye size={10} className="text-red-400" />
          {liveViewerCount} مشاهد
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {liveVideos.map(v => (
          <motion.button key={v.id} whileHover={{ scale: 1.02 }} onClick={() => onOpenVideo(v)}
            className="relative bg-gradient-to-br from-red-500/5 to-purple-500/5 rounded-xl overflow-hidden group text-right shadow-sm"
            style={{ borderImage: 'linear-gradient(135deg, #ef4444, #a855f7, #ef4444) 1' }}>
            <div className="absolute -ins-0.5 bg-gradient-to-br from-red-500 via-purple-500 to-red-500 rounded-xl opacity-50 group-hover:opacity-80 blur-[2px] transition-all animate-pulse" />
            <div className="relative bg-white dark:bg-card-dark rounded-xl overflow-hidden">
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative">
                {v.thumbnail || v.platform !== 'facebook' ? (
                  <img src={v.thumbnail || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                    alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/30">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-500/60"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                )}
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-600/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg flex items-center gap-1.5 border border-red-400/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                  مباشر
                </div>
                {v.platform === 'facebook' && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[8px] font-bold rounded-lg border border-blue-400/30 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    فيسبوك
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg flex items-center gap-1.5 border border-white/10">
                  <Eye size={10} />
                  {liveViewerCount}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <Play size={24} fill="currentColor" className="text-slate-900 mr-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-2">{v.title}</h4>
                {v.description && (
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{v.description}</p>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
