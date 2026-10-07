import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import { SongHistoryItem, DEFAULT_COVER, FALLBACK_COVER } from '../types';
import { timeAgo } from '../helpers';

interface SongHistoryPanelProps {
  songHistory: SongHistoryItem[];
  open: boolean;
}

export function SongHistoryPanel({ songHistory, open }: SongHistoryPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-primary-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">تاريخ الترانيم</h3>
              <span className="mr-auto text-[9px] text-slate-400 font-bold">{songHistory.length} ترنيمة</span>
            </div>
            {songHistory.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">لا توجد ترانيم سابقة</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                {songHistory.map((song) => (
                  <div key={song.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-white/10">
                      <img src={song.cover_url || DEFAULT_COVER} alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { const el = e.target as HTMLImageElement; el.src = FALLBACK_COVER; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{song.title}</p>
                      <p className="text-[9px] font-bold text-slate-500 truncate">{song.artist || 'راديو 5:14'}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold">{timeAgo(song.played_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
