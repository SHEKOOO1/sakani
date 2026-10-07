import { Film, Search, RefreshCw, EyeOff, Trash2 } from 'lucide-react';

interface ArchiveBrowserProps {
  archiveVideos: any[];
  archiveSearch: string;
  onArchiveSearchChange: (value: string) => void;
  onRebroadcast: (video: any) => void;
  onToggleActive: (video: any) => void;
  onDelete: (video: any) => void;
  wasLiveIds: Set<string>;
}

export function ArchiveBrowser({
  archiveVideos, archiveSearch, onArchiveSearchChange,
  onRebroadcast, onToggleActive, onDelete, wasLiveIds
}: ArchiveBrowserProps) {
  if (archiveVideos.length === 0) return null;

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-100 dark:bg-white/[0.05] rounded-lg">
          <Film size={18} className="text-slate-500" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">أرشيف البثوث المرئية</h3>
          <p className="text-[9px] text-slate-500 font-bold mt-0.5">البثوث السابقة — اختر للإعادة والبث مجدداً</p>
        </div>
        <div className="mr-auto relative w-48">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={archiveSearch} onChange={e => onArchiveSearchChange(e.target.value)}
            placeholder="ابحث..."
            className="w-full pr-8 pl-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-[11px] font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500/30 transition-all" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto custom-scrollbar">
        {(archiveSearch.trim() ? archiveVideos.filter((v: any) => v.title.toLowerCase().includes(archiveSearch.toLowerCase())) : archiveVideos).slice().sort((a: any, b: any) => Number(b.is_active) - Number(a.is_active)).map((v: any) => (
          <div key={v.id} className={`group text-right rounded-xl overflow-hidden border ${v.is_active ? 'border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:border-primary-500/30 hover:shadow-md' : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/[0.01] opacity-50'} transition-all relative`}>
            <button onClick={() => onRebroadcast(v)} className="w-full text-right">
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { if (v.platform !== 'facebook') (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`; }} />
                ) : v.platform === 'facebook' ? (
                  <div className="w-full h-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-500"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                    <Film size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/90 dark:bg-black/70 rounded-lg">
                    <RefreshCw size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                {v.platform === 'facebook' ? (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[7px] font-bold rounded z-10 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    فيسبوك
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-600/90 backdrop-blur-sm text-white text-[7px] font-bold rounded z-10 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    يوتيوب
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 line-clamp-2">{v.title}</p>
                {v.duration && (
                  <p className="text-[8px] text-slate-400 mt-0.5 font-mono" dir="ltr">{v.duration}</p>
                )}
              </div>
            </button>
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={(e) => { e.stopPropagation(); onRebroadcast(v); }}
                className="p-1.5 bg-primary-600/90 hover:bg-primary-700 backdrop-blur-sm text-white rounded-lg transition-all"
                title="إعادة البث">
                <RefreshCw size={12} />
              </button>
              <button onClick={async (e) => { e.stopPropagation(); onToggleActive(v); }}
                className="p-1.5 bg-amber-600/90 hover:bg-amber-700 backdrop-blur-sm text-white rounded-lg transition-all"
                title={v.is_active ? 'إخفاء' : 'إظهار'}>
                <EyeOff size={12} />
              </button>
              <button onClick={async (e) => { e.stopPropagation(); onDelete(v); }}
                className="p-1.5 bg-red-600/90 hover:bg-red-700 backdrop-blur-sm text-white rounded-lg transition-all"
                title="حذف">
                <Trash2 size={12} />
              </button>
            </div>
            {!v.is_active && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-slate-800/80 backdrop-blur-sm text-white text-[7px] font-bold rounded z-10">
                مخفي
              </div>
            )}
            {wasLiveIds.has(v.id) && !v.is_active ? (
              <div className="absolute top-7 right-2 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur-sm text-white text-[7px] font-bold rounded z-10">
                بث سابق
              </div>
            ) : wasLiveIds.has(v.id) ? (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur-sm text-white text-[7px] font-bold rounded z-10">
                بث سابق
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
