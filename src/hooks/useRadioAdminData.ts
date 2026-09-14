import { useQuery, useQueries } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useRadioAdminData() {
  const { request } = useApi();

  const currentTrack = useQuery<any | null>({
    queryKey: ['radio', 'admin', 'current-track'],
    queryFn: async () => {
      const res = await request('/api/radio/current-track').catch(() => ({ success: false, data: null }));
      return res.success ? res.data : null;
    },
    staleTime: 30000,
  });

  const songHistory = useQuery<any[]>({
    queryKey: ['radio', 'admin', 'song-history'],
    queryFn: async () => {
      const res = await request('/api/radio/song-history').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const broadcasts = useQuery<any[]>({
    queryKey: ['radio', 'admin', 'broadcasts'],
    queryFn: async () => {
      const res = await request('/api/radio/broadcasts').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const videos = useQuery<any[]>({
    queryKey: ['radio', 'admin', 'videos'],
    queryFn: async () => {
      const res = await request('/api/radio/videos?include_inactive=true').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const categories = useQuery<any[]>({
    queryKey: ['radio', 'admin', 'categories'],
    queryFn: async () => {
      const res = await request('/api/radio/categories').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const playlists = useQuery<any[]>({
    queryKey: ['radio', 'admin', 'playlists'],
    queryFn: async () => {
      const res = await request('/api/radio/playlists').catch(() => ({ success: false, data: [] }));
      return res.success ? (res.data || []) : [];
    },
    staleTime: 30000,
  });

  const loading = currentTrack.isLoading || songHistory.isLoading || broadcasts.isLoading ||
    videos.isLoading || categories.isLoading || playlists.isLoading;

  return {
    currentTrack: currentTrack.data ?? null,
    songHistory: songHistory.data ?? [],
    broadcasts: broadcasts.data ?? [],
    videos: videos.data ?? [],
    categories: categories.data ?? [],
    playlists: playlists.data ?? [],
    loading,
    radioStats: {} as any,
    radioBroadcastStats: {} as any,
    radioChatStats: {} as any,
    fetchAll: () => {
      currentTrack.refetch();
      songHistory.refetch();
      broadcasts.refetch();
      videos.refetch();
      categories.refetch();
      playlists.refetch();
    },
    fetchRadioStats: async () => {},
  };
}

export function useRadioAdminStats() {
  const { request } = useApi();

  const radioStats = useQuery<any>({
    queryKey: ['radio', 'admin', 'stats', 'main'],
    queryFn: async () => {
      const res = await request('/api/radio/stats').catch(() => ({ success: false, data: null }));
      return res.success ? res.data : null;
    },
    staleTime: 60000,
    enabled: false,
  });

  const radioBroadcastStats = useQuery<any>({
    queryKey: ['radio', 'admin', 'stats', 'broadcasts'],
    queryFn: async () => {
      const res = await request('/api/radio/stats/broadcasts').catch(() => ({ success: false, data: null }));
      return res.success ? res.data : null;
    },
    staleTime: 60000,
    enabled: false,
  });

  const radioChatStats = useQuery<any>({
    queryKey: ['radio', 'admin', 'stats', 'chat'],
    queryFn: async () => {
      const res = await request('/api/radio/stats/chat').catch(() => ({ success: false, data: null }));
      return res.success ? res.data : null;
    },
    staleTime: 60000,
    enabled: false,
  });

  const fetchRadioStats = () => {
    radioStats.refetch();
    radioBroadcastStats.refetch();
    radioChatStats.refetch();
  };

  return {
    radioStats: radioStats.data ?? null,
    radioBroadcastStats: radioBroadcastStats.data ?? null,
    radioChatStats: radioChatStats.data ?? null,
    fetchRadioStats,
  };
}
