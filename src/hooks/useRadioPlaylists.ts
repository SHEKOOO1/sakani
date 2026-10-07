import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { Playlist, PlaylistItem } from '../components/radio/types';

export function useRadioPlaylists() {
  const { request } = useApi();

  return useQuery<Playlist[]>({
    queryKey: ['radio', 'playlists'],
    queryFn: async () => {
      const res = await request('/api/radio/playlists');
      return res.success ? (res.data || []) : [];
    },
    staleTime: 120000,
  });
}

export function useRadioPlaylistItems(playlistId: string | null) {
  const { request } = useApi();

  return useQuery<PlaylistItem[]>({
    queryKey: ['radio', 'playlists', playlistId, 'items'],
    queryFn: async () => {
      if (!playlistId) return [];
      const res = await request(`/api/radio/playlists/${playlistId}/items`);
      return res.success ? (res.data || []) : [];
    },
    enabled: !!playlistId,
    staleTime: 60000,
  });
}
