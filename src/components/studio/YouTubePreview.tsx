import { useState, useEffect, useRef } from 'react';
import { Tv, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiLoaded = false;
function ensureYtApi(cb: () => void) {
  if (window.YT?.Player) { cb(); return; }
  if (ytApiLoaded) { window.onYouTubeIframeAPIReady = cb; return; }
  ytApiLoaded = true;
  window.onYouTubeIframeAPIReady = cb;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

interface YouTubePreviewProps {
  youtubeId: string;
  label: string;
}

export function YouTubePreview({ youtubeId, label }: YouTubePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerId = useRef(`yt-preview-${Math.random().toString(36).slice(2, 8)}`);
  const [ready, setReady] = useState(false);
  const lastId = useRef('');

  useEffect(() => {
    if (!youtubeId) { setReady(false); return; }
    if (youtubeId === lastId.current) return;
    lastId.current = youtubeId;

    if (playerRef.current && playerRef.current.loadVideoById) {
      try { playerRef.current.loadVideoById(youtubeId); setReady(true); } catch { setReady(false); }
      return;
    }

    ensureYtApi(() => {
      try {
        playerRef.current = new window.YT.Player(playerId.current, {
          videoId: youtubeId,
          host: 'https://www.youtube.com',
          playerVars: { rel: 0, autoplay: 1, controls: 1, modestbranding: 1 },
          events: {
            onReady: () => setReady(true),
            onError: () => setReady(false),
          },
        });
      } catch { setReady(false); }
    });
  }, [youtubeId]);

  useEffect(() => () => {
    try { if (playerRef.current && playerRef.current.destroy) playerRef.current.destroy(); } catch {}
    playerRef.current = null;
  }, []);

  const hasVideo = !!youtubeId;

  return (
    <div ref={containerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg group">
      <div id={playerId.current} className={`w-full h-full ${hasVideo ? '' : 'invisible absolute'}`} />
      {!hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <Tv size={48} className="mx-auto text-slate-700 mb-3" />
            <p className="text-sm font-bold text-slate-500">أدخل رابط البث لمعاينته</p>
          </div>
        </div>
      ) : (
        !ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={32} className="animate-spin text-white/50" />
          </div>
        )
      )}
      <div className="absolute top-3 right-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold rounded-lg border border-white/10 z-10">
        {label}
      </div>
      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-amber-400 text-[9px] font-bold rounded-lg border border-amber-500/30 z-10">
        معاينة الإدارة - البث غير نشط للمستمعين حالياً
      </div>
    </div>
  );
}
