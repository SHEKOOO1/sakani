import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Play, Search, X, Film, ChevronRight, ChevronLeft } from 'lucide-react';
import { VideoItem, Playlist as PlaylistType, Category } from '../types';

interface LibraryMainViewProps {
  featuredVideos: VideoItem[];
  categories: Category[];
  playlists: PlaylistType[];
  categoryFilter: string;
  searchQuery: string;
  initialLoading: boolean;
  onOpenVideo: (video: VideoItem) => void;
  onOpenProgram: (playlist: PlaylistType) => void;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (query: string) => void;
  onViewAllPrograms: (categoryId: string) => void;
}

export function LibraryMainView({ featuredVideos, categories, playlists, categoryFilter, searchQuery, initialLoading, onOpenVideo, onOpenProgram, onCategoryChange, onSearchChange, onViewAllPrograms }: LibraryMainViewProps) {
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const autoRef = useRef<any>(null);

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (featuredVideos.length <= 1) return;
    autoRef.current = setInterval(() => {
      setFeaturedIdx(prev => (prev + 1) % featuredVideos.length);
    }, 5000);
  }, [featuredVideos.length]);

  useEffect(() => {
    setFeaturedIdx(0);
    startAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [featuredVideos.length, startAuto]);

  return (
    <div className="space-y-6">
      {/* Hero Featured Slideshow */}
      {featuredVideos.length > 0 ? (
        <div className="relative rounded-xl overflow-hidden shadow-lg">
          <div className="relative aspect-[21/9] bg-gradient-to-br from-primary-900 via-vibrant-900 to-primary-800">
            <AnimatePresence mode="wait">
              <motion.div key={featuredVideos[featuredIdx]?.id || 'empty'}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                {featuredVideos[featuredIdx]?.thumbnail || (featuredVideos[featuredIdx]?.platform !== 'facebook' && featuredVideos[featuredIdx]?.youtube_id) ? (
                  <img src={featuredVideos[featuredIdx].thumbnail || `https://img.youtube.com/vi/${featuredVideos[featuredIdx].youtube_id}/hqdefault.jpg`}
                    alt={featuredVideos[featuredIdx].title}
                    className="w-full h-full object-cover opacity-40"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 right-0 left-0 p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400">مميز</span>
                    {featuredVideos[featuredIdx]?.program_name && (
                      <>
                        <span className="text-[9px] text-white/40">|</span>
                        <span className="text-[9px] text-white/50">{featuredVideos[featuredIdx].program_name}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl md:text-3xl font-black text-white mb-2">{featuredVideos[featuredIdx]?.title}</h2>
                  <p className="text-xs md:text-sm text-white/70 line-clamp-2 mb-4 max-w-2xl">{featuredVideos[featuredIdx]?.description}</p>
                  <button onClick={() => onOpenVideo(featuredVideos[featuredIdx])}
                    className="px-5 py-2.5 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-white/90 transition-all flex items-center gap-2 shadow-lg">
                    <Play size={16} fill="currentColor" /> تشغيل الآن
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {featuredVideos.length > 1 && (
              <>
                <button onClick={() => { setFeaturedIdx(prev => (prev - 1 + featuredVideos.length) % featuredVideos.length); startAuto(); }}
                  className="absolute top-1/2 -translate-y-1/2 left-3 z-10 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full transition-all">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => { setFeaturedIdx(prev => (prev + 1) % featuredVideos.length); startAuto(); }}
                  className="absolute top-1/2 -translate-y-1/2 right-3 z-10 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full transition-all">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {featuredVideos.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-card-dark">
              {featuredVideos.map((_, idx) => (
                <button key={idx} onClick={() => { setFeaturedIdx(idx); startAuto(); }}
                  className={`w-2 h-2 rounded-full transition-all ${idx === featuredIdx ? 'bg-amber-500 w-5' : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'}`} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-primary-600 to-vibrant-600 rounded-xl p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black text-white">مكتبة الفيديو</h2>
          <p className="text-sm text-white/70 font-bold mt-1">تصفح جميع الفيديوهات والبرامج المسجلة</p>
        </div>
      )}

      {/* Categories Filter */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
        <button onClick={() => onCategoryChange('all')}
          className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            categoryFilter === 'all'
              ? 'bg-gradient-to-br from-primary-600 to-vibrant-600 text-white shadow-md'
              : 'bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-primary-200 dark:hover:border-primary-500/30'
          }`}>
          الكل
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => onCategoryChange(cat.id)}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              categoryFilter === cat.id
                ? 'bg-gradient-to-br from-primary-600 to-vibrant-600 text-white shadow-md'
                : 'bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-primary-200 dark:hover:border-primary-500/30'
            }`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          placeholder="ابحث في المكتبة..."
          className="w-full pr-10 pl-10 py-3 bg-white dark:bg-card-dark border border-slate-100 dark:border-white/10 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Programs by Category */}
      {initialLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map(catIdx => (
            <div key={catIdx}>
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700/30 rounded-lg animate-pulse mb-4" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3].map(i => (
                  <div key={i} className="shrink-0 w-56 bg-slate-200 dark:bg-slate-700/30 rounded-xl animate-pulse">
                    <div className="aspect-[16/9] rounded-t-xl" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700/30 rounded-lg w-3/4" />
                      <div className="h-2 bg-slate-200 dark:bg-slate-700/30 rounded-lg w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {(categoryFilter === 'all' ? categories : categories.filter(c => c.id === categoryFilter)).map(cat => {
            const catPlaylists = playlists.filter(p =>
              p.category_id === cat.id && p.is_active &&
              (p.item_count ?? 0) > 0
            );
            if (catPlaylists.length === 0) return null;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{cat.name}</h3>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
                  <button onClick={() => onViewAllPrograms(cat.id)}
                    className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-all shrink-0">
                    المزيد
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3 -mx-1 px-1 snap-x snap-mandatory">
                  {catPlaylists.map(pl => (
                    <motion.button key={pl.id} whileHover={{ scale: 1.02 }}
                      onClick={() => onOpenProgram(pl)}
                      className="shrink-0 w-56 snap-start group bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] overflow-hidden text-right shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-500/30 transition-all">
                      <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        {pl.cover_image ? (
                          <img src={pl.cover_image} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-vibrant-100 dark:from-primary-900/30 dark:to-vibrant-900/30">
                            <Film size={32} className="text-primary-300 dark:text-primary-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg border border-white/10">
                          {pl.item_count || 0} حلقة
                        </span>
                      </div>
                      <div className="p-3.5">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">{pl.name}</h4>
                        {pl.description && (
                          <p className="text-[9px] text-slate-500 mt-1 line-clamp-2">{pl.description}</p>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}

          {!searchQuery && !playlists.some(p => p.is_active && (p.item_count ?? 0) > 0) && (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
              <Film size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-lg font-bold text-slate-400">لا توجد برامج بعد</p>
              <p className="text-xs text-slate-500 mt-1">سيتم إضافة البرامج قريباً</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
