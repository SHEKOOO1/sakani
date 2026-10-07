import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tv, Plus, Star, List, Edit3, Trash2, Loader2, Search, Film,
  BookOpen, Eye, EyeOff, Pin, PinOff, GripVertical, Youtube,
  X, Music, Lock, Ban, Save, ChevronRight, ChevronLeft, ChevronDown, Play
} from 'lucide-react';

interface VideoItem {
  id: string; title: string; description: string; youtube_url: string;
  youtube_id: string; platform?: string; category: string; program: string;
  program_name: string; tags: string[]; thumbnail: string; duration: string;
  is_active: boolean; is_featured: boolean; is_live: boolean; was_live: boolean; is_pinned: boolean;
  created_at: string;
}

interface Playlist {
  id: string; name: string; description: string; category_id: string;
  cover_image: string; is_active: boolean; item_count: number; created_at: string;
}

interface PlaylistItem {
  id: string; playlist_id: string; item_type: 'song' | 'video'; item_id: string;
  item_title: string; item_thumbnail: string; sort_order: number;
}

interface Category {
  id: string; name: string; description: string; cover_image: string;
  is_active: boolean; playlist_count: number;
}

interface LibraryTabProps {
  request: (url: string, options?: any) => Promise<any>;
  showSnackbar: (msg: string, type: 'success' | 'error' | 'info') => void;
  confirm: (opts: any) => Promise<boolean>;
  fetchAll: () => void;
  categories: Category[];
  playlists: Playlist[];
  videos: VideoItem[];
  selectedCategoryId: string | null;
  selectedPlaylistId: string | null;
  loading: boolean;
  editingId: string | null;
  addToPlaylistId: string;
  setSelectedCategoryId: (v: string | null) => void;
  setSelectedPlaylistId: (v: string | null) => void;
  setAddToPlaylistId: (v: string) => void;
  openCategoryForm: (item?: Category) => void;
  handleDeleteCategory: (id: string, name: string) => Promise<void>;
  openPlaylistForm: (item?: Playlist) => void;
  handleTogglePlaylistActive: (id: string, isActive: boolean) => Promise<void>;
  handleDeletePlaylist: (id: string, name: string) => Promise<void>;
  openVideoForm: (item?: VideoItem) => void;
  handleDeleteVideo: (videoId: string, title: string) => Promise<void>;
  handleToggleFeature: (video: VideoItem) => Promise<void>;
  handleTogglePin: (video: VideoItem) => Promise<void>;
}

const HARDCODED_CATEGORIES = [
  { id: 'meetings', label: 'اجتماعات' },
  { id: 'hymns', label: 'ترانيم مرئية' },
  { id: 'conferences', label: 'مؤتمرات' },
  { id: 'sermons', label: 'عظات وتأملات' },
  { id: 'archive', label: 'أرشيف' },
];

const DEFAULT_COVER = '/img/Radio5-14-Logo.jpg';

