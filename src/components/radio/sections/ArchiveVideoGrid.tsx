import { motion } from 'motion/react';
import { Film } from 'lucide-react';
import { VideoItem } from '../types';
import { timeAgo } from '../helpers';

interface ArchiveVideoGridProps {
  archiveVideos: VideoItem[];
  getCategoryName: (catId: string | undefined | null) => string;
  onOpenVideo: (video: VideoItem) => void;
}

export function ArchiveVideoGrid({ archiveVideos, getCategoryName, onOpenVideo }: ArchiveVideoGridProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Film size={16} className="text-primary-500" />
        <h3 className="text-sm font-black text-slate-900 dark:text-white">الأرشيف — البث السابق</h3>
        <span className="mr-auto text-[9px] text-slate-500 font-bold">{archiveVideos.length} فيديو</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto custom-scrollbar">
        {archiveVideos.map(v => (
          <motion.button key={v.id} whileHover={{ scale: 1.02 }} onClick={() => onOpenVideo(v)}
            className="group bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-xl overflow-hidden text-right shadow-sm">
            <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
              {v.thumbnail || v.platform !== 'facebook' ? (
                <img src={v.thumbnail || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/30">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-500/60"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {v.platform === 'facebook' ? (
                  <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[8px] font-bold rounded-lg border border-blue-400/30 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    فيسبوك
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-red-600/90 backdrop-blur-sm text-white text-[8px] font-bold rounded-lg border border-red-400/30 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    يوتيوب
                  </span>
                )}
              </div>
              {v.duration && (
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg border border-white/10">
                  {v.duration}
                </span>
              )}
            </div>
            <div className="p-3 space-y-1">
              <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">{v.title}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 font-bold">{timeAgo(v.created_at)}</span>
                {v.tags?.map(tag => (
                  <span key={tag} className="text-[8px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-1.5 py-0.5 rounded">
                    {getCategoryName(tag)}
                  </span>
                ))}
                {(!v.tags || v.tags.length === 0) && v.category && (
                  <span className="text-[8px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-1.5 py-0.5 rounded">
                    {getCategoryName(v.category)}
                  </span>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
