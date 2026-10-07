import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

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

let fbSdkLoading = false;
const fbSdkCallbacks: (() => void)[] = [];
let fbSdkFailed = false;

function ensureFbSdk(callback: () => void) {
  if (typeof (window as any).FB !== 'undefined' && (window as any).FB.XFBML) {
    callback();
    return;
  }
  if (fbSdkFailed) { setTimeout(callback, 0); return; }
  fbSdkCallbacks.push(callback);
  if (fbSdkLoading) return;
  fbSdkLoading = true;

  let fbRoot = document.getElementById('fb-root');
  if (!fbRoot) {
    fbRoot = document.createElement('div');
    fbRoot.id = 'fb-root';
    document.body.appendChild(fbRoot);
  }

  const existingInit = (window as any).fbAsyncInit;
  (window as any).fbAsyncInit = function () {
    try { if (existingInit) existingInit(); } catch {}
    fbSdkLoading = false;
    const cbs = fbSdkCallbacks.splice(0);
    cbs.forEach(cb => setTimeout(cb, 300));
  };

  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://connect.facebook.net/ar_AR/sdk.js#xfbml=1&version=v22.0';
  script.onerror = () => {
    fbSdkLoading = false;
    fbSdkFailed = true;
    const cbs = fbSdkCallbacks.splice(0);
    cbs.forEach(cb => setTimeout(cb, 0));
  };
  document.body.appendChild(script);
}

export function YouTubePlayer({ youtubeId, onError: onErrorProp }: { youtubeId: string; onError?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onErrorRef = useRef(onErrorProp);
  onErrorRef.current = onErrorProp;
  const playerId = useRef(`yt-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (!youtubeId) return;
    const el = document.getElementById(playerId);
    if (!el) return;

    let destroyed = false;
    ensureYtApi(() => {
      if (destroyed) return;
      if (playerRef.current) {
        playerRef.current.loadVideoById(youtubeId);
        return;
      }
      try {
        playerRef.current = new window.YT.Player(playerId, {
          videoId: youtubeId,
          playerVars: { rel: 0, autoplay: 1, origin: window.location.origin },
          events: {
            onError: () => { if (!destroyed) { playerRef.current?.destroy(); playerRef.current = null; onErrorRef.current?.(); } },
          },
        });
      } catch { onErrorRef.current?.(); }
    });

    return () => { destroyed = true; playerRef.current?.destroy(); playerRef.current = null; };
  }, [youtubeId]);

  return (
    <div ref={containerRef} className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
      <div id={playerId} className="w-full h-full" />
    </div>
  );
}

export function FacebookPlayer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setReady(false);
    setFallback(false);
    const timeout = setTimeout(() => { if (mountedRef.current) setFallback(true); }, 5000);
    ensureFbSdk(() => { if (mountedRef.current) { setReady(true); clearTimeout(timeout); } });
    return () => { mountedRef.current = false; clearTimeout(timeout); };
  }, [url]);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        if (typeof (window as any).FB?.XFBML?.parse === 'function') {
          (window as any).FB.XFBML.parse(containerRef.current);
        }
      } catch {}
    }, 800);
    return () => clearTimeout(timer);
  }, [url, ready]);

  if (fallback) {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
        <iframe
          src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=734`}
          className="w-full h-full"
          style={{ border: 'none', overflow: 'hidden' }}
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg flex items-center justify-center relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <Loader2 size={32} className="animate-spin text-white/50" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: ready ? 'auto' : '100%' }}>
        <div className="fb-video" data-href={url} data-width="auto" data-show-text="false" data-autoplay="true" />
      </div>
    </div>
  );
}

export function VideoPlayer({ platform, youtubeId, facebookUrl, onError }: { platform?: string; youtubeId?: string; facebookUrl?: string; onError?: () => void }) {
  if (platform === 'facebook' && facebookUrl) {
    return <FacebookPlayer url={facebookUrl} />;
  }
  if (youtubeId) {
    return <YouTubePlayer key={youtubeId} youtubeId={youtubeId} onError={onError} />;
  }
  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg flex items-center justify-center">
      <p className="text-white/50 text-sm">لا يمكن تشغيل هذا الفيديو</p>
    </div>
  );
}
