import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { VideoItem } from '../components/radio/types';

export function useRadioVideos(refetchInterval = 60000) {
  const { request } = useApi();

  return useQuery<VideoItem[]>({
    queryKey: ['radio', 'videos'],
    queryFn: async () => {
      const [vidsRes, liveRes] = await Promise.all([
        request('/api/radio/videos').catch(() => ({ success: false, data: [] })),
        request('/api/radio/videos/live').catch(() => ({ success: false, data: [] })),
      ]);
      if (vidsRes.success) {
        const liveIds = liveRes.success && Array.isArray(liveRes.data) ? new Set(liveRes.data) : new Set();
        return (vidsRes.data || []).map((v: any) => ({ ...v, is_live: v.is_live || liveIds.has(v.id) }));
      }
      return [];
    },
    refetchInterval,
    staleTime: 30000,
  });
}
