import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { CurrentTrack } from '../components/radio/types';
import { DEFAULT_STREAM_URL } from '../components/radio/types';

export function useRadioCurrentTrack(refetchInterval = 60000) {
  const { request } = useApi();

  return useQuery<CurrentTrack | null>({
    queryKey: ['radio', 'current-track'],
    queryFn: async () => {
      const [dbRes, rjRes] = await Promise.all([
        request('/api/radio/current-track').catch(() => ({ success: false, data: null })),
        request('/api/radio/radiojar/now-playing').catch(() => ({ success: false, data: null })),
      ]);
      if (rjRes.success && rjRes.data) {
        const dbData = dbRes.success ? dbRes.data : null;
        return {
          id: dbData?.id || '',
          title: rjRes.data.title || dbData?.title || '',
          artist: rjRes.data.artist || dbData?.artist || '',
          cover_url: rjRes.data.thumb || dbData?.cover_url || '',
          description: dbData?.description || '',
          stream_url: dbData?.stream_url || DEFAULT_STREAM_URL,
          started_at: dbData?.started_at || '',
          listeners: dbData?.listeners || 0,
          likes: dbData?.likes || 0,
          liked_by_me: dbData?.liked_by_me || false,
        };
      }
      if (dbRes.success && dbRes.data) {
        return { ...dbRes.data, cover_url: dbRes.data.cover_url || '' };
      }
      return null;
    },
    refetchInterval,
    staleTime: 30000,
  });
}

export function useRadioSongHistory(refetchInterval = 60000) {
  const { request } = useApi();

  return useQuery({
    queryKey: ['radio', 'song-history'],
    queryFn: async () => {
      const res = await request('/api/radio/song-history');
      return res.success ? (res.data || []) : [];
    },
    refetchInterval,
    staleTime: 30000,
  });
}
