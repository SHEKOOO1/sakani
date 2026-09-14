import { motion } from 'motion/react';
import { ChevronRight, Film } from 'lucide-react';
import { Playlist as PlaylistType, Category } from '../types';

interface LibraryProgramsViewProps {
  programsCategoryId: string | null;
  categories: Category[];
  playlists: PlaylistType[];
  onOpenProgram: (playlist: PlaylistType) => void;
  onBack: () => void;
}

export function LibraryProgramsView({ programsCategoryId, categories, playlists, onOpenProgram, onBack }: LibraryProgramsViewProps) {
  return (
    <div className="space-y-6">
      <button onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
        <ChevronRight size={16} /> العودة إلى المكتبة
      </button>
      <div className="bg-gradient-to-br from-primary-600 to-vibrant-600 rounded-xl p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-black text-white">
          {categories.find(c => c.id === programsCategoryId)?.name || 'البرامج'}
        </h2>
        <p className="text-sm text-white/70 font-bold mt-1">جميع البرامج في هذا التصنيف</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {playlists.filter(p => p.category_id === programsCategoryId && p.is_active).map(pl => (
          <motion.button key={pl.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => onOpenProgram(pl)}
            className="group bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] overflow-hidden text-right shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-500/30 transition-all">
            <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-800 overflow-hidden">
              {pl.cover_image ? (
                <img src={pl.cover_image} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-vibrant-100 dark:from-primary-900/30 dark:to-vibrant-900/30">
                  <Film size={40} className="text-primary-300 dark:text-primary-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg border border-white/10">
                {pl.item_count || 0} حلقة
              </span>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{pl.name}</h4>
              {pl.description && (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{pl.description}</p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
      {playlists.filter(p => p.category_id === programsCategoryId && p.is_active).length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
          <Film size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-bold text-slate-400">لا توجد برامج في هذا التصنيف</p>
        </div>
      )}
    </div>
  );
}
