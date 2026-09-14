import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useAutoMetadata() {
  const { request } = useApi();
  const [localPaused, setLocalPaused] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['radio', 'admin', 'auto-metadata'],
    queryFn: async () => {
      const [dbRes, rjRes, statusRes] = await Promise.all([
        request('/api/radio/current-track').catch(() => ({ success: false, data: null })),
        request('/api/radio/radiojar/now-playing').catch(() => ({ success: false, data: null })),
        request('/api/radio/radiojar/status').catch(() => ({ success: false, data: null })),
      ]);
      const dbData = dbRes.success ? dbRes.data : null;
      const rjData = rjRes.success ? rjRes.data : null;
      const statusData = statusRes.success ? statusRes.data : null;
      return {
        autoMetadata: (dbData?.title ? { title: dbData.title, artist: dbData.artist || '' } : null)
          || (rjData ? { title: rjData.title || '', artist: rjData.artist || '' } : null),
        autoUpdatePaused: statusData?.manual_override_active ?? false,
      };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const autoUpdatePaused = localPaused || (data?.autoUpdatePaused ?? false);

  return {
    autoMetadata: data?.autoMetadata ?? null,
    autoUpdatePaused,
    setAutoUpdatePaused: setLocalPaused,
    fetchAutoMetadata: refetch,
  };
}
