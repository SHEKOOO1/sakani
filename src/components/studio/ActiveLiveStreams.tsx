import { StopCircle } from 'lucide-react';

interface ActiveLiveStreamsProps {
  liveVideos: any[];
  onEndLive: (video: any) => void;
}

export function ActiveLiveStreams({ liveVideos, onEndLive }: ActiveLiveStreamsProps) {
  if (liveVideos.length === 0) return null;
  return (
    <div className="bg-gradient-to-br from-red-500/5 via-transparent to-purple-500/5 rounded-xl border border-red-500/10 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <h4 className="text-sm font-black text-slate-900 dark:text-white">بثوث مرئية نشطة</h4>
        <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-lg">{liveVideos.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {liveVideos.map(v => (
          <div key={v.id} className="relative bg-white dark:bg-card-dark border-2 border-red-500/20 rounded-xl overflow-hidden group shadow-sm">
            <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative">
              {v.thumbnail || v.platform !== 'facebook' ? (
                <img src={v.thumbnail || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/30">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-500/60"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
              )}
              <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-600/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg flex items-center gap-1.5 border border-red-400/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                مباشر
              </div>
              {v.platform === 'facebook' && (
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[8px] font-bold rounded-lg border border-blue-400/30 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  فيسبوك
                </div>
              )}
              <button onClick={() => onEndLive(v)}
                className="absolute bottom-3 left-3 px-2.5 py-1.5 bg-red-600/90 hover:bg-red-700 backdrop-blur-sm text-white text-[8px] font-bold rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5 border border-red-400/30">
                <StopCircle size={12} />
                إنهاء البث
              </button>
            </div>
            <div className="p-4">
              <h5 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{v.title}</h5>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
