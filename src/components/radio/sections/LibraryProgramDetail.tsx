import { motion } from 'motion/react';
import { ChevronRight, Film, Play } from 'lucide-react';
import { Playlist, PlaylistItem, VideoItem } from '../types';

interface LibraryProgramDetailProps {
  selectedProgram: Playlist;
  programItems: PlaylistItem[];
  videos: VideoItem[];
  programsCategoryId: string | null;
  onOpenPlayer: (video: VideoItem) => void;
  onBack: () => void;
}

export function LibraryProgramDetail({ selectedProgram, programItems, videos, programsCategoryId, onOpenPlayer, onBack }: LibraryProgramDetailProps) {
  return (
    <div className="space-y-6">
      <button onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
        <ChevronRight size={16} /> العودة إلى {programsCategoryId ? 'البرامج' : 'المكتبة'}
      </button>

      {/* Program Banner */}
      <div className="relative bg-gradient-to-br from-primary-700 via-vibrant-700 to-primary-800 rounded-xl p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.05),transparent_50%)]" />
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">{selectedProgram.name}</h2>
          {selectedProgram.description && (
            <p className="text-sm text-white/70 max-w-2xl">{selectedProgram.description}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-[10px] font-bold text-white/50 bg-white/10 px-3 py-1.5 rounded-lg">
              {selectedProgram.item_count || 0} حلقة
            </span>
          </div>
        </div>
      </div>

      {/* Episodes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {programItems.sort((a, b) => a.sort_order - b.sort_order).map((item, idx) => {
          const video = videos.find(v => v.id === item.item_id) || videos.find(v => v.youtube_id === item.item_id);
          const isFbItem = /facebook\.com|fb\.watch|fb\.com/i.test(item.item_id);
          const fallbackVideo: VideoItem = {
            id: item.item_id, title: item.item_title, description: '',
            youtube_url: isFbItem ? item.item_id : `https://www.youtube.com/watch?v=${item.item_id}`,
            youtube_id: isFbItem ? item.item_id : item.item_id,
            platform: isFbItem ? 'facebook' : 'youtube' as any,
            category: '', program: '', tags: [],
            thumbnail: item.item_thumbnail || '', duration: '', is_live: false, is_featured: false, created_at: ''
          };
          const videoToPlay = video || fallbackVideo;
          return (
            <motion.button key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              onClick={() => onOpenPlayer(videoToPlay)}
              className="group bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] overflow-hidden text-right shadow-sm hover:shadow-md transition-all">
              <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
                {item.item_thumbnail && (
                  <img src={item.item_thumbnail} alt={item.item_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <Play size={20} fill="currentColor" className="text-slate-900 mr-0.5" />
                  </div>
                </div>
                <span className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg border border-white/10">
                  {idx + 1}
                </span>
              </div>
              <div className="p-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">{item.item_title}</h4>
              </div>
            </motion.button>
          );
        })}
      </div>
      {programItems.length === 0 && (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
          <Film size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-400">لا توجد حلقات في هذا البرنامج</p>
        </div>
      )}
    </div>
  );
}