export function LibraryTab({
  request, showSnackbar, confirm, fetchAll,
  categories, playlists, videos, selectedCategoryId, selectedPlaylistId,
  loading, editingId, addToPlaylistId,
  setSelectedCategoryId, setSelectedPlaylistId, setAddToPlaylistId,
  openCategoryForm, handleDeleteCategory,
  openPlaylistForm, handleTogglePlaylistActive, handleDeletePlaylist,
  openVideoForm, handleDeleteVideo, handleToggleFeature, handleTogglePin,
}: LibraryTabProps) {
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [videoFilter, setVideoFilter] = useState('all');
  const [videoSearch, setVideoSearch] = useState('');
  const [playlistImportUrl, setPlaylistImportUrl] = useState('');
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [fetchedPlaylistItems, setFetchedPlaylistItems] = useState<any[] | null>(null);

  const fetchPlaylistItems = useCallback(async (playlistId: string) => {
    try {
      const res = await request(`/api/radio/playlists/${playlistId}/items`);
      if (res.success) setPlaylistItems(res.data || []);
    } catch { setPlaylistItems([]); }
  }, [request]);

  const handleDeletePlaylistItem = useCallback(async (itemId: string, itemTitle: string) => {
    const confirmed = await confirm({ message: `هل أنت متأكد من حذف "${itemTitle}" من هذه القائمة؟`, type: 'danger' });
    if (!confirmed) return;
    try {
      const res = await request(`/api/radio/playlists/${selectedPlaylistId}/items/${itemId}`, { method: 'DELETE' });
      if (res?.success) {
        showSnackbar(res.message || 'تم حذف الحلقة', 'success');
        if (selectedPlaylistId) fetchPlaylistItems(selectedPlaylistId);
      }
    } catch { showSnackbar('حصل خطأ فني. لو سمحت كرر المحاولة.', 'error'); }
  }, [request, selectedPlaylistId, fetchPlaylistItems, confirm, showSnackbar]);

  const handleFetchPlaylist = useCallback(async () => {
    if (!playlistImportUrl.trim()) { showSnackbar('يرجى إدخال رابط البلاي ليست', 'error'); return; }
    setImportingPlaylist(true);
    setFetchedPlaylistItems(null);
    try {
      const res = await request(`/api/radio/fetch-playlist?url=${encodeURIComponent(playlistImportUrl.trim())}`);
      if (res?.success && res.data?.length) {
        setFetchedPlaylistItems(res.data);
        showSnackbar(`تم جلب ${res.count} فيديو من البلاي ليست`, 'success');
      } else {
        showSnackbar(res?.message || 'لم يتم العثور على فيديوهات', 'error');
      }
    } catch { showSnackbar('فشل جلب البلاي ليست', 'error'); }
    setImportingPlaylist(false);
  }, [playlistImportUrl, request, showSnackbar]);

  const handleImportPlaylist = useCallback(async () => {
    if (!fetchedPlaylistItems?.length || !selectedPlaylistId) return;
    const confirmed = await confirm({ message: `هل أنت متأكد من إضافة ${fetchedPlaylistItems.length} فيديو إلى هذا البرنامج؟`, type: 'info' });
    if (!confirmed) return;
    setImportingPlaylist(true);
    try {
      const res = await request(`/api/radio/playlists/${selectedPlaylistId}/items/bulk`, {
        method: 'POST',
        body: JSON.stringify({ items: fetchedPlaylistItems }),
      });
      if (res?.success) {
        showSnackbar(`تم إضافة ${res.count} حلقة بنجاح`, 'success');
        setFetchedPlaylistItems(null);
        setPlaylistImportUrl('');
        if (selectedPlaylistId) fetchPlaylistItems(selectedPlaylistId);
        fetchAll();
      } else {
        showSnackbar(res?.message || 'حصل خطأ أثناء الإضافة', 'error');
      }
    } catch { showSnackbar('حصل خطأ أثناء الإضافة', 'error'); }
    setImportingPlaylist(false);
  }, [fetchedPlaylistItems, selectedPlaylistId, request, fetchPlaylistItems, fetchAll, confirm, showSnackbar]);

  useEffect(() => {
    if (selectedPlaylistId) fetchPlaylistItems(selectedPlaylistId);
    else setPlaylistItems([]);
  }, [selectedPlaylistId, fetchPlaylistItems]);

  const filteredPlaylists = selectedCategoryId
    ? playlists.filter(pl => pl.category_id === selectedCategoryId)
    : playlists;

  const [videoProgramFilter, setVideoProgramFilter] = useState('all');
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [showProgDropdown, setShowProgDropdown] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [progSearch, setProgSearch] = useState('');
  const catRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);

  const catNameToId = (catName: string) => {
    const userCat = categories.find(c => c.name === catName);
    if (userCat) return userCat.id;
    return HARDCODED_CATEGORIES.find(c => c.label === catName)?.id || catName;
  };

  const filteredVideos = videos.filter(v => {
    if (videoFilter !== 'all') {
      const catId = catNameToId(videoFilter);
      if (v.category !== catId && !v.tags?.includes(catId)) return false;
    }
    if (videoProgramFilter !== 'all' && v.program_name !== videoProgramFilter) return false;
    if (videoSearch.trim()) {
      const q = videoSearch.trim().toLowerCase();
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchDesc = v.description.toLowerCase().includes(q);
      const matchProg = v.program_name?.toLowerCase().includes(q);
      const matchCat = [...HARDCODED_CATEGORIES, ...categories.map(c => ({ id: c.id, label: c.name }))]
        .some(c => c.label.includes(q) && (v.category === c.id || v.tags?.includes(c.id)));
      if (!matchTitle && !matchDesc && !matchProg && !matchCat) return false;
    }
    return true;
  });

  const featuredVideos = videos.filter(v => v.is_featured);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatDropdown(false);
      if (progRef.current && !progRef.current.contains(e.target as Node)) setShowProgDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const catOptionMatches = (catName: string) =>
    !catSearch.trim() || catName.toLowerCase().includes(catSearch.trim().toLowerCase());

  const progOptionMatches = (progName: string) =>
    !progSearch.trim() || progName.toLowerCase().includes(progSearch.trim().toLowerCase());
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredAutoRef = useRef<any>(null);

  const startFeaturedAuto = useCallback(() => {
    if (featuredAutoRef.current) clearInterval(featuredAutoRef.current);
    featuredAutoRef.current = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % Math.max(featuredVideos.length, 1));
    }, 4500);
  }, [featuredVideos.length]);

  useEffect(() => {
    if (featuredVideos.length > 1) {
      startFeaturedAuto();
      return () => { if (featuredAutoRef.current) clearInterval(featuredAutoRef.current); };
    }
  }, [featuredVideos.length, startFeaturedAuto]);

  return (
    <motion.div key="library" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-lg">
              <Tv size={22} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">مكتبة الفيديو</h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">إدارة التصنيفات والبرامج والفيديوهات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openCategoryForm()}
              className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-1.5">
              <List size={14} /> تصنيف جديد
            </button>
            <button onClick={() => openVideoForm()}
              className="px-4 py-2 bg-gradient-to-br from-purple-600 to-vibrant-600 text-white rounded-lg text-[11px] font-bold shadow-md hover:shadow-purple-500/30 transition-all flex items-center gap-1.5">
              <Plus size={14} /> إضافة فيديو
            </button>
          </div>
        </div>
      </div>

      {/* Featured Slideshow Banner */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Star size={18} className="text-amber-500" />
            <span className="text-base font-black text-slate-900 dark:text-white">المادة المتميزة</span>
            <span className="text-[10px] font-bold text-slate-400">({featuredVideos.length} عناصر)</span>
          </div>
          {featuredVideos.length > 0 && (
            <p className="text-[9px] text-slate-400">معاينة السلايد شو الذي سيراه المستخدمون</p>
          )}
        </div>

        {featuredVideos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
            <Star size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">لا توجد عناصر مميزة</p>
            <p className="text-[10px] text-slate-400 mt-1">اضغط على النجمة ⭐ في أي فيديو لتعيينه كمادة متميزة</p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden shadow-lg" dir="ltr">
            <div className="relative aspect-[21/9] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
              <AnimatePresence mode="wait">
                <motion.div key={featuredVideos[featuredIndex]?.id || 'empty'}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0"
                >
                  {featuredVideos[featuredIndex]?.thumbnail || (featuredVideos[featuredIndex]?.platform !== 'facebook' && featuredVideos[featuredIndex]?.youtube_id) ? (
                    <img src={featuredVideos[featuredIndex].thumbnail || `https://img.youtube.com/vi/${featuredVideos[featuredIndex].youtube_id}/hqdefault.jpg`}
                      alt={featuredVideos[featuredIndex].title}
                      className="w-full h-full object-cover opacity-40"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 right-0 left-0 p-6" dir="rtl">
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={14} className="text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-400">مميز</span>
                      <span className="text-[9px] text-white/40 mx-1">|</span>
                      <span className="text-[9px] text-white/50">{featuredVideos[featuredIndex]?.program_name || 'فيديو'}</span>
                    </div>
                    <h3 className="text-xl font-black text-white mb-1">{featuredVideos[featuredIndex]?.title}</h3>
                    <p className="text-xs text-white/60 line-clamp-1 max-w-xl">{featuredVideos[featuredIndex]?.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                        <Play size={12} fill="white" /> تشغيل
                      </span>
                      <button onClick={() => handleToggleFeature(featuredVideos[featuredIndex])}
                        className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 backdrop-blur-sm text-white rounded-lg text-[10px] font-bold transition-all">
                        إزالة التميز
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {featuredVideos.length > 1 && (
                <>
                  <button onClick={() => { setFeaturedIndex(prev => (prev - 1 + featuredVideos.length) % featuredVideos.length); startFeaturedAuto(); }}
                    className="absolute top-1/2 -translate-y-1/2 left-3 z-10 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full transition-all">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => { setFeaturedIndex(prev => (prev + 1) % featuredVideos.length); startFeaturedAuto(); }}
                    className="absolute top-1/2 -translate-y-1/2 right-3 z-10 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full transition-all">
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {featuredVideos.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-white/5" dir="rtl">
                {featuredVideos.map((_, idx) => (
                  <button key={idx} onClick={() => { setFeaturedIndex(idx); startFeaturedAuto(); }}
                    className={`w-2 h-2 rounded-full transition-all ${idx === featuredIndex ? 'bg-amber-500 w-5' : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
              <List size={16} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">التصنيفات</h4>
          </div>
          <button onClick={() => openCategoryForm()}
            className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 px-2.5 py-1 rounded-lg transition-all">
            + إضافة
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-4">لا توجد تصنيفات — أضف تصنيفاً جديداً</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition-all ${
                  selectedCategoryId === cat.id
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-primary-50 dark:hover:bg-primary-500/10'
                }`}>
                <span>{cat.name}</span>
                <span className={`text-[9px] ${selectedCategoryId === cat.id ? 'text-white/60' : 'text-slate-400'}`}>{cat.playlist_count || 0}</span>
                <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                  <span onClick={(e) => { e.stopPropagation(); openCategoryForm(cat); }}
                    className={`p-0.5 rounded ${selectedCategoryId === cat.id ? 'hover:bg-white/20' : 'hover:bg-primary-100 dark:hover:bg-white/10'}`}>
                    <Edit3 size={10} />
                  </span>
                  <span onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                    className={`p-0.5 rounded ${selectedCategoryId === cat.id ? 'hover:bg-white/20' : 'hover:bg-red-100 dark:hover:bg-red-500/20'}`}>
                    <Trash2 size={10} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Programs */}
      {selectedCategoryId && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <BookOpen size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {categories.find(c => c.id === selectedCategoryId)?.name} — البرامج
              </h4>
            </div>
            <button onClick={() => openPlaylistForm()}
              className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1">
              <Plus size={12} /> إضافة برنامج
            </button>
          </div>
          {filteredPlaylists.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-4">لا توجد برامج في هذا التصنيف</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredPlaylists.map(pl => (
                <button key={pl.id} onClick={() => setSelectedPlaylistId(selectedPlaylistId === pl.id ? null : pl.id)}
                  className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition-all ${
                    selectedPlaylistId === pl.id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                  }`}>
                  <span>{pl.name}</span>
                  <span className={`text-[9px] ${selectedPlaylistId === pl.id ? 'text-white/60' : 'text-slate-400'}`}>{pl.item_count || 0}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                    <span onClick={(e) => { e.stopPropagation(); handleTogglePlaylistActive(pl.id, pl.is_active); }}
                      className={`p-0.5 rounded ${selectedPlaylistId === pl.id ? 'hover:bg-white/20' : 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20'}`}>
                      {pl.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                    </span>
                    <span onClick={(e) => { e.stopPropagation(); openPlaylistForm(pl); }}
                      className={`p-0.5 rounded ${selectedPlaylistId === pl.id ? 'hover:bg-white/20' : 'hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}>
                      <Edit3 size={10} />
                    </span>
                    <span onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id, pl.name); }}
                      className={`p-0.5 rounded ${selectedPlaylistId === pl.id ? 'hover:bg-white/20' : 'hover:bg-red-100 dark:hover:bg-red-500/20'}`}>
                      <Trash2 size={10} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Episodes */}
      {selectedPlaylistId && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
              <Film size={16} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              حلقات — {playlists.find(p => p.id === selectedPlaylistId)?.name}
            </h4>
            <span className="text-[10px] text-slate-400 mr-auto">{playlistItems.length} حلقة</span>
          </div>
          {playlistItems.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-4">لا توجد حلقات</p>
          ) : (
            <div className="space-y-1.5">
              {playlistItems.sort((a, b) => a.sort_order - b.sort_order).map((item, idx) => (
                <div key={item.id} draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={async e => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId === item.id) return;
                    const sorted = [...playlistItems].sort((a, b) => a.sort_order - b.sort_order);
                    const draggedIdx = sorted.findIndex(i => i.id === draggedId);
                    const targetIdx = sorted.findIndex(i => i.id === item.id);
                    if (draggedIdx === -1 || targetIdx === -1) return;
                    const [removed] = sorted.splice(draggedIdx, 1);
                    sorted.splice(targetIdx, 0, removed);
                    const updates = sorted.map((i, n) => ({ id: i.id, sort_order: n }));
                    setPlaylistItems(prev => prev.map(i => ({ ...i, sort_order: updates.find(u => u.id === i.id)?.sort_order ?? i.sort_order })));
                    await request(`/api/radio/playlists/${selectedPlaylistId}/reorder`, {
                      method: 'POST',
                      body: JSON.stringify({ items: updates }),
                    });
                    fetchAll();
                  }}
                  className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all group cursor-grab active:cursor-grabbing">
                  <GripVertical size={12} className="shrink-0 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                  <div className="w-10 h-7 rounded overflow-hidden bg-slate-100 dark:bg-slate-800/50 shrink-0">
                    {item.item_thumbnail && <img src={item.item_thumbnail} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <p className="flex-1 text-xs font-bold text-slate-900 dark:text-white truncate">{item.item_title}</p>
                  <button onClick={() => handleDeletePlaylistItem(item.id, item.item_title)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* YouTube Playlist Import */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1 bg-red-50 dark:bg-red-500/10 rounded-lg">
                <Youtube size={14} className="text-red-500" />
              </div>
              <h5 className="text-[11px] font-black text-slate-900 dark:text-white">استيراد من بلاي ليست يوتيوب</h5>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={playlistImportUrl} onChange={e => setPlaylistImportUrl(e.target.value)} placeholder="https://youtube.com/playlist?list=..."
                className="flex-1 px-3 py-2 text-[11px] bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/30 transition-all" />
              <button onClick={handleFetchPlaylist} disabled={importingPlaylist || !playlistImportUrl.trim()}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5">
                {importingPlaylist ? <Loader2 size={12} className="animate-spin" /> : <Youtube size={12} />}
                جلب
              </button>
            </div>
            {fetchedPlaylistItems && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-white/[0.03] rounded-lg border border-slate-100 dark:border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{fetchedPlaylistItems.length} فيديو</p>
                  <button onClick={handleImportPlaylist} disabled={importingPlaylist}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5">
                    {importingPlaylist ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    إضافة الكل إلى البرنامج
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {fetchedPlaylistItems.slice(0, 20).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-white dark:bg-white/[0.03] rounded">
                      <div className="w-8 h-6 rounded overflow-hidden bg-slate-100 dark:bg-slate-800/50 shrink-0">
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate flex-1">{item.title}</p>
                    </div>
                  ))}
                  {fetchedPlaylistItems.length > 20 && (
                    <p className="text-[9px] text-slate-400 text-center pt-1">و {fetchedPlaylistItems.length - 20} فيديوهات أخرى...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Videos */}
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-100 dark:bg-white/[0.05] rounded-lg">
              <Film size={16} className="text-slate-600 dark:text-slate-400" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">جميع الفيديوهات</h4>
            <span className="text-[10px] text-slate-400">{videos.length} فيديو</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={videoSearch} onChange={e => setVideoSearch(e.target.value)}
                placeholder="ابحث عن فيديو..."
                className="w-36 pr-7 pl-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[11px] font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary-500/30 transition-all" />
            </div>

            {/* Category dropdown with search */}
            <div className="relative" ref={catRef}>
              <button onClick={() => { setShowCatDropdown(!showCatDropdown); setCatSearch(''); }}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[11px] font-bold transition-all ${
                  videoFilter !== 'all'
                    ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-300 dark:border-primary-500/30 text-primary-700 dark:text-primary-400'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                {videoFilter !== 'all' ? videoFilter : 'كل التصنيفات'}
                <ChevronDown size={12} />
              </button>
              {videoFilter !== 'all' && (
                <button onClick={() => setVideoFilter('all')}
                  className="mr-1 p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-500/10">
                  <X size={12} />
                </button>
              )}
              {showCatDropdown && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
                  <div className="p-2 border-b border-slate-100 dark:border-white/10">
                    <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="ابحث عن تصنيف..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400" autoFocus />
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {categories.filter(c => catOptionMatches(c.name)).length === 0 ? (
                      <p className="px-3 py-4 text-[10px] text-slate-400 text-center">لا توجد نتائج</p>
                    ) : (
                      categories.filter(c => catOptionMatches(c.name)).map(cat => (
                        <button key={cat.id} onClick={() => { setVideoFilter(cat.name); setShowCatDropdown(false); }}
                          className={`w-full text-right px-3 py-2 text-[11px] font-bold hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all flex items-center gap-2 ${
                            videoFilter === cat.name ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'
                          }`}>
                          {videoFilter === cat.name && <ChevronLeft size={10} className="shrink-0" />}
                          {cat.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Program dropdown with search */}
            <div className="relative" ref={progRef}>
              <button onClick={() => { setShowProgDropdown(!showProgDropdown); setProgSearch(''); }}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[11px] font-bold transition-all ${
                  videoProgramFilter !== 'all'
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                {videoProgramFilter !== 'all' ? videoProgramFilter : 'كل البرامج'}
                <ChevronDown size={12} />
              </button>
              {videoProgramFilter !== 'all' && (
                <button onClick={() => setVideoProgramFilter('all')}
                  className="mr-1 p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-500/10">
                  <X size={12} />
                </button>
              )}
              {showProgDropdown && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
                  <div className="p-2 border-b border-slate-100 dark:border-white/10">
                    <input type="text" value={progSearch} onChange={e => setProgSearch(e.target.value)} placeholder="ابحث عن برنامج..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400" autoFocus />
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {playlists.filter(pl => progOptionMatches(pl.name)).length === 0 ? (
                      <p className="px-3 py-4 text-[10px] text-slate-400 text-center">لا توجد نتائج</p>
                    ) : (
                      playlists.filter(pl => progOptionMatches(pl.name)).map(pl => (
                        <button key={pl.id} onClick={() => { setVideoProgramFilter(pl.name); setShowProgDropdown(false); }}
                          className={`w-full text-right px-3 py-2 text-[11px] font-bold hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all flex items-center gap-2 ${
                            videoProgramFilter === pl.name ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                          }`}>
                          {videoProgramFilter === pl.name && <ChevronLeft size={10} className="shrink-0" />}
                          <span className="flex-1">{pl.name}</span>
                          <span className="text-[8px] text-slate-400">{pl.item_count || 0}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-slate-50 dark:bg-white/[0.03] rounded-xl overflow-hidden animate-pulse border border-slate-100 dark:border-white/[0.05]">
                <div className="aspect-video bg-slate-200 dark:bg-slate-700/30" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700/30 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-700/30 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="py-10 text-center">
            <Film size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-400">لا توجد فيديوهات</p>
            <p className="text-[10px] text-slate-500 mt-1">أضف أول فيديو من زر "إضافة فيديو"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredVideos.map(v => (
              <div key={v.id} className={`bg-white dark:bg-card-dark border rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all ${
                v.is_pinned ? 'border-amber-400/50' : 'border-slate-100 dark:border-white/[0.05]'
              }`}>
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
                  {v.thumbnail || v.platform !== 'facebook' ? (
                    <img src={v.thumbnail || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                      alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/30">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-500/60"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                  )}
                  {v.is_pinned && <div className="absolute top-2 left-2 p-1 bg-amber-500/90 backdrop-blur-sm rounded"><Pin size={10} className="text-white" /></div>}
                  {v.is_featured && <div className="absolute top-2 right-2 p-1 bg-amber-500/90 backdrop-blur-sm rounded"><Star size={10} className="text-white" /></div>}
                  {v.duration && <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold rounded border border-white/10">{v.duration}</span>}
                </div>
                <div className="p-3 space-y-1.5">
                  <h5 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">{v.title}</h5>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{v.description}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {v.program_name && (
                      <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded text-[8px] font-bold">
                        {v.program_name}
                      </span>
                    )}
                    {v.tags?.length ? v.tags.map((tagId: string) => {
                      const hardCat = HARDCODED_CATEGORIES.find(c => c.id === tagId);
                      if (hardCat) return (
                        <span key={tagId} className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded text-[8px] font-bold">
                          {hardCat.label}
                        </span>
                      );
                      const userCat = categories.find(c => c.id === tagId);
                      if (userCat) return (
                        <span key={tagId} className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded text-[8px] font-bold">
                          {userCat.name}
                        </span>
                      );
                      return null;
                    }) : v.category ? (
                      <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded text-[8px] font-bold">
                        {HARDCODED_CATEGORIES.find(c => c.id === v.category)?.label || v.category}
                      </span>
                    ) : !v.program_name ? (
                      <span className="px-1.5 py-0.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded text-[8px] font-bold text-slate-400">بدون تصنيف</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 dark:border-white/10">
                    <button onClick={() => handleToggleFeature(v)}
                      className={`p-1 rounded transition-all ${v.is_featured ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                      <Star size={12} fill={v.is_featured ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => handleTogglePin(v)}
                      className={`p-1 rounded transition-all ${v.is_pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                      {v.is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    <button onClick={() => openVideoForm(v)}
                      className="p-1 text-slate-400 hover:text-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDeleteVideo(v.id, v.title)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                      <Trash2 size={12} />
                    </button>
                    <span className={`mr-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${v.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-50 dark:bg-white/[0.03] text-slate-400'}`}>
                      {v.is_active ? 'ظاهر' : 'مخفي'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
