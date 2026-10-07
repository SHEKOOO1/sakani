import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, Link2, Image, Video, File, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TICKER_SPEED_FACTOR = 0.12;

interface LinkAction {
  type: 'live' | 'video' | 'program';
  id?: string;
  url?: string;
  title?: string;
}

export function BroadcastTicker() {
  const { request } = useApi();
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef(0);
  const lastTimeRef = useRef(0);
  const copyWidthRef = useRef(0);
  const [numCopies, setNumCopies] = useState(2);

  const fetchTicker = useCallback(async () => {
    try {
      const res = await request('/api/broadcasts/ticker');
      if (res?.data) setBroadcasts(Array.isArray(res.data) ? res.data : [res.data]);
    } catch {}
  }, [request]);

  useEffect(() => {
    if (isLoading) return;
    fetchTicker();
    const interval = setInterval(() => fetchTicker(), 60000);
    return () => clearInterval(interval);
  }, [fetchTicker, isLoading]);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.on('broadcast-visibility-changed', (data: any) => {
      if (data.visible_in_ticker === 0) {
        setBroadcasts(prev => prev.filter(b => b.id !== data.id));
      }
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (!broadcasts.length || !trackRef.current) return;
    const firstCopy = trackRef.current.children[0] as HTMLElement | undefined;
    if (!firstCopy) return;
    const vw = wrapperRef.current?.clientWidth || 1200;
    const cw = firstCopy.scrollWidth;
    if (cw <= 0) return;
    copyWidthRef.current = cw;
    const needed = Math.ceil(vw / cw) + 1;
    setNumCopies(Math.max(2, Math.min(needed, 20)));
  }, [broadcasts]);

  useEffect(() => {
    if (!broadcasts.length || copyWidthRef.current <= 0) return;
    const cw = copyWidthRef.current;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      const vw = wrapperRef.current?.clientWidth || 1200;
      const speed = Math.min(vw * TICKER_SPEED_FACTOR, 55);
      posRef.current += speed * dt;
      if (posRef.current >= cw) posRef.current -= cw;
      if (trackRef.current) trackRef.current.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(animate);
    };

    posRef.current = 0;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); lastTimeRef.current = 0; };
  }, [broadcasts, numCopies]);

  const handleBroadcastClick = (b: any) => {
    let action: LinkAction | null = null;
    try {
      action = b.link_action ? (typeof b.link_action === 'string' ? JSON.parse(b.link_action) : b.link_action) : null;
    } catch {}
    if (action && action.type === 'live') {
      navigate('/radio', { state: { autoPlayLive: true } });
      return;
    }
    if (action && action.type === 'program' && action.id) {
      navigate('/radio', { state: { openProgramId: action.id } });
      return;
    }
    if (action && action.type === 'video' && action.url) {
      window.open(action.url, '_blank', 'noopener');
      return;
    }
    const text = `${b.title || ''} ${b.content || ''}`.toLowerCase();
    if (text.includes('بث مباشر') || text.includes('راديو') || text.includes('live') || text.includes('راديو 5:14')) {
      navigate('/radio', { state: { autoPlayLive: true } });
      return;
    }
    setSelected(b);
  };

  if (broadcasts.length === 0) return null;

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    normal: 'bg-neon-primary/10 text-neon-primary border-neon-primary/20',
  };

  const typeIcons: Record<string, any> = {
    image: Image, video: Video, voice: Volume2, file: File, link: Link2,
  };

  return (
    <>
      <div className="bg-white dark:bg-card-dark rounded-card border border-slate-100 dark:border-white/[0.05] overflow-hidden mb-6">
        <div className="flex items-center bg-gradient-to-l from-neon-primary/10 to-transparent">
          <div className="px-4 py-3 text-neon-primary font-bold text-sm whitespace-nowrap border-l border-slate-100 dark:border-white/[0.05]">
            أخبار عاجلة
          </div>
          <div ref={wrapperRef} className="flex-1 overflow-hidden py-2 px-4">
            <div
              ref={trackRef}
              className="flex whitespace-nowrap"
              style={{ willChange: 'transform' }}
            >
              {Array.from({ length: Math.max(numCopies, 2) }, (_, copyIdx) => (
                <div key={copyIdx} className="flex">
                  {broadcasts.map((b) => (
                    <React.Fragment key={`${b.id}-c${copyIdx}`}>
                      <button
                        onClick={() => handleBroadcastClick(b)}
                        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-neon-primary transition-colors cursor-pointer shrink-0"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          b.priority === 'urgent' ? 'bg-red-500' : b.priority === 'important' ? 'bg-amber-500' : 'bg-neon-primary'
                        }`} />
                        {b.title}
                      </button>
                      <span className="text-neon-primary mx-3 text-lg leading-none shrink-0">★</span>
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-card-dark rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                priorityColors[selected.priority] || priorityColors.normal
              }`}>
                {selected.priority === 'urgent' ? 'عاجل' : selected.priority === 'important' ? 'مهم' : 'عادي'}
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{selected.title}</h3>
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {selected.sender_name} • {selected.created_at ? new Date(selected.created_at).toLocaleDateString('ar-SA') : ''}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
            {selected.attachments?.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">المرفقات</div>
                {selected.attachments.map((att: any) => {
                  const Icon = typeIcons[att.type] || File;
                  return (
                    <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/5 text-sm text-neon-primary hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                      <Icon size={16} />
                      <span className="truncate">{att.original_name}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
