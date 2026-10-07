import { useState, useCallback, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { CurrentTrack, SongHistoryItem, DEFAULT_STREAM_URL } from './types';

let globalAudio: HTMLAudioElement | null = null;

export function useRadioAudio(showSnackbar: (message: string, type?: any) => void) {
  const { request } = useApi();
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [songHistory, setSongHistory] = useState<SongHistoryItem[]>([]);
  const [playing, setPlaying] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getStreamUrl = () => currentTrack?.stream_url || DEFAULT_STREAM_URL;

  const stopAudio = useCallback(() => {
    try {
      if (globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
      }
    } catch { }
    globalAudio = null;
    audioRef.current = null;
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const url = getStreamUrl();
    try {
      if (!globalAudio || globalAudio.ended) {
        globalAudio = new Audio(url);
        audioRef.current = globalAudio;
        globalAudio.play().then(() => setPlaying(true)).catch(() => {
          setPlaying(false);
          showSnackbar('تعذر تشغيل البث', 'error');
        });
      } else if (globalAudio.paused) {
        if (globalAudio.src !== url) globalAudio.src = url;
        globalAudio.play().then(() => setPlaying(true)).catch(() => {
          setPlaying(false);
          showSnackbar('تعذر تشغيل البث', 'error');
        });
      } else {
        globalAudio.pause();
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
      showSnackbar('حدث خطأ في تشغيل البث', 'error');
    }
  }, [currentTrack, showSnackbar]);

  const fetchCurrentTrack = useCallback(async () => {
    try {
      const [dbRes, rjRes] = await Promise.all([
        request('/api/radio/current-track').catch(() => ({ success: false, data: null })),
        request('/api/radio/radiojar/now-playing').catch(() => ({ success: false, data: null })),
      ]);
      if (rjRes.success && rjRes.data) {
        const dbData = dbRes.success ? dbRes.data : null;
        const cover = rjRes.data.thumb || dbData?.cover_url || currentTrack?.cover_url || '';
        const trackId = dbData?.id || currentTrack?.id || '';
        setCurrentTrack({
          id: trackId,
          title: rjRes.data.title || dbData?.title || '',
          artist: rjRes.data.artist || dbData?.artist || '',
          cover_url: cover,
          description: dbData?.description || '',
          stream_url: dbData?.stream_url || DEFAULT_STREAM_URL,
          started_at: dbData?.started_at || '',
          listeners: dbData?.listeners || 0,
          likes: dbData?.likes || 0,
          liked_by_me: dbData?.liked_by_me || false,
        });
        if (trackId && dbData) {
          setLikeCounts(prev => ({ ...prev, [trackId]: dbData.likes || 0 }));
          setLikedByMe(prev => ({ ...prev, [trackId]: !!dbData.liked_by_me }));
        }
      } else if (dbRes.success && dbRes.data) {
        const dbData = dbRes.data;
        setCurrentTrack({ ...dbData, cover_url: dbData.cover_url || currentTrack?.cover_url || '', likes: dbData.likes || 0, liked_by_me: dbData.liked_by_me || false });
        if (dbData.id) {
          setLikeCounts(prev => ({ ...prev, [dbData.id]: dbData.likes || 0 }));
          setLikedByMe(prev => ({ ...prev, [dbData.id]: !!dbData.liked_by_me }));
        }
      }
    } catch { }
  }, [request]);

  const fetchSongHistory = useCallback(async () => {
    try {
      const res = await request('/api/radio/song-history');
      if (res.success) {
        const items: SongHistoryItem[] = res.data || [];
        setSongHistory(items);
        const counts: Record<string, number> = {};
        const liked: Record<string, boolean> = {};
        items.forEach(i => { counts[i.id] = i.likes; liked[i.id] = i.liked_by_me; });
        setLikeCounts(counts);
        setLikedByMe(liked);
      }
    } catch { }
  }, [request]);

  const handleLike = useCallback(async (songId: string) => {
    if (likingId === songId) return;
    if (likedByMe[songId]) return;
    setLikingId(songId);
    try {
      const res = await request(`/api/radio/song-history/${songId}/like`, { method: 'POST' });
      if (res.success) {
        setLikeCounts(prev => ({ ...prev, [songId]: (prev[songId] || 0) + 1 }));
        setLikedByMe(prev => ({ ...prev, [songId]: true }));
      }
    } catch { }
    finally { setLikingId(null); }
  }, [likingId, likedByMe, request]);

  const getInitialLikes = (songId: string) => likeCounts[songId] ?? 0;
  const isLikedByMeFn = (songId: string) => likedByMe[songId] ?? false;

  const initAudio = useCallback(() => {
    if (globalAudio) {
      setPlaying(!globalAudio.paused);
      audioRef.current = globalAudio;
    }
  }, []);

  return {
    currentTrack, setCurrentTrack, songHistory, setSongHistory,
    playing, setPlaying, likeCounts, setLikeCounts, likedByMe, setLikedByMe,
    likingId, audioRef,
    getStreamUrl, stopAudio, togglePlay,
    fetchCurrentTrack, fetchSongHistory, handleLike,
    getInitialLikes, isLikedByMeFn, initAudio,
  };
}
