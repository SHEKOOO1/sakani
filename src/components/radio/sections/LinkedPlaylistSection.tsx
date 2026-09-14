import { List, Play } from 'lucide-react';
import { VideoItem, Playlist, PlaylistItem } from '../types';

interface LinkedPlaylistSectionProps {
  linkedBroadcast: any;
  linkedBroadcastItems: PlaylistItem[];
  playlists: Playlist[];
  videos: VideoItem[];
  onOpenVideo: (video: VideoItem) => void;
}

export function LinkedPlaylistSection({ linkedBroadcast, linkedBroadcastItems, playlists, videos, onOpenVideo }: LinkedPlaylistSectionProps) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-100 dark:border-white/[0.05] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <List size={16} className="text-primary-500" />
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          {playlists.find(p => p.id === linkedBroadcast.playlist_id)?.name || 'قائمة تشغيل'} — {linkedBroadcast.title}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {linkedBroadcastItems.sort((a: PlaylistItem, b: PlaylistItem) => a.sort_order - b.sort_order).map(item => (
          <button key={item.id} onClick={() => {
            const video = videos.find(v => v.id === item.item_id || v.youtube_id === item.item_id);
            if (video) onOpenVideo(video);
          }}
            className="group flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all text-right">
            <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
              {item.item_thumbnail && (
                <img src={item.item_thumbnail} alt={item.item_title} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-900 dark:text-white line-clamp-1">{item.item_title}</p>
            </div>
            <Play size={14} className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
